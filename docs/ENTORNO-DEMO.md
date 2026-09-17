# Entorno de demostración

Una copia de VeloClub con su propia base, separada de producción, con un club
inventado adentro. Sirve para dos cosas:

- **Mostrar la plataforma por fuera** sin usar datos de clientes reales, ni en
  publicaciones ni en una demostración en vivo a un club interesado.
- **Probar antes de producción.** Hoy cada cambio se verifica en lo que están
  usando los clubes, porque no hay otro sitio donde mirarlo.

## Por qué aparte y no un club marcado dentro de producción

Cuatro cosas cruzan clubes a propósito: el muro de la comunidad, los perfiles,
el buscador y los seguidores. Están declaradas con `clubEntero` en
`api/src/index.ts`. Un club de demostración dentro de producción **les
aparecería a los clubes reales** en su feed y en su búsqueda, y habría que
excluirlo a mano de esos cuatro sitios más el carrusel de la landing, los
conteos del superadmin y la facturación. Son siete sitios que hay que acordarse
de mantener, y al octavo que alguien agregue el club falso se cuela en una cifra
de negocio o en la pantalla de un cliente.

El aislamiento por `clubId` funciona y no es lo que está en duda. El problema es
al revés: no que el demo vea datos ajenos, sino que los ajenos lo vean a él.

---

## Lo que ya está montado

Montado el 16 de septiembre de 2026. La siembra corrió a la primera.

| Pieza | Dónde |
|---|---|
| Web | `https://demo.veloclubtech.com`, rama `demo` del proyecto `veloclub` en Vercel |
| API | `https://api-demo-demo-d17d.up.railway.app`, servicio `api-demo` del entorno `demo` en Railway |
| Base | `Postgres-7gHC`, entorno `demo` |
| Redis | `Redis-mgS2`, entorno `demo` |
| Clerk | Aplicación **VeloClub Demo**, instancia de desarrollo |

Cuentas para entrar:

| Rol | Correo |
|---|---|
| Administradora | `admin@demo.veloclubtech.com` |
| Deportista | `deportista@demo.veloclubtech.com` |

Las contraseñas no van en el repo.

### Tres cosas que se aprendieron montándolo

- **Railway ya no deja amarrar `railway.toml` a un servicio nuevo.** Producción
  lo sigue leyendo porque es anterior al cambio, pero `api-demo` no, y el primer
  despliegue arrancó sin tablas. El comando de migración quedó puesto
  directamente en el servicio. Si se crea otro servicio, hay que ponérselo igual.
- **Las variables de Vercel se amarran a la rama.** Las de vista previa
  generales apuntan a producción; las de `demo` tienen prioridad solo en esa
  rama. Si se agrega una variable nueva a la web, hay que decidir si la demo la
  necesita.
- **Vercel protege los despliegues que no tienen dominio propio.** Por eso la
  demo va en `demo.veloclubtech.com` y no en la dirección larga de la rama.

### Actualizar la demo con lo último

```bash
git checkout demo && git merge main && git push origin demo
```

Railway y Vercel despliegan solos.

---

## Montarlo desde cero

### 1. La base y la API, en Railway

Railway maneja entornos dentro del mismo proyecto. Se crea uno nuevo llamado
`demo` y ahí dentro van su propio Postgres y su propia instancia de la API.

Lo que cambia frente a producción, en las variables del servicio:

| Variable | Valor en demo |
|---|---|
| `DATABASE_URL` | la del Postgres del entorno demo |
| `WEB_ORIGIN` | el dominio del despliegue de la rama en Vercel |
| `CLERK_SECRET_KEY` | la de la instancia de desarrollo de Clerk |
| `CLERK_PUBLISHABLE_KEY` | la de la instancia de desarrollo de Clerk |
| `CLOUDINARY_*` | se pueden repetir las de producción, o una carpeta aparte |

Las migraciones se aplican solas: `api/railway.toml` corre
`npx prisma migrate deploy` como `preDeployCommand`, igual que en producción.

**No repetir los secretos de Mercado Pago.** Un entorno de demostración no cobra
nada, y dejar ahí una llave de producción es la forma más fácil de que se
escape.

### 2. El frontend, en Vercel

Una rama `demo` en el repo. Vercel la despliega sola con su propia dirección.
En las variables de ese despliegue:

- `NEXT_PUBLIC_API_URL` apuntando a la API del entorno demo.
- Las llaves de Clerk de la instancia de desarrollo.

### 3. Clerk

La instancia de desarrollo, que es gratis y funciona sobre el dominio de
Vercel. Ahí se crea el usuario con el que se entra a la demostración.

### 4. Sembrar los datos

```bash
cd api
ENTORNO_DEMO=si npm run seed:demo
```

