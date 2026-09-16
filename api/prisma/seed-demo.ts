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
      name: 'Carolina Estrada',
      role: 'ADMIN',
      profileComplete: true,
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
        name: 'Andrés Cardona',
        role: 'ENTRENADOR',
        profileComplete: true,
        clubId: club.id,
        deporteId: patinaje.id,
      },
      {
        clerkId: `demo_entrenador_2_${club.id}`,
        email: 'entrenadora.natacion@example.com',
        name: 'Paola Rincón',
        role: 'ENTRENADOR',
        profileComplete: true,
        clubId: club.id,
        deporteId: natacion.id,
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

      // La edad decide la categoría: no tendría sentido un niño de seis años
      // marcado como mayor de catorce.
      const edad = entre(5, 17);
      const category = edad <= 10 ? CATEGORIAS[0] : edad <= 13 ? CATEGORIAS[1] : CATEGORIAS[2];
      const nivel = edad <= 10 ? alguno(['Escuela', 'Novatos'] as const) : alguno(NIVELES.slice(1, 5));

      // Casi todos entraron hace tiempo; unos pocos son recientes, para que la
      // gráfica de crecimiento tenga escalones y no una recta.
      const desdeMes = conProbabilidad(0.8) ? entre(6, 30) : entre(0, 5);

      // En pausa: los que se van en vacaciones. Es un estado real del producto
      // y conviene que se vea en los pantallazos.
      const active = !conProbabilidad(0.08);

      const sede = sedes[i % sedes.length];
      const menor = edad < 18;

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
          paymentDueDay: alguno([1, 5, 10, 15] as const),
          monthlyFee: cuota,
          role: 'DEPORTISTA',
          active,
          desactivadoAt: active ? null : dia(anioActual, mesActual, 3),
          inscripcion: 'APROBADO',
          origen: conProbabilidad(0.35) ? 'FORMULARIO' : 'MANUAL',
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
        paymentDueDay: alguno([1, 5, 10, 15] as const),
        active,
        desdeMes,
      });
    }

    return salida;
  }

  const enPatinaje = await sembrarDeportistas(patinaje.id, [pistaNorte, pistaCentro], 38, 95000, 1);
  const enNatacion = await sembrarDeportistas(natacion.id, [piscina], 16, 110000, 100);
  const todos = [...enPatinaje, ...enNatacion];
  console.log(`Deportistas: ${enPatinaje.length} en patinaje, ${enNatacion.length} en natación.`);

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
      const paidAt = pagado ? dia(anio, mes, Math.min(28, m.paymentDueDay + entre(0, 4))) : null;

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
  const competidores = enPatinaje.filter(m => m.active && m.category !== CATEGORIAS[0]).slice(0, 14);

  const COMPETENCIAS: [string, string, number][] = [
    ['Válida Departamental', 'Patinódromo de Floridablanca', 4],
    ['Copa Ciudad de Bucaramanga', 'Patinódromo Norte', 2],
    ['Interclubes de Santander', 'Coliseo Centro', 1],
  ];

  for (const [nombre, lugar, mesesAtras] of COMPETENCIAS) {
    const ref = new Date(Date.UTC(anioActual, hoy.getUTCMonth() - mesesAtras, entre(8, 24), 12));
    const competencia = await prisma.competition.create({
      data: { clubId: club.id, deporteId: patinaje.id, name: nombre, place: lugar, date: ref },
    });

    for (const prueba of ['300 metros contrarreloj', '500 metros más distancia', '1000 metros']) {
      const evento = await prisma.competitionEvent.create({
        data: { competitionId: competencia.id, name: prueba },
      });

      // Ocho por prueba, y las posiciones se reparten sin repetirse: dos
      // primeros puestos en la misma carrera se ven de una vez como un error.
      const participantes = [...competidores].sort(() => azar() - 0.5).slice(0, 8);
      const puestos = Array.from({ length: participantes.length }, (_, i) => i + 1);

      await prisma.eventResult.createMany({
        data: participantes.map((m, i) => ({
          eventId: evento.id,
          memberId: m.id,
          position: puestos[i],
          category: m.category,
        })),
        skipDuplicates: true,
      });
    }
  }

  // ── Entrenamientos con marcas ─────────────────────────────────────────────
  for (let atras = 0; atras < 6; atras++) {
    const ref = new Date(Date.UTC(anioActual, hoy.getUTCMonth() - atras, entre(5, 25), 12));
    const enPista = atras % 2 === 0;

    const sesion = await prisma.trainingSession.create({
      data: {
        clubId: club.id,
        deporteId: patinaje.id,
        title: enPista ? 'Control de 300 metros' : 'Fuerza de piernas',
        date: ref,
        escenario: enPista ? 'PISTA' : 'GIMNASIO',
        locationId: enPista ? pistaNorte.id : pistaCentro.id,
      },
    });

    const participantes = competidores.slice(0, 10);
    await prisma.trainingResult.createMany({
      data: participantes.map(m => enPista
        ? {
            sessionId: sesion.id,
            memberId: m.id,
            time: `${entre(27, 32)}.${String(entre(0, 99)).padStart(2, '0')}`,
            distance: '300 m',
            laps: 2,
          }
        : {
            sessionId: sesion.id,
            memberId: m.id,
            exercise: alguno(['Sentadilla', 'Peso muerto', 'Prensa'] as const),
            weight: `${entre(30, 80)} kg`,
            sets: 4,
            reps: entre(6, 12),
          }),
      skipDuplicates: true,
    });
  }

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
        clubId: club.id, deporteId: natacion.id, title: 'Festival de natación',
        type: 'COMPETITION', startDate: new Date(Date.UTC(anioActual, hoy.getUTCMonth() + 1, 5, 12)),
        locationId: piscina.id,
      },
    ],
  });

  // ── Suscripción del club ──────────────────────────────────────────────────
  // Al día, para que la demostración no salga con el aviso de vencimiento
  // encima de todo.
  await prisma.clubSuscripcion.create({
    data: {
      clubId: club.id,
      planMonto: 450000,
      tipoPlan: 'MENSUAL',
      año: anioActual,
      autoRenew: false,
      picoDeportistas: todos.filter(m => m.active).length,
    },
  });

  // ── Publicaciones ─────────────────────────────────────────────────────────
  // Privadas del club, no públicas: el muro público cruza clubes, y un club de
  // demostración no tiene por qué aparecerle a nadie más.
  await prisma.post.createMany({
    data: [
      {
        clubId: club.id, deporteId: patinaje.id, clubName: club.name, scope: 'PRIVATE',
        authorClerkId: admin.clerkId, authorName: admin.name, authorRole: 'ADMIN',
        content: 'Felicitaciones al grupo de competencia por los resultados de la válida departamental. Nos llevamos cuatro podios.',
        createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      },
      {
        clubId: club.id, deporteId: patinaje.id, clubName: club.name, scope: 'PRIVATE',
        authorClerkId: admin.clerkId, authorName: admin.name, authorRole: 'ADMIN',
        content: 'Recordatorio: el sábado el entrenamiento arranca a las 7:00 en el Patinódromo Norte. Llevar hidratación.',
        createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      },
    ],
  });

  console.log('\nListo. El club de demostración quedó sembrado.');
  console.log('El sello de verificado se pone a mano desde Superadmin si la pieza lo necesita.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
