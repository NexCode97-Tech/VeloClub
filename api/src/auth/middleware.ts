import { Request, Response, NextFunction } from 'express';
import { fijarActor, fijarAlcance, alcanceActual } from '../lib/contexto-peticion';
import { resolverCarpeta } from '../lib/deportes';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { prisma } from '../db/client';
import { audienciaEsValida } from '../lib/clerk-audiencia';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
});

declare global {
  namespace Express {
    interface Request {
      auth?: {
        clerkId: string;
        email: string;
        name: string;
        picture?: string;
      };
      user?: { id: string; clubId: string | null; role: string };
      clubId?: string;
      // La carpeta de deporte en la que esta parada la peticion, ya verificada.
      deporteId?: string;
      // Solo el dueno del club cruza carpetas; el resto vive en la suya.
      esDuenoDelClub?: boolean;
      // Por que no se pudo resolver una carpeta, cuando no se pudo. La peticion
      // no se corta: `/me` lo devuelve para poder decirselo a la persona en vez
      // de dejarla frente a pantallas vacias sin explicacion.
      sinDeporte?: string;
    }
  }
}

/**
 * Declara que esta ruta mira el club entero y no una carpeta de deporte.
 *
 * Va donde el cruce es el proposito: el buscador de la comunidad, el muro
 * publico, los perfiles ajenos, el panel de superadmin, el arranque de sesion.
 * En todo lo demas el filtro por deporte se aplica solo.
 *
 * Sirve montado antes de las rutas (`app.use('/search', clubEntero, ...)`) o
 * dentro de una, despues de `requireAuth`. En el primer caso `requireAuth` ve
 * la declaracion y no la pisa; en el segundo la reemplaza.
 */
export function clubEntero(_req: Request, _res: Response, next: NextFunction) {
  fijarAlcance('club-entero');
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    next();
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const token = header.substring(7);
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    if (!audienciaEsValida(payload)) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const clerkId = payload.sub as string;

    const clerkUser = await clerk.users.getUser(clerkId);

    // El email es la llave de identidad en todo el backend: promueve a SUPERADMIN,
    // vincula al Member y resuelve permisos. Tomar el primero del arreglo permitía
    // suplantar a otro admin agregando ese correo sin verificar a la cuenta, así
    // que solo se acepta un email verificado, priorizando el principal.
    const isVerified = (e: { verification: { status: string } | null }) =>
      e.verification?.status === 'verified';
    const primary = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
    const trustedEmail = primary && isVerified(primary)
      ? primary
      : clerkUser.emailAddresses.find(isVerified);

    if (!trustedEmail) {
      return res.status(403).json({ error: 'Debes verificar tu correo para continuar' });
    }

    req.auth = {
      clerkId,
      email: trustedEmail.emailAddress,
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim(),
      picture: clerkUser.imageUrl,
    };

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { club: { select: { ownerUserId: true } } },
    });
    if (user) {
      req.user = { id: user.id, clubId: user.clubId, role: user.role };
    }

    // La carpeta de deporte de esta peticion.
    //
    // Se resuelve aca, una sola vez, y de aca la toma el cliente de Prisma para
    // filtrar todo lo que se consulte despues. El SUPERADMIN queda fuera: su
    // panel mira los clubes enteros a proposito.
    if (user?.clubId && user.role !== 'SUPERADMIN') {
      const pedida = req.header('X-Deporte')?.trim() || undefined;
      const carpeta = await resolverCarpeta({
        clubId:              user.clubId,
        userId:              user.id,
        deporteIdDelUsuario: user.deporteId,
        ownerUserId:         user.club?.ownerUserId ?? null,
        pedida,
      });
      if (carpeta.ok) {
        req.deporteId       = carpeta.deporteId;
        req.esDuenoDelClub  = carpeta.esDueno;
        // Si la ruta ya se declaro de club entero, no se le pisa: ahi el cruce
        // es el proposito. `req.deporteId` igual queda puesto, porque esas
        // rutas a veces necesitan saber desde que carpeta se las llamo.
        if (alcanceActual() !== 'club-entero') fijarAlcance({ deporteId: carpeta.deporteId });
      } else if (carpeta.estado === 403) {
        // Pidio una carpeta que no le corresponde. Eso si se corta: es un id
        // ajeno viajando en una cabecera, justo el intento que este modelo
        // tiene que rechazar.
        return res.status(403).json({ error: carpeta.error });
      } else {
        // No se le pudo asignar ninguna. La peticion sigue, pero acotada a una
        // carpeta que no existe: asi no ve nada en vez de verlo todo. `/me`
        // devuelve el motivo para poder explicarselo.
        req.sinDeporte = carpeta.error;
        if (alcanceActual() !== 'club-entero') fijarAlcance({ deporteId: '__sin_deporte__' });
      }
    }

    // Le pasa la identidad al contexto de la peticion: es de ahi que la
    // auditoria saca quien hizo cada cambio, sin que las rutas la reenvien.
    fijarActor({
      clerkId,
      email:  req.auth.email,
      nombre: req.auth.name,
      rol:    user?.role ?? null,
      clubId: user?.clubId ?? null,
    });

    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Auth error:', msg); // solo en servidor
    res.status(401).json({ error: 'No autenticado' });
  }
}