El script es `api/prisma/seed-demo.ts`. Se niega a arrancar sin esa variable, y
antes de sembrar imprime a qué base está apuntando, sin la contraseña. Esa línea
es la última oportunidad de frenar si el `DATABASE_URL` quedó apuntando al lado
equivocado.

Para poder **entrar** a la demostración, el usuario administrador tiene que
existir en Clerk y el club tiene que apuntar a él:

```bash
DEMO_ADMIN_CLERK_ID=user_xxx DEMO_ADMIN_EMAIL=tucorreo@ejemplo.com \
ENTORNO_DEMO=si npm run seed:demo
```

Sin esas dos, el administrador queda de adorno: se ve en las pantallas pero
nadie inicia sesión con él.

---

## Qué siembra, módulo por módulo

Un club llamado **Club Deportivo Aurora**, en Bucaramanga, inventado de pies a
cabeza. Nombre y datos no se parecen a ningún club real a propósito: las piezas
salen publicadas y nadie autorizó que su nombre apareciera ahí.

La lista está por módulo y no por tabla, porque lo que importa es que **ninguna
pantalla quede vacía**. Una pantalla vacía en un pantallazo no vende nada.

| Módulo | Qué tiene |
|---|---|
| **Inicio** | Las tres cifras del resumen, próximos eventos, tres cumpleaños dentro de la quincena, avisos de mensualidades por cobrar, dos publicaciones en el carrusel de comunidad y tres notificaciones en la campana |
| **Miembros** | 54 deportistas y 5 fichas de staff, dos administradores y tres entrenadores, para que las cuatro cifras de arriba tengan número. Tres inscripciones esperando y una corrección de datos en la bandeja |
| **Asistencia** | Seis meses, solo en los días que el horario dicta y solo desde que cada quien entró al club |
| **Finanzas** | Seis meses de mensualidades con el mes en curso a medias, y una caja con mensualidades, venta de uniformes, inscripciones, una devolución y cinco gastos mensuales |
| **Rendimiento** | Tres competencias en patinaje y dos en natación, con pruebas, podios y la marca en la observación. Seis entrenamientos por deporte, alternando pista y gimnasio |
| **Calendario** | Competencias, una reunión, una toma de tiempos y un entrenamiento recurrente los lunes y miércoles |
| **Analíticas** | Sale de lo anterior. Con seis meses de historia las gráficas tienen curva en vez de una línea plana |
| **Sedes** | Tres, con dirección y coordenadas |
| **Club** | Descripción, contacto, fecha de fundación, tres publicaciones internas con «me gusta» y comentarios, y 34 seguidores |
| **Ajustes** | Horario semanal de ocho clases, dos deportes con su enlace de inscripción, colores del club, y la suscripción al día con seis cobros de historial |
| **Mi perfil** | Biografía y datos del administrador y de los entrenadores |
| **Carnet y Mis pagos** | Salen de la ficha del deportista y de sus mensualidades, así que quedan llenos solos |

Dos decisiones que conviene conocer:

- **Los datos son los mismos en cada corrida.** El azar va con semilla fija, así
  que dos pantallazos de la misma pantalla tomados en días distintos cuadran
  entre ellos. Si se quiere otro club, se cambia la semilla.
- **Hay publicaciones públicas.** El muro público cruza clubes, así que esto
  **solo** es aceptable acá, donde la base es propia y no hay ningún club real
  adentro. En producción ese club le aparecería a todo el mundo en su feed.

## Para ver la mitad del deportista

La plataforma tiene dos caras y la del deportista también se muestra: Mi carnet,
Mis pagos y su propio rendimiento. Para entrar como deportista hace falta una
cuenta de Clerk amarrada a una ficha:

```bash
DEMO_ADMIN_CLERK_ID=user_xxx DEMO_ADMIN_EMAIL=tucorreo@ejemplo.com DEMO_DEPORTISTA_CLERK_ID=user_yyy DEMO_DEPORTISTA_EMAIL=otro@ejemplo.com ENTORNO_DEMO=si npm run seed:demo
```

## Lo que queda por fuera y se pone a mano

Son las tres cosas que el script no puede inventar.

- **El logo y la portada del club**, que se suben desde Ajustes y desde Club.
- **Las fotos de los deportistas y los documentos adjuntos.** Son archivos de
  Cloudinary y una dirección inventada queda como imagen rota. Los deportistas
  se ven con sus iniciales sobre el color del rol, que además evita ponerle cara
  a personas que no existen.
- **El sello de verificado.** El club nace sin él, así que no aparece en el
  carrusel de la landing aunque por error compartiera base con producción. Se
  activa desde Superadmin cuando una pieza lo necesite.

## Volver a empezar

Correr el script otra vez. Borra el club de demostración, buscándolo por su
nombre exacto, y lo vuelve a crear. Nunca hace una limpieza general de la base.
