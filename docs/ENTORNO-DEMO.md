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

## Montarlo

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

## Qué siembra

Un club llamado **Club Deportivo Aurora**, en Bucaramanga, inventado de pies a
cabeza. Nombre, logo y datos no se parecen a ningún club real a propósito: las
piezas salen publicadas y nadie autorizó que su nombre apareciera ahí.

- **Dos deportes**, patinaje y natación, para poder mostrar que un club maneja
  varias disciplinas sin que se le mezclen los datos.
- **Tres sedes** y un horario semanal de ocho clases.
- **54 deportistas**, unos pocos en pausa, con categorías y niveles del catálogo
  real, datos de salud y acudiente.
- **Tres esperando en la bandeja** de inscripción, porque esa pantalla vacía no
  se puede mostrar y es de las que mejor explican el producto.
- **Seis meses de asistencia**, solo en los días que el horario dicta y solo
  desde que cada quien entró al club.
- **Seis meses de mensualidades y caja**, con el mes en curso a medias, que es
  lo normal a mitad de mes y lo que le da algo que mostrar a Finanzas.
- **Tres competencias** con sus pruebas y podios, y seis entrenamientos con
  marcas.
- Calendario, suscripción al día y un par de publicaciones internas.

Dos decisiones que conviene conocer:

- **Los datos son los mismos en cada corrida.** El azar va con semilla fija, así
  que dos pantallazos de la misma pantalla tomados en días distintos cuadran
  entre ellos. Si se quiere otro club, se cambia la semilla.
- **Las publicaciones nacen privadas**, no públicas. El muro público cruza
  clubes y un club de demostración no tiene por qué aparecerle a nadie.

## Lo que queda por fuera y se pone a mano

- **El logo del club**, que se sube desde Ajustes.
- **El sello de verificado.** El club nace sin él, así que no aparece en el
  carrusel de la landing aunque por error compartiera base con producción. Se
  activa desde Superadmin cuando una pieza lo necesite.
- **Las fotos de los deportistas.** Quedan en iniciales sobre el color del rol,
  que además evita poner caras de personas que no existen.

## Volver a empezar

Correr el script otra vez. Borra el club de demostración, buscándolo por su
nombre exacto, y lo vuelve a crear. Nunca hace una limpieza general de la base.
