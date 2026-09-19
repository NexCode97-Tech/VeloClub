/**
 * Siembra el club de demostración.
 *
 * Existe para poder mostrar la plataforma por fuera —publicaciones, pantallazos,
 * una demostración en vivo a un club interesado— sin usar datos de clientes
 * reales. Todo lo que crea es inventado: los nombres, los correos, las cifras.
 *
 * ── Dónde se corre ──────────────────────────────────────────────────────────
 * SOLO en el entorno de demostración, que tiene su propia base. Por eso lo
 * primero que hace es negarse a arrancar si no está declarado ese entorno: un
 * `npm run seed:demo` con el `DATABASE_URL` de producción apuntando al lado
 * equivocado le mete un club falso a los clientes.
 *
 *   ENTORNO_DEMO=si npm run seed:demo
 *
 * ── Qué borra ───────────────────────────────────────────────────────────────
 * Solo el club de demostración, buscado por su nombre exacto, y lo vuelve a
 * crear. Nunca hace una limpieza general de la base. Correrlo dos veces deja
 * exactamente el mismo resultado: los datos salen de un generador con semilla
 * fija, así que las cifras de los pantallazos no cambian entre corridas.
 *
 * ── Por qué seis meses de historia ──────────────────────────────────────────
 * Un club recién sembrado tiene las gráficas planas y las pantallas vacías, que
 * es justo lo contrario de lo que se quiere mostrar. La asistencia, las
 * mensualidades y la caja van desde hace seis meses hasta hoy.
 */

