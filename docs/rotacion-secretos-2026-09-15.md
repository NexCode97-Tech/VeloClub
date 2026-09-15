# Rotación de secretos, 15 de septiembre de 2026

## Qué pasó

El proyecto `nex-code97` de Vercel, el del portafolio, tenía pegado el entorno
completo de Railway de la API de VeloClub. 62 variables, de las cuales 56 eran
tipo `Config`, o sea texto plano legible desde el panel y desde la API de
Vercel. No estaban expuestas al navegador, porque ninguna lleva el prefijo
`NEXT_PUBLIC_`, pero sí a cualquiera con acceso a ese proyecto.

Las más viejas llevaban ahí 139 días.

El 15 de septiembre se borró el grupo de infraestructura, 15 nombres en Preview
y Production. Ver «Lo que ya se hizo».

## Por qué rotar y no solo borrar

Borrar la copia cierra la puerta de ahora en adelante. No deshace los cuatro
meses en que el valor estuvo legible. Un secreto que estuvo expuesto sigue
siendo válido hasta que se cambia, así que la copia y el valor son dos
problemas distintos y hay que cerrar los dos.

## Lo que ya se hizo

Borradas de `nex-code97`, en Preview y en Production:

`REDIS_URL`, `REDIS_PUBLIC_URL`, `REDIS_PASSWORD`, `REDISPASSWORD`,
`REDISUSER`, `REDISPORT`, `REDISHOST`, `DATABASE_PUBLIC_URL`, `POSTGRES_DB`,
`PGPORT`, `PGDATA`, `SSL_CERT_DAYS`, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`,
`NODE_ENV`, `PORT`.

Los primeros trece los inyecta Railway y en Vercel no los lee nadie. `NODE_ENV`
y `PORT` los pone Vercel por su cuenta, y pisar `NODE_ENV` a mano rompe builds.

El proyecto `veloclub` de Vercel está limpio. Seis variables, todas cifradas,
todas usadas por el código.

## Lo que falta borrar

Trece nombres que siguen en `nex-code97` en texto plano, todos copia del
entorno de la API. Se confirmó que la API los lee y que el portafolio no los
menciona en el HTML que sirve, pero **antes de borrarlos hay que revisar el
código del portafolio**, porque despliega con raíz `web` y es una app de
Next.js con middleware y funciones, y esa carpeta no está en el repo local
`GitHub\NexCode97`.

`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`, `MP_ACCESS_TOKEN`,
`MP_WEBHOOK_SECRET`, `BREB_LLAVE`, `BREB_TITULAR`, `RESET_SECRET`,
`WEB_ORIGIN`, `SUPERADMIN_EMAILS`, `SENTRY_DSN`.

`RESET_SECRET` ya no lo lee nadie. No aparece en `api/src`, así que se borra y
no se rota.

## Qué se rota y qué no

No todo lo expuesto es un secreto. Estos son públicos por diseño y no se tocan:

| Variable | Por qué no se rota |
|---|---|
| `CLERK_PUBLISHABLE_KEY` | Va al navegador en cualquier app de Clerk |
| `CLOUDINARY_CLOUD_NAME` | Es el nombre de la cuenta, va en cada URL de imagen |
| `SENTRY_DSN` | Va en el bundle del cliente, Sentry lo da por público |
| `WEB_ORIGIN` | Es el dominio del frontend |
| `SUPERADMIN_EMAILS` | Son correos, no credenciales |
| `BREB_TITULAR` | Es el nombre del titular de la cuenta |

Se rotan estos seis, en este orden.

### 1. `RESET_SECRET`, borrar

Nadie lo lee. Se borra de Vercel y de Railway y se acabó. Sin riesgo.

### 2. `MP_WEBHOOK_SECRET` y `MP_ACCESS_TOKEN`

Los primeros porque son los que mueven plata. En el panel de Mercado Pago, en
las credenciales de producción de la aplicación, se regeneran.

Ojo, el token de producción de Mercado Pago **no convive con el anterior**: al
regenerarlo el viejo muere de inmediato. Así que el cambio en Railway va justo
detrás, y entre una cosa y la otra los cobros fallan. Hacerlo en una franja de
poco movimiento.

El `MP_WEBHOOK_SECRET` se cambia en la configuración de notificaciones. Mientras
no coincida, los webhooks entrantes se rechazan por firma, y Mercado Pago
reintenta, así que eso sí se recupera solo.

### 3. `BREB_LLAVE`

Es la llave de la cuenta Bre-B. Se cambia donde esté emitida y se actualiza en
Railway. Revisar de paso que `BREB_TITULAR` siga cuadrando con ella.

### 4. `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`

Van en pareja, no se puede rotar una sola. Cloudinary permite tener varias
llaves activas a la vez, así que aquí sí se puede hacer sin corte: se crea la
nueva, se actualiza Railway, se comprueba que suban fotos, y solo entonces se
borra la vieja.

### 5. `CLERK_SECRET_KEY`

La más delicada, porque **está en dos sitios**: Railway, para la API, y Vercel
en el proyecto `veloclub`, para el servidor de Next. Los dos apuntan a la misma
instancia de Clerk, así que hay que cambiarlos juntos o la mitad de la
plataforma deja de autenticar.

Verificar primero en el panel de Clerk si la instancia admite dos claves
secretas vivas al mismo tiempo. Si admite, se crea la nueva, se actualizan los
dos sitios y después se revoca la vieja, sin corte. Si no admite, el cambio
tiene una ventana de caída y toca de madrugada.

### 6. La base y Redis, en Railway

`REDIS_PASSWORD`, `REDIS_URL` y `DATABASE_PUBLIC_URL` también estuvieron
expuestas. Borrarlas de Vercel no cambia que las credenciales siguen siendo las
mismas.

Como son servicios internos de Railway y no están abiertos a internet, el
riesgo es menor que el de los anteriores, pero `DATABASE_PUBLIC_URL` es
justamente la que sí llega desde afuera. Rotar esa contraseña desde el panel
del servicio de Postgres, y la de Redis igual. Railway reinicia el servicio y
propaga la nueva URL a la API sola.

Si no se va a rotar, lo mínimo es confirmar que el puerto público de Postgres
esté cerrado.

## Después de rotar

- `railway logs` de la API, que arranque sin errores de conexión.
- Entrar a la plataforma y comprobar sesión, una subida de foto y un cobro.
- Revisar Sentry, que no aparezcan errores nuevos de autenticación.