import { PrismaClient, AttendanceStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ─── El club ────────────────────────────────────────────────────────────────
// Inventado de pies a cabeza. No se parece a ningún club real a propósito: la
// pieza sale publicada y nadie autorizó que su nombre apareciera ahí.
const CLUB = 'Club Deportivo Aurora';
const CIUDAD = 'Bucaramanga';
const DEPARTAMENTO = 'Santander';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Espejo de src/lib/catalogos.ts. Son catálogos cerrados: la categoría se
// compara carácter a carácter contra la de la clase para armar la planilla, y
// una que no esté escrita igual da una planilla vacía sin avisar.
const CATEGORIAS = ['Menores 3-10 años', 'Transición 11-13 años', 'Mayores 14+ años'] as const;
const NIVELES = ['Escuela', 'Novatos', 'Intermedio', 'Avanzados', 'Federados', 'Adultos'] as const;

// ─── Azar con semilla ───────────────────────────────────────────────────────
// Un generador propio y no Math.random: dos corridas tienen que dar el mismo
// club. Si las cifras cambiaran cada vez, dos pantallazos de la misma pantalla
// tomados en días distintos no cuadrarían entre ellos.
let semilla = 20260916;
function azar(): number {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
}
function entre(min: number, max: number): number {
  return min + Math.floor(azar() * (max - min + 1));
}
function alguno<T>(lista: readonly T[]): T {
  return lista[Math.floor(azar() * lista.length)];
}
function conProbabilidad(p: number): boolean {
  return azar() < p;
}

// ─── Nombres ────────────────────────────────────────────────────────────────
const NOMBRES_F = ['Mariana', 'Valentina', 'Isabela', 'Salomé', 'Antonia', 'Emilia', 'Luciana', 'Manuela', 'Sara', 'Juanita', 'Alejandra', 'Gabriela', 'Daniela', 'Camila', 'Paulina', 'Laura', 'Catalina', 'Renata'];
const NOMBRES_M = ['Samuel', 'Tomás', 'Emiliano', 'Martín', 'Julián', 'Simón', 'Jerónimo', 'Matías', 'Santiago', 'Alejandro', 'Nicolás', 'Sebastián', 'Andrés', 'Felipe', 'Daniel', 'Miguel', 'Esteban', 'Joaquín'];
const APELLIDOS = ['Ospina', 'Cardona', 'Restrepo', 'Jaramillo', 'Mejía', 'Agudelo', 'Córdoba', 'Pineda', 'Vélez', 'Rúa', 'Zapata', 'Arango', 'Betancur', 'Quintero', 'Serna', 'Hoyos', 'Londoño', 'Gallego', 'Bedoya', 'Marín', 'Salazar', 'Vanegas', 'Guerrero', 'Pabón'];

const EPS = ['Sura', 'Sanitas', 'Nueva EPS', 'Coomeva', 'Salud Total', 'Compensar'];
const RH = ['O+', 'O+', 'O+', 'A+', 'A+', 'B+', 'AB+', 'O-', 'A-'];
const ALERGIAS = [null, null, null, null, 'Penicilina', 'Polen', 'Maní', 'Ninguna conocida'];
const PARENTESCOS = ['Madre', 'Padre', 'Abuela', 'Tío'];

function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Correo inventado, sobre un dominio de ejemplo reservado por la RFC 2606. */
function correoDe(nombre: string, apellido: string, i: number): string {
  return `${sinTildes(nombre).toLowerCase()}.${sinTildes(apellido).toLowerCase()}${i}@example.com`;
}

function telefono(): string {
  return `3${entre(0, 2)}${entre(0, 9)} ${entre(100, 999)} ${entre(1000, 9999)}`;
}

/** Fecha a mediodía UTC, que es como el resto del proyecto guarda los días. */
function dia(anio: number, mes: number, d: number): Date {
  return new Date(Date.UTC(anio, mes - 1, d, 12, 0, 0));
}

function soloFecha(f: Date): Date {
  return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
}

// ─── Guarda ─────────────────────────────────────────────────────────────────
function verificarEntorno(): void {
  if (process.env.ENTORNO_DEMO !== 'si') {
    console.error(
      '\nEste script solo corre en el entorno de demostración.\n\n' +
      'Crea datos inventados y borra el club de demostración antes de rehacerlo.\n' +
      'Si corre contra la base de producción, le mete un club falso a los clientes.\n\n' +
      'Para correrlo, declara el entorno:\n\n' +
      '  ENTORNO_DEMO=si npm run seed:demo\n'
    );
    process.exit(1);
  }

  // Se imprime a dónde apunta, sin la contraseña. Declarar la variable no
  // garantiza que el DATABASE_URL sea el correcto, y verlo es la última
  // oportunidad de frenar.
  const url = process.env.DATABASE_URL ?? '';
  const destino = url.replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  console.log(`Base de datos: ${destino || '(sin DATABASE_URL)'}\n`);
}

async function main(): Promise<void> {
  verificarEntorno();

  // ── Borrón del club anterior ──────────────────────────────────────────────
  // Por nombre exacto y nada más. El borrado en cascada se lleva deportes,
  // sedes, miembros, asistencia, pagos, caja, competencias y publicaciones.
  const previo = await prisma.club.findFirst({ where: { name: CLUB }, select: { id: true } });
  if (previo) {
    await prisma.club.delete({ where: { id: previo.id } });
    console.log('Club de demostración anterior, borrado.');
  }

  const hoy = new Date();
  const anioActual = hoy.getUTCFullYear();
  const mesActual = hoy.getUTCMonth() + 1;

  // ── El club ───────────────────────────────────────────────────────────────
  // Sin sello de verificado: eso se pone a mano desde Superadmin cuando se
  // necesite para una pieza. Nace sin logo, que se sube desde Ajustes.
  const club = await prisma.club.create({
    data: {
      name: CLUB,
      city: CIUDAD,
      department: DEPARTAMENTO,
      colorPrimario: '#0F5C8C',
      colorSecundario: '#1D8FBF',
      carnetMarcaAgua: true,
      description: 'Club de formación deportiva. Escuela, competencia y acondicionamiento para niñas, niños y jóvenes.',
      phone: '317 555 0148',
      email: 'contacto@example.com',
      foundedAt: dia(2014, 3, 12),
      // Campo heredado de cuando un club era de un solo deporte. Lo siguen
      // leyendo el perfil publico, el buscador y la ficha del superadmin, asi
      // que vacio deja tres pantallas con un hueco.
      deporte: 'Patinaje',
      memberCountApprox: 55,
      // Domingo. El club no entrena ese día, así que la asistencia no lo pide.
      noAttendanceDays: [0],
      active: true,
      verificationStatus: 'PENDING',
      trialEndsAt: null,
    },
  });
  console.log(`Club creado: ${club.name}`);

  // ── Las carpetas ──────────────────────────────────────────────────────────
  // Dos deportes a propósito: es lo que hay que poder mostrar, que un club
  // maneje varias disciplinas sin que se le mezclen los datos.
  const patinaje = await prisma.deporte.create({
    data: { clubId: club.id, nombre: 'Patinaje', activo: true, inscripcionAbierta: true, inscripcionToken: 'demo-aurora-patinaje' },
  });
  const natacion = await prisma.deporte.create({
    data: { clubId: club.id, nombre: 'Natación', activo: true, inscripcionAbierta: false, inscripcionToken: 'demo-aurora-natacion' },
  });

  // ── Staff ─────────────────────────────────────────────────────────────────
  // El `clerkId` sale del entorno cuando existe, que es lo que permite entrar
  // de verdad a la demostración. Sin eso quedan de adorno: las cuentas se ven
  // en las pantallas pero nadie inicia sesión con ellas.
  const admin = await prisma.user.create({
    data: {
      clerkId: process.env.DEMO_ADMIN_CLERK_ID ?? `demo_admin_${club.id}`,
      email: process.env.DEMO_ADMIN_EMAIL ?? 'admin.aurora@example.com',
      name: 'Carolina Estrada Ruiz',
      role: 'ADMIN',
      profileComplete: true,
      // La biografía sale en Mi perfil y en el perfil público. Vacía deja esa
      // pantalla con un hueco justo debajo del nombre.
      bio: 'Directora del club. Formación deportiva desde 2014.',
      termsAcceptedAt: dia(anioActual, mesActual, 1),
      clubId: club.id,
      // En null cruza las dos carpetas, que es lo que le toca al dueño.
      deporteId: null,
    },
  });
  await prisma.club.update({ where: { id: club.id }, data: { ownerUserId: admin.id } });

  await prisma.user.createMany({
    data: [
      {
        clerkId: `demo_entrenador_1_${club.id}`,
        email: 'entrenador.patinaje@example.com',
        name: 'Andrés Cardona Vélez',
        role: 'ENTRENADOR',
        profileComplete: true,
        bio: 'Entrenador de la categoría competencia.',
        clubId: club.id,
        deporteId: patinaje.id,
      },
      {
        clerkId: `demo_entrenador_2_${club.id}`,
        email: 'entrenadora.natacion@example.com',
        name: 'Paola Rincón Gómez',
        role: 'ENTRENADOR',
        profileComplete: true,
        bio: 'Entrenadora de natación. Técnica y fondo.',
        clubId: club.id,
        deporteId: natacion.id,
      },
      {
        clerkId: `demo_entrenador_3_${club.id}`,
        email: 'entrenador2.patinaje@example.com',
        name: 'Javier Ortega Pabón',
        role: 'ENTRENADOR',
        profileComplete: true,
        clubId: club.id,
        deporteId: patinaje.id,
      },
      {
        clerkId: `demo_admin_2_${club.id}`,
        email: 'admin2.aurora@example.com',
        name: 'Mauricio Sandoval León',
        role: 'ADMIN',
        profileComplete: true,
        clubId: club.id,
        // Un segundo administrador amarrado a una carpeta, para que se vea que
        // no todo administrador es el dueño del club.
        deporteId: patinaje.id,
      },
    ],
  });

  // ── Sedes ─────────────────────────────────────────────────────────────────
  const [pistaNorte, pistaCentro, piscina] = await Promise.all([
    prisma.location.create({
      data: { clubId: club.id, deporteId: patinaje.id, name: 'Patinódromo Norte', address: 'Calle 45 # 21-30', latitude: 7.1254, longitude: -73.1198 },
    }),
    prisma.location.create({
      data: { clubId: club.id, deporteId: patinaje.id, name: 'Coliseo Centro', address: 'Carrera 19 # 33-12', latitude: 7.1189, longitude: -73.1276 },
    }),
    prisma.location.create({
      data: { clubId: club.id, deporteId: natacion.id, name: 'Complejo Acuático', address: 'Avenida Los Samanes # 8-45', latitude: 7.1061, longitude: -73.1094 },
    }),
  ]);

  // ── Horario semanal ───────────────────────────────────────────────────────
  // 1 = lunes … 6 = sábado, igual que Date.getDay(). La lista de categorías
  // vacía significa la sede entera, no ninguna.
  const clases = await Promise.all([
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: patinaje.id, locationId: pistaNorte.id, nombre: 'Escuela mañana', diaSemana: 1, hora: '08:00', categorias: ['Menores 3-10 años'], color: '#4361EE' } }),
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: patinaje.id, locationId: pistaNorte.id, nombre: 'Competencia tarde', diaSemana: 1, hora: '16:00', categorias: ['Transición 11-13 años', 'Mayores 14+ años'], color: '#381DA0' } }),
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: patinaje.id, locationId: pistaNorte.id, nombre: 'Escuela mañana', diaSemana: 3, hora: '08:00', categorias: ['Menores 3-10 años'], color: '#4361EE' } }),
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: patinaje.id, locationId: pistaNorte.id, nombre: 'Competencia tarde', diaSemana: 3, hora: '16:00', categorias: ['Transición 11-13 años', 'Mayores 14+ años'], color: '#381DA0' } }),
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: patinaje.id, locationId: pistaCentro.id, nombre: 'Formación', diaSemana: 5, hora: '17:00', categorias: [], color: '#06D6A0' } }),
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: patinaje.id, locationId: pistaNorte.id, nombre: 'Entrenamiento largo', diaSemana: 6, hora: '07:00', categorias: [], color: '#FFB703' } }),
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: natacion.id, locationId: piscina.id, nombre: 'Técnica', diaSemana: 2, hora: '15:00', categorias: [], color: '#4361EE' } }),
    prisma.claseHorario.create({ data: { clubId: club.id, deporteId: natacion.id, locationId: piscina.id, nombre: 'Técnica', diaSemana: 4, hora: '15:00', categorias: [], color: '#4361EE' } }),
  ]);

  // ── Deportistas ───────────────────────────────────────────────────────────
  interface Sembrado {
    id: string;
    deporteId: string;
    locationId: string;
    fullName: string;
    category: string;
    monthlyFee: number;
    paymentDueDay: number;
    active: boolean;
    desdeMes: number; // meses hacia atrás en que entró al club
  }

  async function sembrarDeportistas(
    deporteId: string,
    sedes: { id: string }[],
    cuantos: number,
    cuota: number,
    inicio: number,
  ): Promise<Sembrado[]> {
    const salida: Sembrado[] = [];

    for (let i = 0; i < cuantos; i++) {
      const esNina = conProbabilidad(0.52);
      const nombre = esNina ? alguno(NOMBRES_F) : alguno(NOMBRES_M);
      const apellido1 = alguno(APELLIDOS);
      const apellido2 = alguno(APELLIDOS);
      const fullName = `${nombre} ${apellido1} ${apellido2}`;

      // La primera de patinaje es la que se amarra a la cuenta de deportista
      // con DEMO_DEPORTISTA_CLERK_ID.
      const esLaDeLaCuenta = inicio === 1 && i === 0;

      // La edad decide la categoría: no tendría sentido un niño de seis años
      // marcado como mayor de catorce.
      //
      // A la de la cuenta se le sube a la franja que compite: la categoría más
      // pequeña va a escuela y nunca entra a un podio, así que su Rendimiento
      // salía vacío. El número al azar se saca igual, para que el resto del
      // club no se mueva.
      const edadAzar = entre(5, 17);
      const edad = esLaDeLaCuenta ? Math.max(edadAzar, 12) : edadAzar;
      const category = edad <= 10 ? CATEGORIAS[0] : edad <= 13 ? CATEGORIAS[1] : CATEGORIAS[2];
      const nivel = edad <= 10 ? alguno(['Escuela', 'Novatos'] as const) : alguno(NIVELES.slice(1, 5));

      // Casi todos entraron hace tiempo; unos pocos son recientes, para que la
      // gráfica de crecimiento tenga escalones y no una recta.
      const desdeMesAzar = conProbabilidad(0.8) ? entre(6, 30) : entre(0, 5);

      // En pausa: los que se van en vacaciones. Es un estado real del producto
      // y conviene que se vea en los pantallazos.
      const activoAzar = !conProbabilidad(0.08);

      // Tiene que llevar tiempo en el club y estar activa: si le tocara entrar
      // este mes, Mis pagos saldría con una sola mensualidad.
      const desdeMes = esLaDeLaCuenta ? Math.max(desdeMesAzar, 12) : desdeMesAzar;
      const active = esLaDeLaCuenta ? true : activoAzar;

      const sede = sedes[i % sedes.length];
      const menor = edad < 18;
      // Se saca una vez y se usa en los dos sitios. Sacarlo dos veces dejaba la
      // ficha diciendo un dia de corte y las mensualidades venciendo en otro.
      const diaCorte = alguno([1, 5, 10, 15] as const);

      const m = await prisma.member.create({
        data: {
          clubId: club.id,
          deporteId,
          fullName,
          email: correoDe(nombre, apellido1, inicio + i),
          phone: telefono(),
          birthDate: dia(anioActual - edad, entre(1, 12), entre(1, 28)),
          docType: menor ? 'TI' : 'CC',
          docNumber: String(entre(1000000000, 1099999999)),
          gender: esNina ? 'Femenino' : 'Masculino',
          rh: alguno(RH),
          allergies: alguno(ALERGIAS),
          eps: alguno(EPS),
          emergencyContact: `${alguno(esNina ? NOMBRES_F : NOMBRES_M)} ${apellido1}`,
          emergencyPhone: telefono(),
          guardianRelation: menor ? alguno(PARENTESCOS) : null,
          guardianDocNumber: menor ? String(entre(30000000, 1099999999)) : null,
          category,
          tipo: nivel,
          paymentDueDay: diaCorte,
          monthlyFee: cuota,
          role: 'DEPORTISTA',
          active,
          desactivadoAt: active ? null : dia(anioActual, mesActual, 3),
          inscripcion: 'APROBADO',
          origen: conProbabilidad(0.35) ? 'FORMULARIO' : 'MANUAL',
          // Quien entra por el enlace entra aprobado, y esa es la fecha que
          // muestra la ficha. Sin ella el campo sale vacio en media lista.
          aprobadoAt: new Date(Date.UTC(anioActual, hoy.getUTCMonth() - desdeMes, entre(1, 28), 12)),
          inviteStatus: conProbabilidad(0.4) ? 'ACCEPTED' : 'PENDING',
          createdAt: new Date(Date.UTC(anioActual, hoy.getUTCMonth() - desdeMes, entre(1, 28), 12)),
          locations: { create: [{ locationId: sede.id }] },
        },
        select: { id: true, fullName: true },
      });

      salida.push({
        id: m.id,
        deporteId,
        locationId: sede.id,
        fullName: m.fullName,
        category,
        monthlyFee: cuota,
        paymentDueDay: diaCorte,
        active,
        desdeMes,
      });
    }

    return salida;
  }

  const enPatinaje = await sembrarDeportistas(patinaje.id, [pistaNorte, pistaCentro], 38, 95000, 1);
  const enNatacion = await sembrarDeportistas(natacion.id, [piscina], 16, 110000, 100);
  const todos = [...enPatinaje, ...enNatacion];

  // La ficha de cumpleaños de Inicio mira los próximos 30 días. Con fechas al
  // azar puede quedar vacía justo el día del pantallazo, así que a tres se les
  // corre el cumpleaños a la semana que viene. El año de nacimiento no se toca:
  // la edad y la categoría siguen cuadrando.
  for (let i = 0; i < 3; i++) {
    const quien = enPatinaje[i * 5];
    const ficha = await prisma.member.findUnique({ where: { id: quien.id }, select: { birthDate: true } });
    const anioNacimiento = ficha?.birthDate?.getUTCFullYear() ?? anioActual - 12;
    const proximo = new Date(Date.now() + (i * 4 + 2) * 24 * 3600 * 1000);
    await prisma.member.update({
      where: { id: quien.id },
      data: { birthDate: dia(anioNacimiento, proximo.getUTCMonth() + 1, proximo.getUTCDate()) },
    });
  }

  // Un deportista con cuenta de verdad, para poder mostrar la otra mitad de la
  // plataforma: Mi carnet, Mis pagos y su propio Rendimiento. Sin el clerkId de
  // una cuenta real de Clerk no se puede entrar como deportista.
  if (process.env.DEMO_DEPORTISTA_CLERK_ID) {
    await prisma.member.update({
      where: { id: enPatinaje[0].id },
      data: {
        clerkId: process.env.DEMO_DEPORTISTA_CLERK_ID,
        email: process.env.DEMO_DEPORTISTA_EMAIL ?? undefined,
        inviteStatus: 'ACCEPTED',
      },
    });
  }
  console.log(`Deportistas: ${enPatinaje.length} en patinaje, ${enNatacion.length} en natación.`);

  // ── El staff, también en Miembros ─────────────────────────────────────────
  // Miembros no es solo la lista de deportistas: las cifras de arriba cuentan
  // Admins y Entrenadores aparte, y sin estas fichas esas dos salen en cero.
  //
  // No llevan cuota ni dia de corte: el staff no paga mensualidad, y ponerle
  // una lo mete en las cuentas de Finanzas como si fuera un deportista mas.
  const STAFF: [string, 'ADMIN' | 'ENTRENADOR', string, string][] = [
    ['Carolina Estrada Ruiz', 'ADMIN', 'admin.aurora@example.com', patinaje.id],
    ['Mauricio Sandoval León', 'ADMIN', 'admin2.aurora@example.com', patinaje.id],
    ['Andrés Cardona Vélez', 'ENTRENADOR', 'entrenador.patinaje@example.com', patinaje.id],
    ['Paola Rincón Gómez', 'ENTRENADOR', 'entrenadora.natacion@example.com', natacion.id],
    ['Javier Ortega Pabón', 'ENTRENADOR', 'entrenador2.patinaje@example.com', patinaje.id],
  ];

  for (const [fullName, rol, correo, deporteId] of STAFF) {
    await prisma.member.create({
      data: {
        clubId: club.id,
        deporteId,
        fullName,
        email: correo,
        phone: telefono(),
        birthDate: dia(anioActual - entre(26, 45), entre(1, 12), entre(1, 28)),
        docType: 'CC',
        docNumber: String(entre(60000000, 1099999999)),
        gender: /^(Carolina|Paola)/.test(fullName) ? 'Femenino' : 'Masculino',
        rh: alguno(RH),
        eps: alguno(EPS),
        emergencyContact: `${alguno(NOMBRES_F)} ${alguno(APELLIDOS)}`,
        emergencyPhone: telefono(),
        role: rol,
        active: true,
        inscripcion: 'APROBADO',
        origen: 'MANUAL',
        inviteStatus: 'ACCEPTED',
        aprobadoAt: dia(anioActual - 1, entre(1, 12), entre(1, 28)),
        createdAt: dia(anioActual - 1, entre(1, 12), entre(1, 28)),
        locations: { create: [{ locationId: deporteId === natacion.id ? piscina.id : pistaNorte.id }] },
      },
    });
  }
  console.log(`Staff en Miembros: ${STAFF.length} fichas, entre admins y entrenadores.`);

  // ── Tres esperando en la bandeja ──────────────────────────────────────────
  // La pantalla de pendientes vacía no se puede mostrar, y es de las que mejor
  // explican el producto.
  for (let i = 0; i < 3; i++) {
    const nombre = alguno(NOMBRES_F);
    const apellido = alguno(APELLIDOS);
    await prisma.member.create({
      data: {
        clubId: club.id,
        deporteId: patinaje.id,
        fullName: `${nombre} ${apellido} ${alguno(APELLIDOS)}`,
        email: correoDe(nombre, apellido, 900 + i),
        phone: telefono(),
        birthDate: dia(anioActual - entre(6, 15), entre(1, 12), entre(1, 28)),
        docType: 'TI',
        docNumber: String(entre(1000000000, 1099999999)),
        category: alguno(CATEGORIAS),
        tipo: 'Escuela',
        role: 'DEPORTISTA',
        inscripcion: 'PENDIENTE',
        origen: 'FORMULARIO',
        createdAt: new Date(Date.now() - (i + 1) * 36 * 3600 * 1000),
      },
    });
  }

  // ── Un cambio de datos esperando revisión ─────────────────────────────────
  // Otra bandeja que vacía no se puede mostrar. Es distinta de la de
  // inscripciones: acá el deportista ya estaba en el club y la familia mandó
  // una corrección por el enlace. No se aplica sola, espera al club.
  const aCorregir = enPatinaje[3];
  await prisma.member.update({
    where: { id: aCorregir.id },
    data: {
      cambiosPendientes: {
        enviadoEn: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
        cambios: {
          phone: { antes: '314 555 0122', despues: '318 555 0977' },
          eps: { antes: 'Coomeva', despues: 'Sura' },
          emergencyPhone: { antes: '312 555 0410', despues: '300 555 0188' },
        },
      },
    },
  });

  // ── Asistencia, seis meses ────────────────────────────────────────────────
  // Solo en los días que el horario dicta, y solo desde que cada quien entró al
  // club. Marcar a alguien antes de su ingreso deja un histórico que no cuadra
  // con su propia ficha.
  type Clase = (typeof clases)[number];
  const porDeporte = new Map<string, Clase[]>();
  for (const c of clases) {
    const lista = porDeporte.get(c.deporteId) ?? [];
    lista.push(c);
    porDeporte.set(c.deporteId, lista);
  }

  const asistencias: {
    clubId: string; deporteId: string; memberId: string; locationId: string;
    date: Date; status: AttendanceStatus; claseId: string;
  }[] = [];

  const desde = new Date(Date.UTC(anioActual, hoy.getUTCMonth() - 5, 1, 12));
  for (let f = new Date(desde); f <= hoy; f.setUTCDate(f.getUTCDate() + 1)) {
    const diaSemana = f.getUTCDay();
    const mesesAtras = (hoy.getUTCFullYear() - f.getUTCFullYear()) * 12 + (hoy.getUTCMonth() - f.getUTCMonth());

    for (const m of todos) {
      if (m.desdeMes < mesesAtras) continue;
      if (!m.active && mesesAtras === 0) continue;

      const suyas = (porDeporte.get(m.deporteId) ?? []).filter(
        c => c.diaSemana === diaSemana && c.locationId === m.locationId
          && (c.categorias.length === 0 || c.categorias.includes(m.category)),
      );

      for (const c of suyas) {
        // Nueve de cada diez asisten. El resto se reparte entre falta, excusa
        // médica y llegada tarde, que es más o menos lo que reporta un club.
        const r = azar();
        const status: AttendanceStatus =
          r < 0.87 ? 'PRESENT' : r < 0.94 ? 'ABSENT' : r < 0.97 ? 'LATE' : 'MEDICAL_EXCUSE';

        asistencias.push({
          clubId: club.id,
          deporteId: m.deporteId,
          memberId: m.id,
          locationId: m.locationId,
          date: soloFecha(f),
          status,
          claseId: c.id,
        });
      }
    }
  }

  // Por tandas: una sola inserción con decenas de miles de filas se cae.
  for (let i = 0; i < asistencias.length; i += 2000) {
    await prisma.attendance.createMany({ data: asistencias.slice(i, i + 2000), skipDuplicates: true });
  }
  console.log(`Asistencias: ${asistencias.length}.`);

  // ── Mensualidades y caja ──────────────────────────────────────────────────
  // El mes en curso va a medias, que es lo normal a mitad de mes y lo que hace
  // que la pantalla de Finanzas tenga algo que mostrar.
  let pagadas = 0;
  let pendientes = 0;

  for (let atras = 5; atras >= 0; atras--) {
    const ref = new Date(Date.UTC(anioActual, hoy.getUTCMonth() - atras, 1, 12));
    const anio = ref.getUTCFullYear();
    const mes = ref.getUTCMonth() + 1;

    for (const m of todos) {
      if (m.desdeMes < atras) continue;
      if (!m.active && atras === 0) continue;

      // Al día casi siempre; el mes en curso, a la mitad.
      const pagado = atras === 0 ? conProbabilidad(0.55) : conProbabilidad(0.93);
      const vence = dia(anio, mes, m.paymentDueDay);
      const status: PaymentStatus = pagado ? 'PAID' : vence < hoy ? 'OVERDUE' : 'PENDING';
      // En el mes en curso nadie pudo pagar en un día que todavía no llega.
      // El azar solo se saca si pagó, igual que antes, para no mover el resto
      // del club sembrado.
      const diaPago = pagado ? Math.min(28, m.paymentDueDay + entre(0, 4), atras === 0 ? hoy.getUTCDate() : 31) : 0;
      const paidAt = pagado ? dia(anio, mes, diaPago) : null;

      const pago = await prisma.payment.create({
        data: {
          clubId: club.id,
          deporteId: m.deporteId,
          memberId: m.id,
          locationId: m.locationId,
          amount: m.monthlyFee,
          month: mes,
          year: anio,
          dueDate: vence,
          paidAt,
          status,
          // El cobro nace el día 1 de su mes, que es cuando un club genera los
          // cobros. Con la fecha de la siembra, la comparación de Finanzas
          // contra el mes anterior no encontraría ningún pendiente en el pasado.
          createdAt: dia(anio, mes, 1),
        },
        select: { id: true },
      });

      if (pagado) {
        pagadas++;
        // El ingreso nace de la mensualidad y hereda su sede, igual que cuando
        // se registra desde la aplicación.
        await prisma.cashEntry.create({
          data: {
            clubId: club.id,
            deporteId: m.deporteId,
            type: 'INCOME',
            amount: m.monthlyFee,
            description: `Mensualidad ${m.fullName} — ${MESES[mes - 1]} ${anio}`,
            paymentId: pago.id,
            locationId: m.locationId,
            date: paidAt ?? vence,
          },
        });
      } else {
        pendientes++;
      }
    }

    // Otros ingresos: no todo lo que entra a la caja de un club es mensualidad.
    // Sin esto, Flujo de caja se lee como una copia de Mensualidades.
    for (const [descripcion, monto] of [
      ['Venta de uniformes', entre(180, 620) * 1000],
      ['Inscripciones nuevas', entre(2, 6) * 60000],
    ] as [string, number][]) {
      await prisma.cashEntry.create({
        data: {
          clubId: club.id, deporteId: patinaje.id, type: 'INCOME',
          amount: monto, description: descripcion,
          locationId: pistaNorte.id, date: dia(anio, mes, entre(4, 24)),
        },
      });
    }

    // Una devolución de vez en cuando. Es un tipo de movimiento que existe en
    // el producto y que nunca se vería si la caja solo tuviera entradas y
    // salidas.
    if (atras === 2) {
      await prisma.cashEntry.create({
        data: {
          clubId: club.id, deporteId: patinaje.id, type: 'REFUND',
          amount: 95000, description: 'Devolución de mensualidad por retiro',
          locationId: pistaCentro.id, date: dia(anio, mes, 18),
        },
      });
    }

    // Gastos del mes. Sin ellos la caja solo sube y el balance no dice nada.
    const gastos: [string, number, string | null][] = [
      ['Arriendo de pista', 1200000, pistaNorte.id],
      ['Pago a entrenadores', 2400000, null],
      ['Servicios públicos', 320000, pistaCentro.id],
      ['Mantenimiento de equipos', entre(150, 420) * 1000, pistaNorte.id],
      ['Alquiler de carriles', 780000, piscina.id],
    ];
    for (const [descripcion, monto, locationId] of gastos) {
      await prisma.cashEntry.create({
        data: {
          clubId: club.id,
          deporteId: locationId === piscina.id ? natacion.id : patinaje.id,
          type: 'EXPENSE',
          amount: monto,
          description: descripcion,
          locationId,
          date: dia(anio, mes, entre(2, 26)),
        },
      });
    }
  }
  console.log(`Mensualidades: ${pagadas} pagadas, ${pendientes} por cobrar.`);

  // ── Competencias ──────────────────────────────────────────────────────────
  // Las dos carpetas tienen las suyas. Rendimiento en Natación vacío es una
  // pantalla que no se puede mostrar, y es de las que más venden.
  interface Prueba {
    nombre: string;
    // Cómo se llena la observación del resultado. Cada deporte mide lo suyo.
    marca: () => string;
  }

  function tiempo(minSeg: number, maxSeg: number): string {
    const s = entre(minSeg, maxSeg);
    const c = String(entre(0, 99)).padStart(2, '0');
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${c}` : `${s}.${c}`;
  }

  const PRUEBAS_PATINAJE: Prueba[] = [
    { nombre: '300 metros contrarreloj', marca: () => `${tiempo(27, 33)} s` },
    { nombre: '500 metros más distancia', marca: () => `${tiempo(45, 52)} s` },
    { nombre: '1000 metros', marca: () => `${tiempo(95, 115)} min` },
  ];
  const PRUEBAS_NATACION: Prueba[] = [
    { nombre: '50 metros libre', marca: () => `${tiempo(28, 38)} s` },
    { nombre: '100 metros libre', marca: () => `${tiempo(62, 85)} min` },
    { nombre: '50 metros espalda', marca: () => `${tiempo(34, 46)} s` },
  ];

  const OBSERVACIONES = [
    'Mejoró su marca personal.',
    'Buena salida, se le fue el remate.',
    'Primera vez en esta distancia.',
    null,
    null,
    'Corrigió la técnica de curva.',
  ];

  async function sembrarCompetencias(
    deporteId: string,
    plantel: Sembrado[],
    pruebas: Prueba[],
    torneos: [string, string, number][],
    destacado?: Sembrado,
  ): Promise<void> {
    // Solo los que compiten: los de la categoría más pequeña van a escuela, no
    // a torneos, y meterlos en un podio se ve falso de una vez.
    const elegibles = plantel.filter(m => m.active && m.category !== CATEGORIAS[0]);
    if (elegibles.length === 0) return;

    for (const [t, [nombre, lugar, mesesAtras]] of torneos.entries()) {
      const ref = new Date(Date.UTC(anioActual, hoy.getUTCMonth() - mesesAtras, entre(8, 24), 12));
      const competencia = await prisma.competition.create({
        data: { clubId: club.id, deporteId, name: nombre, place: lugar, date: ref },
      });

      for (const [k, prueba] of pruebas.entries()) {
        const evento = await prisma.competitionEvent.create({
          data: { competitionId: competencia.id, name: prueba.nombre },
        });

        // El club no gana todo. En cada competencia gana UNA prueba, queda
        // segundo en otra y tercero en la otra, y cuál gana va rotando de una
        // competencia a la siguiente. El pódio de la tarjeta toma los tres
        // mejores puestos de toda la competencia: si el club ganara las tres
        // pruebas, salen tres oros, que se ve falso de una vez.
        //
        // Detrás del mejor del club, los demás arrancan tres puestos más
        // abajo: los que faltan en medio son de otros clubes. Así en toda la
        // competencia hay un solo 1, un solo 2 y un solo 3.
        const mejor = ((k + t) % pruebas.length) + 1;
        const participantes = [...elegibles].sort(() => azar() - 0.5).slice(0, Math.min(8, elegibles.length));

        // La cuenta de deportista siempre compite. Su Rendimiento es la mitad
        // de la demo que se ve desde el celular, y sorteando la lista podía
        // quedarse por fuera de todas las pruebas.
        if (destacado && !participantes.some(p => p.id === destacado.id)) {
          participantes[participantes.length - 1] = destacado;
        }

        // Y en una prueba de cada competencia es ella la que sube al podio:
        // bronce en la más vieja, plata en la del medio y oro en la más
        // reciente. No gana siempre, que se vería falso, pero la pantalla
        // tiene qué mostrar.
        const leTocaPodio = destacado && mejor === torneos.length - t;
        const enOrden = leTocaPodio && destacado
          ? [destacado, ...participantes.filter(p => p.id !== destacado.id)]
          : participantes;

        const puestos: number[] = [mejor];
        let siguiente = mejor + 3;
        while (puestos.length < enOrden.length) {
          siguiente += entre(0, 2);
          puestos.push(siguiente);
          siguiente += 1;
        }

        await prisma.eventResult.createMany({
          data: enOrden.map((m, i) => ({
            eventId: evento.id,
            memberId: m.id,
            position: puestos[i],
            category: m.category,
            observations: puestos[i] <= 3
              ? `${prueba.marca()}. ${['Primer', 'Segundo', 'Tercer'][puestos[i] - 1]} puesto.`
              : `${prueba.marca()}${alguno(OBSERVACIONES) ? '. ' + alguno(OBSERVACIONES) : ''}`,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  await sembrarCompetencias(patinaje.id, enPatinaje, PRUEBAS_PATINAJE, [
    ['Válida Departamental', 'Patinódromo de Floridablanca', 4],
    ['Copa Ciudad de Bucaramanga', 'Patinódromo Norte', 2],
    ['Interclubes de Santander', 'Coliseo Centro', 1],
  ], enPatinaje[0]);
  await sembrarCompetencias(natacion.id, enNatacion, PRUEBAS_NATACION, [
    ['Festival Departamental de Natación', 'Complejo Acuático', 3],
    ['Copa Aurora', 'Complejo Acuático', 1],
  ]);

  // ── Entrenamientos con marcas ─────────────────────────────────────────────
  const EJERCICIOS = ['Sentadilla', 'Peso muerto', 'Prensa', 'Zancadas', 'Salto al cajón'] as const;
  const NOTAS_ENTRENO = [
    'Sesión completa, sin novedad.',
    'Trabajo de fuerza previo a la válida.',
    'Se bajó el volumen por carga de la semana pasada.',
  ];

  async function sembrarEntrenamientos(
    deporteId: string,
    plantel: Sembrado[],
    sedePista: { id: string },
    sedeGimnasio: { id: string },
    titulosPista: readonly string[],
  ): Promise<void> {
    const elegibles = plantel.filter(m => m.active);
    if (elegibles.length === 0) return;

    for (let atras = 0; atras < 6; atras++) {
      const ref = new Date(Date.UTC(anioActual, hoy.getUTCMonth() - atras, entre(5, 25), 12));
      // Donde se entrena decide qué se mide: en pista se cronometra, en
      // gimnasio se levanta peso. Se alternan para que Rendimiento muestre los
      // dos formularios y no siempre el mismo.
      const enPista = atras % 2 === 0;

      const sesion = await prisma.trainingSession.create({
        data: {
          clubId: club.id,
          deporteId,
          title: enPista ? alguno(titulosPista) : 'Fuerza de piernas',
          date: ref,
          escenario: enPista ? 'PISTA' : 'GIMNASIO',
          locationId: enPista ? sedePista.id : sedeGimnasio.id,
          notes: alguno(NOTAS_ENTRENO),
        },
      });

      const participantes = elegibles.slice(0, Math.min(12, elegibles.length));
      await prisma.trainingResult.createMany({
        data: participantes.map(m => enPista
          ? {
              sessionId: sesion.id,
              memberId: m.id,
              time: tiempo(27, 34),
              distance: '300 m',
              laps: 2,
              observations: alguno(OBSERVACIONES),
            }
          : {
              sessionId: sesion.id,
              memberId: m.id,
              exercise: alguno(EJERCICIOS),
              weight: `${entre(30, 80)} kg`,
              sets: 4,
              reps: entre(6, 12),
              mark: `${entre(30, 80)} kg x ${entre(6, 12)}`,
              observations: alguno(OBSERVACIONES),
            }),
        skipDuplicates: true,
      });
    }
  }

  await sembrarEntrenamientos(patinaje.id, enPatinaje, pistaNorte, pistaCentro, [
    'Control de 300 metros', 'Series de velocidad', 'Fondo en pista',
  ]);
  await sembrarEntrenamientos(natacion.id, enNatacion, piscina, piscina, [
    'Control de 50 libre', 'Series de técnica', 'Fondo continuo',
  ]);
  console.log('Competencias y entrenamientos sembrados en las dos carpetas.');

  // ── Calendario ────────────────────────────────────────────────────────────
  await prisma.calendarEvent.createMany({
    data: [
      {
        clubId: club.id, deporteId: patinaje.id, title: 'Válida Nacional Interclubes',
        type: 'COMPETITION', startDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth() + 1, 12, 12)),
        endDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth() + 1, 14, 12)),
        description: 'Concentración el viernes en la mañana. Llevar uniforme de competencia.',
        locationId: pistaNorte.id,
      },
      {
        clubId: club.id, deporteId: patinaje.id, title: 'Reunión de padres',
        type: 'MEETUP', startDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth(), Math.min(28, hoy.getUTCDate() + 6), 12)),
        description: 'Balance del semestre y calendario de competencias.',
        locationId: pistaCentro.id,
      },
      {
        // Recurrente, para que el calendario muestre también ese caso y no solo
        // eventos sueltos. 1 y 3 son lunes y miércoles.
        clubId: club.id, deporteId: patinaje.id, title: 'Entrenamiento de competencia',
        type: 'TRAINING', startDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth(), 1, 12)),
        endDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth() + 2, 28, 12)),
        recurrence: 'WEEKLY', weekDays: [1, 3], allDay: false,
        locationId: pistaNorte.id,
      },
      {
        clubId: club.id, deporteId: natacion.id, title: 'Festival de natación',
        type: 'COMPETITION', startDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth() + 1, 5, 12)),
        locationId: piscina.id,
      },
      {
        clubId: club.id, deporteId: natacion.id, title: 'Toma de tiempos',
        type: 'TRAINING', startDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth(), Math.min(28, hoy.getUTCDate() + 2), 12)),
        locationId: piscina.id,
      },
    ],
  });

  // ── Suscripción del club ──────────────────────────────────────────────────
  // Al día, para que la demostración no salga con el aviso de vencimiento
  // encima de todo, y con historial de cobros para que esa pantalla tenga qué
  // mostrar.
  const activos = todos.filter(m => m.active).length;
  const suscripcion = await prisma.clubSuscripcion.create({
    data: {
      clubId: club.id,
      planMonto: 450000,
      tipoPlan: 'MENSUAL',
      año: anioActual,
      autoRenew: false,
      picoDeportistas: activos,
      consentimientoPagoAt: dia(anioActual, Math.max(1, mesActual - 5), 3),
    },
  });

  await prisma.suscripcionPago.createMany({
    data: Array.from({ length: 6 }, (_, i) => {
      const atras = 5 - i;
      const ref = new Date(Date.UTC(anioActual, hoy.getUTCMonth() - atras, 3, 12));
      return {
        suscripcionId: suscripcion.id,
        concepto: `Plan mensual — ${MESES[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`,
        monto: 450000,
        fecha: ref,
        estado: 'PAID' as PaymentStatus,
      };
    }),
  });

  // ── Publicaciones ─────────────────────────────────────────────────────────
  // Van las dos clases. Las privadas son del club y salen en Club; las públicas
  // salen en el carrusel de comunidad de Inicio, que sin ellas queda vacío.
  //
  // El muro público cruza clubes, y por eso esto SOLO es aceptable en el
  // entorno de demostración, que tiene su propia base y ningún club real
  // adentro. En producción un club de demostración le aparecería a todo el
  // mundo en su feed.
  const PUBLICACIONES: [string, number, string | null][] = [
    ['Felicitaciones al grupo de competencia por los resultados de la válida departamental. Nos llevamos cuatro podios.', 4, 'Patinódromo de Floridablanca'],
    ['Recordatorio: el sábado el entrenamiento arranca a las 7:00 en el Patinódromo Norte. Llevar hidratación.', 1, null],
    ['Ya está abierta la inscripción para el semestre. El enlace lo encuentran en Miembros, en el botón Importar.', 9, null],
  ];

  const COMENTARIOS = [
    'Muchas gracias por el acompañamiento.',
    '¿A qué hora hay que estar?',
    'Allá estaremos.',
    'Excelente trabajo del equipo.',
  ];

  for (const [contenido, diasAtras, ubicacion] of PUBLICACIONES) {
    const post = await prisma.post.create({
      data: {
        clubId: club.id,
        deporteId: patinaje.id,
        clubName: club.name,
        scope: 'PRIVATE',
        authorClerkId: admin.clerkId,
        authorName: admin.name,
        authorRole: 'ADMIN',
        content: contenido,
        ubicacion,
        createdAt: new Date(Date.now() - diasAtras * 24 * 3600 * 1000),
      },
      select: { id: true },
    });

    // Los «me gusta» y los comentarios van a nombre de deportistas del club,
    // que es de donde salen en la aplicación de verdad. Una publicación sin
    // una sola reacción se ve como un muro muerto.
    const reaccionan = [...enPatinaje].sort(() => azar() - 0.5).slice(0, entre(4, 11));
    await prisma.postLike.createMany({
      data: reaccionan.map(m => ({ postId: post.id, userId: `demo_like_${m.id}` })),
      skipDuplicates: true,
    });

    const comentan = [...enPatinaje].sort(() => azar() - 0.5).slice(0, entre(1, 3));
    await prisma.postComment.createMany({
      data: comentan.map((m, i) => ({
        postId: post.id,
        authorClerkId: `demo_comentario_${m.id}`,
        authorName: m.fullName,
        authorRole: 'DEPORTISTA',
        content: alguno(COMENTARIOS),
        createdAt: new Date(Date.now() - (diasAtras * 24 - (i + 1) * 3) * 3600 * 1000),
      })),
    });
  }

  // ── Publicaciones públicas ────────────────────────────────────────────────
  // Las que salen en el carrusel de comunidad de Inicio.
  const PUBLICAS: [string, number][] = [
    ['Cerramos la válida departamental con cuatro podios. Orgullosos del trabajo de todo el semestre.', 3],
    ['Abiertas las inscripciones para la escuela de formación. Niñas y niños desde los 3 años.', 7],
  ];
  for (const [contenido, diasAtras] of PUBLICAS) {
    const post = await prisma.post.create({
      data: {
        clubId: club.id, deporteId: patinaje.id, clubName: club.name, scope: 'PUBLIC',
        authorClerkId: admin.clerkId, authorName: admin.name, authorRole: 'ADMIN',
        content: contenido, ubicacion: `${CIUDAD}, ${DEPARTAMENTO}`,
        createdAt: new Date(Date.now() - diasAtras * 24 * 3600 * 1000),
      },
      select: { id: true },
    });
    const reaccionan = [...enPatinaje].sort(() => azar() - 0.5).slice(0, entre(8, 20));
    await prisma.postLike.createMany({
      data: reaccionan.map(m => ({ postId: post.id, userId: `demo_like_pub_${m.id}` })),
      skipDuplicates: true,
    });
  }

  // ── Seguidores del club ───────────────────────────────────────────────────
  // El perfil del club muestra el conteo. En cero se lee como un club que nadie
  // sigue, que es lo contrario de lo que se quiere mostrar.
  await prisma.follow.createMany({
    data: todos.slice(0, 34).map(m => ({
      followerClerkId: `demo_seguidor_${m.id}`,
      followingClerkId: `club:${club.id}`,
      createdAt: new Date(Date.now() - entre(1, 200) * 24 * 3600 * 1000),
    })),
    skipDuplicates: true,
  });

  // ── Notificaciones del administrador ──────────────────────────────────────
  // La campana vacía es lo primero que se ve en Inicio. Van dirigidas al
  // `clerkId` del administrador, así que solo tienen efecto cuando se sembró
  // con DEMO_ADMIN_CLERK_ID.
  await prisma.notification.createMany({
    data: [
      {
        recipientClerkId: admin.clerkId, clubId: club.id, tipo: 'NEW_MEMBER',
        titulo: 'Nueva inscripción', cuerpo: 'Tres solicitudes esperan revisión en Miembros.',
        link: '/miembros', leida: false,
        createdAt: new Date(Date.now() - 6 * 3600 * 1000),
      },
      {
        recipientClerkId: admin.clerkId, clubId: club.id, tipo: 'PAYMENT_DUE',
        titulo: 'Mensualidades por cobrar', cuerpo: `Hay ${pendientes} mensualidades sin pagar este mes.`,
        link: '/finanzas', leida: false,
        createdAt: new Date(Date.now() - 26 * 3600 * 1000),
      },
      {
        recipientClerkId: admin.clerkId, clubId: club.id, tipo: 'NEW_COMPETITION',
        titulo: 'Competencia registrada', cuerpo: 'Copa Aurora quedó en el calendario.',
        link: '/logros', leida: true,
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      },
    ],
  });

  console.log('\nListo. El club de demostración quedó sembrado.');
  console.log('Falta a mano: el logo y la portada desde Ajustes, y el sello de verificado desde Superadmin.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
