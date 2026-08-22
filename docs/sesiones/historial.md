# Historial de Sesiones — VeloClub

Registro cronológico de lo trabajado en cada sesión con Claude Code.
Actualizar al final de cada sesión o cuando se complete un bloque de trabajo importante.

---

## Sesión 2026-08-20 a 2026-08-22

**Modelo:** Claude Opus 5
**Estado inicial:** `e3c1918`, rama `main`
**Estado final:** `1adc660`, todo desplegado

El problema de arranque: varios clubes no tenían la lista de sus deportistas en
Excel, así que cargarlos era pedirle a alguien del club que escribiera cuarenta
fichas a mano. De ahí salió la inscripción por enlace, y de probarla salió todo
lo demás.

### Cierre de la sesión anterior

Cinco commits del 19 de agosto que quedaron fuera del registro pasado:

- Fuera el guion largo de los textos que ve el usuario, y Bre-B sin renovación
  automática: la llave receptora no puede cobrar sola.
- El pago en verificación salió de la pestaña de Bre-B. Vivía dentro de ella,
  así que cambiar de medio de pago escondía el aviso de que había un pago
  esperando.
- Bre-B avisa que solo funciona entre cuentas de Colombia.

### Inscripción por enlace

Cada club comparte una url y el deportista llena sus propios datos. Cuatro pasos
en vez de una pantalla de veinte campos: lo abre alguien que no conoce la app,
casi siempre desde el celular, y un formulario largo se abandona a la mitad.

- Token aleatorio de 10 caracteres (~49 bits) sobre un alfabeto sin letras que
  se confundan al dictarlo por teléfono. **No derivado del nombre del club**: con
  una url adivinable, cualquiera encontraría el formulario de cualquier club.
- Un club que no existe, uno cerrado y uno vencido responden lo mismo, para que
  un enlace viejo no confirme que el club existe.
- Lo que entra queda en `PENDIENTE` y no cuenta para la facturación hasta que el
  club apruebe.
- **Un envío es un deportista.** No hay «agregar otro hijo»: cada uno necesita su
  perfil, su correo y su cuenta. Decisión explícita del usuario, aunque implique
  que dos de tres hermanos queden sin acceso hasta tener correo propio.

### Actualizar por el mismo enlace

Quien ya está en el club y vuelve a abrirlo entra a completar su ficha, no a
inscribirse de cero. Los cambios quedan en `cambiosPendientes` y el club los
aprueba campo por campo, con lo viejo tachado y lo nuevo en verde.

**La llave es el documento solo.** Primero se pedía documento más fecha de
nacimiento, y ahí se cayó todo: **371 de 1.550 fichas no tienen fecha guardada**
(150 en Alianza, 44 en THE HOPE, 40 en LANDI). A una de cada cuatro personas le
salía «ese documento ya está registrado y los datos no coinciden», sin salida.

El usuario decidió que el documento es la identificación de la persona y alcanza
solo. Con eso:

- El documento **no está** → inscripción normal.
- **Está una vez** → se le devuelve su ficha precargada y editable, con lo vacío
  marcado «Falta» y un contador de cuántos datos le quedan. Ahí corrige el correo
  de relleno que le pusieron.
- **Está en dos o más fichas** → no se puede saber cuál es, así que sigue como
  inscripción nueva y al club le llega marcada «Revisar».

Ese último caso es real: **10 documentos repetidos, 73 fichas**. `VELOPRO` en 38
deportistas de Bont Skate, `123456789` en 17, y hermanas de Alianza con la misma
cédula copiada.

### Las cuentas

Quien no tiene cuenta la crea al enviar, pero el `clerkId` y el correo solo se
pegan a la ficha cuando el club aprueba: antes de eso la cuenta existe y no
lleva a ningún lado. Si el club descarta, se borra en Clerk.

Antes de esto había un hueco: **155 deportistas sin correo ni cuenta** llenaban
el formulario completo, elegían contraseña, y el backend guardaba el correo como
cambio pendiente y botaba la contraseña. Nunca quedaban con acceso.

Quien ya tenía cuenta y cambia su correo lo ve moverse también en Clerk, que es
donde inicia sesión.

### La bandeja del club

Pasó de tarjetas apiladas a lista: una fila por persona, casillas para aceptar
en lote y el detalle al tocar. Con cuarenta inscripciones de un día para otro,
la ficha entera de cada una no dejaba ver ni la tercera. El lote va una por una
y no en paralelo, porque veinte peticiones simultáneas chocan con el límite.

### El enlace con vencimiento

Campo `inscripcionVenceAt` opcional. Corta al final de ese día en hora de
Colombia, no al empezarlo. **El token no cambia al vencer**: al reabrirlo vale el
mismo enlace y el club no tiene que repartirlo otra vez.

Se descartó rotar el enlace automáticamente al copiarlo: copiar es el uso normal,
y el segundo copiar mataría el enlace que ya está en el grupo de WhatsApp.

### Desplegables y filtros

- **Ningún `select` nativo queda en el proyecto.** Se ve bien cerrado, pero al
  abrirlo el navegador pinta su lista con Arial y el azul de sistema. El nuevo va
  en portal a `document.body` con la posición calculada desde el disparador, para
  que no lo recorte un contenedor con overflow ni lo tape un modal. En pantalla
  angosta sube desde abajo. Se cambiaron también los tres del flujo de pago
  (banco de PSE, tipo de persona, documento), que son los peores para dejar
  crudos porque salen mientras alguien paga.
- Los filtros sueltos pasaron a un control. En Miembros eran cuatro y empujaban
  Importar, PDF y Nuevo miembro a un segundo renglón; en el celular no existían
  del todo. Cada opción trae su conteo, calculado sobre los que pasan todos los
  demás filtros menos el suyo.
- En el celular la búsqueda, la sede y los filtros van en una fila, con los dos
  botones en puro ícono. El nombre de la sede baja a una línea de texto plano:
  cuesta 18 píxeles en vez de los 50 de un renglón, y sin él nadie sabría en qué
  sede está marcando asistencia.

### Cambios en la base

| Migración | Qué agrega |
|---|---|
| `20260820140000_inscripcion_por_enlace` | token, abierta, esperados, origen, estado, `cambiosPendientes` |
| `20260821100000_genero_y_salud` | `gender`, `rh`, `allergies` |
| `20260821120000_actualizar_por_enlace` | parentesco y cédula del acudiente |
| `20260821150000_vencimiento_del_enlace` | `inscripcionVenceAt` |

Las restricciones de unicidad sobre `docNumber` siguen **sin declarar**, a
propósito: con 73 fichas de documento repetido, crearlas ahora fallaría.

### Decisiones del usuario

- Los datos viejos mal creados **se omiten**. Las reglas nuevas son para lo que
  entre de ahora en adelante.
- El número de documento es privado y alcanza como identificación. La ficha
  precargada se muestra con solo ese dato, asumido y explicado.
- Ningún desplegable puede quedar con la lista nativa. Regla permanente.

### Pendiente

- **Las sedes no son sedes.** Los clubes usan `Location` como grupo o nivel:
  *NIVEL I*, *ESCUELA ADULTOS*, *MAYORES*, *PITUFITOS*, *MARTES JUEVES AM*. Solo
  4 de 18 clubes tienen una sola. La palabra ya no describe lo que hacen con eso
  y compite con `category` y con las clases del horario. **Aplazado a futuro** por
  decisión del usuario.
- Confirmar tarifas reales de Wompi y Bold con un asesor.
- El riesgo de recibir el dinero de Bre-B en una cuenta personal.
- Los tres espacios de publicidad siguen en `url: '#'`.
- Dos lockfiles en el repositorio.
- `payments.test.ts` tiene 2 pruebas en rojo, anteriores a esta sesión.

---

## Sesión 2026-08-19

**Modelo:** Claude Opus 5
**Estado inicial:** `ef3e2e6`, rama `main`, app en producción
**Estado final:** `e3c1918`, todo desplegado

Sesión disparada por un cliente que no podía pagar. De ahí salió casi todo lo
demás: un medio de pago nuevo, el registro de los rechazos y dos fallos de
fondo que llevaban meses invisibles.

### El pago que no entraba — Bont Skate Santander

Cinco intentos rechazados, no tres. Todos por **PSE contra Nequi**, todos con
`bank_error`, todos por $162.000. El detalle del pago en Mercado Pago confirma
que la transacción se creaba bien (con su `transaction_id` y su URL al banco):
lo que fallaba era el banco, no nuestros datos ni el monto.

Hubo que consultarle a la API de Mercado Pago con credenciales de producción
para saberlo, porque **el backend no guardaba los rechazos** — ver más abajo.

- [x] **Pago registrado a mano** ($162.000, concepto `Bre-B · VC-8O9O`). El
  trimestre arranca el 6 de octubre y no el día del pago: el club seguía en
  período de prueba y `fechaEfectivaPago` respeta los días gratis prometidos.
  Se usó `activarClubTrasPago`, no escritura directa, para que el registro
  quedara idéntico a uno del flujo normal.

### Pago por Bre-B, con verificación humana

Cuarto medio junto a Tarjeta, PSE y Efecty. Nace de este caso: PSE se cae y no
había ningún camino dentro del producto para cobrarle a ese club.

Bre-B mueve el dinero en segundos y sin comisión, pero **la llave receptora es
una cuenta común: no emite webhooks**. Nadie puede avisarle al sistema que la
plata entró, así que este medio no se acredita solo.

- [x] El club ve la llave, el titular, el monto y una referencia derivada de su
  `clubId` — estable, visible **antes** de transferir y que no cambia si
  reintenta.
- [x] Sube el comprobante y el pago nace `PENDING` **sin fecha**. La fecha es lo
  que usa `vigencia()` para contar el período: ponerla antes de verificar le
  regalaría el plan a cualquiera que suba una imagen.
- [x] El aviso de la demora va **antes** de que transfiera. Enterarse de que hay
  que esperar cuando uno ya pagó es lo que genera el "me cobraron y no me
  activaron".
- [x] Bandeja en el panel de superadmin, no en una pantalla aparte: es trabajo
  que caduca, hay un club esperando la activación.
- [x] Un pendiente a la vez. Rechazar borra el registro (para que pueda volver a
  intentar) y el borrado queda en la bitácora.
- [x] Sin cupones: el canje se registraría al enviar el comprobante y un pago que
  luego no se verifica dejaría el cupón quemado sin contraprestación.
- [x] `BREB_LLAVE` y `BREB_TITULAR` en Railway. La llave es un dato personal y
  puede cambiar: no va en el código ni en el historial de git.

Sin migración — `SuscripcionPago` ya tenía `estado`, `receiptUrl` y `concepto`.

**Riesgo abierto:** la plata entra a una cuenta personal, no empresarial. El
cliente ve un nombre propio en vez de una razón social. Conviene revisarlo con
un contador ahora que está disponible para todos los clubes.

### Los rechazos de pago ya no se pierden

El hueco que obligó a la investigación manual: `/pagar` respondía el error y ahí
moría. Sin fila en la base, sin Sentry, sin log.

- [x] Cada rechazo queda en la bitácora con medio, motivo, monto y —en PSE— el
  **banco**, que es el dato que resuelve el caso.
- [x] `registrarEvento()` en `lib/auditoria.ts`: la extensión de Prisma solo ve
  escrituras, y un rechazo importa justamente porque nada cambió.
- [x] El panel de superadmin muestra los de 7 días y **marca a quien lleva 3 o
  más intentos**. Un club que reintenta y falla es una venta a punto de
  perderse, no una estadística.
- [x] **Faltaban todos los mensajes de PSE.** Su rechazo más común (`bank_error`)
  caía en el genérico "intenta con otro medio", que no dice lo único que
  resuelve el problema: que cambiando de banco el pago pasa. Por eso el club
  insistió cinco veces contra el mismo banco.

### Los pagos de suscripción nunca se auditaron

La lista de modelos auditados decía `PagoSuscripcion`; el modelo se llama
`SuscripcionPago`. **Un nombre que no coincide no falla: esa entidad queda
fuera, en silencio.** El dinero de la plataforma llevaba desde el primer día
sin registrarse mientras la bitácora aparentaba cubrirlo.

- [x] Corregido, y se contrasta la lista contra `Prisma.dmmf` al cargar el
  módulo: el error era invisible por definición y solo aparecía leyendo las dos
  listas en paralelo.
- [x] Cierra además los PSE abandonados: la reconciliación los borra cuando
  Mercado Pago los da por rechazados, y ese borrado ya queda con copia.

### Interfaz

- [x] **Cronómetro en el hero** en lugar de la pastilla con el punto que late:
  esa forma es la más repetida del software actual y se leía como plantilla
  antes de que alguien alcanzara a leer las palabras, además de repetir lo que
  el titular ya dice en 52px. El cronómetro sale del mundo del cliente y baja
  solo. `web/lib/promo.ts` espeja `PROMO_FIN` del backend — si el frontend
  anunciara un día más, alguien se registraría creyendo en 60 días y recibiría
  15. Vencida la promoción no se pinta nada.
  *Correcciones sobre la marcha:* fuera la monoespaciada (no combina con el
  titular) y fuera el uppercase — en la interfaz no se grita.
- [x] **Feed sin interacciones.** El espacio bajo el texto y el anclaje al fondo
  en escritorio vivían los dos en el bloque de contadores; un post sin likes ni
  comentarios no lo renderizaba y perdía las dos cosas de golpe. Ahora el
  contenedor se pinta siempre y lo condicional son los botones.
- [x] **Sub-menú de Ajustes con el sidebar comprimido.** Solo aparecía expandido,
  así que quien trabaja con el sidebar angosto no tenía por dónde llegar a Mi
  club ni a Mi suscripción. Mismo arreglo en Rendimiento.
- [x] **Logo de la tarjeta de Finanzas** de 56 a 44 px, incluido el de respaldo.
- [x] Sede: el logo de VeloClub y el del club conservan su tratamiento distinto.

### Nombre del usuario — tres copias, dos lugares de edición

Un administrador figuraba en el sidebar como "ADMINISTRADOR VELOCLUB" (su
nombre en Clerk) mientras Miembros, el feed y Mi perfil lo llamaban por su
nombre real.

- [x] **Gana el lado donde de verdad lo cambiaron.** La señal es comparar Clerk
  contra la última copia guardada en `User`: si difieren, la edición fue en
  Clerk; si coinciden, manda el registro de miembro. Con una regla fija uno de
  los dos caminos siempre perdía.
- [x] El nombre baja también a **publicaciones y comentarios**, filtrando por
  `authorClerkId` y no por nombre (dos personas del mismo club pueden llamarse
  igual). Se hace en `PATCH /me/name` además de en `/me`, porque para cuando
  `/me` vuelva a correr ya no queda señal de que hubo un cambio que propagar.

### Cuentas y permisos

- [x] **`/me` buscaba el registro de miembro solo por correo** al crear la
  cuenta. Un miembro ya vinculado sin `User` caía en `needs_onboarding` y
  terminaba creándose otro club, aunque el suyo lo tuviera de administrador.
  Ahora busca por `clerkId` además de por correo.
- [x] **Joseph Samuel Beltrán (SBM Barbosa) revinculado.** Su `Member` apuntaba a
  un `clerkId` borrado, mientras su cuenta real existía con otro id. Barrido
  completo: 98 miembros vinculados, **0 desalineados, 0 sin cuenta**.

### Decisión: no se migra de pasarela (por ahora)

Se evaluaron Wompi, Bold, ePayco, PayU, DRUO, MOVii contra Mercado Pago.

- **Bre-B por API no existe para cobrar** salvo el QR de Bold, y sin recurrencia.
- **El ahorro en comisiones (~$17.000 por club al año) no justifica migrar.**
- Lo que sí lo justificaría es que **Wompi tokeniza Nequi, DaviPlata y
  Bancolombia** para cobro recurrente, mientras el `preapproval` de Mercado Pago
  es solo con tarjeta: hoy la renovación automática solo sirve a los clubes con
  tarjeta de crédito, y ese es el techo real.
- Tarifas de Bold y Wompi **sin confirmar** — sus páginas de precios cargan por
  JavaScript. Verificar con un comercial antes de mover nada.

### Scripts

De 28 a 21, organizados **por la pregunta que responden** en vez de por el caso
que los originó, con `scripts/README.md` que los indexa y marca cuáles escriben.
Se fue `estado-cuenta.ts` (tenía un correo escrito a mano adentro) y
`registrar-pago-manual.ts`: Bre-B ya hace eso desde la interfaz y mantenerlo
dejaba un camino paralelo para escribir pagos que nadie revisa igual.

### Pendiente

- Confirmar tarifas reales de Wompi y si Bre-B queda expuesto por API.
- El riesgo de la cuenta personal como receptora de los pagos por Bre-B.
- Los tres espacios de publicidad siguen con `url: '#'`.
- El repo rastrea `package-lock.json` y `pnpm-lock.yaml` a la vez.
- `bio` y `coverUrl` para `Member` (migración aparte, sin decidir).

---

## Sesión 2026-08-08

**Modelo:** Claude Opus 5
**Estado inicial:** `382bacc`, rama `main`, app en producción
**Estado final:** `353813c`, todo desplegado

### Interfaz

- [x] **Tarjetas de plan en Mi suscripción** (móvil): diseño nuevo de selector, se
  corrigió el badge de "Más popular" que tapaba el precio, y la desalineación
  vertical entre Mensual y Anual.
- [x] **Relleno perdido en el primer dibujado** de esas mismas tarjetas. El objeto
  de estilos ponía el atajo `padding` y después `paddingTop`, que valía `undefined`
  en las tarjetas sin etiqueta. Al montar, React lo aplica igual y vacía el relleno
  que el atajo acababa de fijar; en los renders siguientes `paddingTop` no cambia y
  no se vuelve a emitir, y por eso la tarjeta se arreglaba sola después de la
  primera selección. Se colapsó en un solo atajo de tres valores.
- [x] **Acciones de cada miembro** pasaron a un menú de tres puntos en hoja
  inferior, montada con `createPortal` a `document.body`: el problema no era el
  valor del z-index sino el contexto de apilamiento, que dejaba la hoja debajo del
  menú flotante.
- [x] **El menú flotante se esconde al bajar** y vuelve al subir o al detenerse. El
  listener va sobre `<main>`, no sobre `window`, y el efecto depende de `checking`
  porque en el primer montaje ese elemento todavía no existe.
- [x] **Hero del landing** con partículas (Vortex) y sin foto de fondo; carrusel de
  logos para "clientes que confían en nosotros", solo clubes con logo y sin texto.
- [x] **Publicidad:** seis tarjetas, NexCode97 tercera, tres cupos libres con fondos
  distintos, y sin el degradado oscuro al pie. Los archivos llevan sufijo de
  versión porque el service worker sirve las imágenes con `StaleWhileRevalidate` y
  sin cambiar el nombre no se actualizan nunca en los dispositivos ya instalados.

### Reglas de negocio

- [x] **Nadie puede eliminarse a sí mismo.** La opción no aparece y la API la
  rechaza, comparando por `clerkId` y también por correo.

### Perfil público de un miembro

- [x] **Mostraba solo fotos.** No renderizaba publicaciones en ningún tamaño de
  pantalla, y en escritorio la galería vivía en media pantalla con la otra mitad
  reservada en blanco. Ahora: pestañas debajo de 1024px —que de paso resuelve la
  tablet, donde a dos columnas la caja de comentarios quedaba comprimida— y feed
  con costado de 1024 para arriba, donde tocar una foto abre su publicación en un
  visor.
- [x] **Se buscaban por `authorName`.** El nombre se repite entre homónimos y cambia
  cuando alguien se corrige el suyo, así que mezclaba historiales ajenos y borraba
  el propio. Pasa a `authorClerkId`, y deja de exigir que la publicación traiga
  imagen: una de solo texto tampoco contaba en el número de publicaciones.

### Fecha de fundación del club

- [x] El perfil mostraba "Fundado en ..." con `createdAt`, que es cuando se
  registraron en la plataforma. Se agregó `foundedAt` al modelo `Club`, editable en
  Ajustes, guardado al mediodía UTC porque a medianoche el 1 de enero se lee como
  31 de diciembre en Colombia. Sin declarar, se sigue mostrando la de registro pero
  solo con mes y año.

### Pendientes

- **Biografía y portada de deportistas:** `bio` y `coverUrl` solo existen en `User`,
  no en `Member`. Que un deportista pueda escribirlas es otra migración, sin decidir.
- Los tres cupos de publicidad libres no tienen teléfono de reserva (su `url` es
  `'#'`, así que no muestran botón).
- El repo lleva `package-lock.json` y `pnpm-lock.yaml` a la vez.
- Barrer el resto del código buscando la misma colisión de atajo y propiedad
  individual en objetos de estilo.

---

## Sesión 2026-07-30

**Modelo:** Claude Sonnet 5
**Estado inicial:** `fd4030d`, rama `main`, app en producción
**Estado final:** `abb0c40`, todo desplegado

### Herramientas conectadas

- [x] **CLI de Railway** enlazado al servicio `VeloClub`, y **CLI de Vercel** al
  proyecto `veloclub`. El primer `vercel link` creó por error un proyecto vacío
  llamado `web` en vez de enlazar el real; se eliminó y se reenlazó.
- [x] **Sentry** (CLI + MCP) y **Clerk** (CLI + MCP) autenticados.
- **Aprendido:** Railway ya despliega solo con el push desde GitHub; no necesita
  despliegue aparte, contrario a lo que decía el CLAUDE.md.

### Errores de Sentry corregidos

Los 7 issues abiertos, atacados en su causa y no silenciados:

- [x] **N+1 en `POST /attendance/bulk`:** un upsert por registro generaba 62
  queries en una jornada. Ahora lee los existentes y agrupa las escrituras en
  `createMany` + `updateMany`, quedando en unas 6.
- [x] **Service worker:** el script que desregistraba workers corría en cada carga
  y competía con el registro de la PWA, provocando `AbortError` al registrar
  `/sw.js`. Pasa a correr una sola vez, desde `Providers`.
- [x] **`signOut` en onboarding** lanzaba "You are signed out" con la sesión ya
  expirada; el panel de superadmin refrescaba cada 15s y chocaba con el rate limit.
- [x] **`apiFetch`** reintenta una vez ante 429 y ante cortes de red, pero solo
  cuando la petición es idempotente, para no duplicar datos en POST o PATCH.

### Auditoría OWASP — backend y frontend

Auditados los 6.612 líneas de `api/src` y todo `web/`. Hallazgos verificados a mano
antes de tocar código.

**Crítico**

- [x] **Escalada a SUPERADMIN:** `requireAuth` tomaba `emailAddresses[0]` sin
  comprobar verificación. Ese correo es la llave de identidad de todo el backend,
  así que agregando a la cuenta un correo secundario sin verificar igual al de otro
  admin se tomaba su club o el panel completo. Solo se acepta correo verificado.
  Comprobado contra los 28 usuarios de producción con
  `api/scripts/auditar-emails-clerk.ts`: ninguno quedó bloqueado.

**Alto**

- [x] **Escrituras entre clubes:** comentarios, pruebas y resultados de
  competencias, y resultados de entrenamiento se buscaban solo por id. Como los ids
  viajan en los posts públicos, cualquier ADMIN o COACH podía editar o borrar
  registros de otros clubes.
- [x] **Fuga de datos personales:** `GET /payments` y `GET /members` no verificaban
  rol. Un deportista recibía todos los pagos del club con correo y teléfono, y el
  listado con documento, EPS, contacto de emergencia y archivos adjuntos. Ahora ve
  solo su historial y una versión reducida del listado. La llave de caché incluye el
  alcance para no servir la versión equivocada.
- [x] **`POST/DELETE /events` sin rol:** un deportista podía crear eventos y con
  ellos disparar notificaciones a todo el club.
- [x] **Sentry Session Replay** grababa el 5% de las sesiones sin enmascarar:
  nombres de menores, teléfonos, montos y comprobantes salían a un tercero.
- [x] **Autorización que fallaba abierta:** el panel de superadmin se montaba antes
  de confirmar el rol y cualquier error de red bastaba para renderizarlo; el
  dashboard caía al menú de ADMIN si no lograba resolver el rol.

**Medio**

- [x] Zod en `PATCH /payments/:id` (el monto aceptaba negativos y alimentaba el
  flujo de caja); sedes validadas contra el club en miembros, entrenamientos,
  eventos y asistencia; url de Cloudinary obligatoria en el upload de miembros;
  alcance del post en `GET /posts/:id/likes`.
- [x] **Subidas a Cloudinary:** el uploader acepta también URLs remotas, así que
  pasarle el cuerpo sin revisar permitía que Cloudinary consultara una dirección
  arbitraria. Sin tope de tamaño real, y el feed admitía cualquier archivo bajo el
  tipo `raw`. Cubiertos los 9 puntos con `lib/upload-guard`.
- [x] **Límites por endpoint** (`lib/rate-limit`) en validación de cupones, intentos
  de pago, subidas, alta de clubes, procesos masivos y `/cron`; el secreto de cron
  se compara en tiempo constante.
- [x] **Webhook de Mercado Pago:** ventana de frescura de 5 minutos contra replay,
  tolerante a segundos o milisegundos para no dejar de procesar pagos.
- [x] **Audiencia del JWT:** se valida el claim `azp`. A mano y no con
  `authorizedParties`, porque si Clerk dejara de enviarlo esa opción rechazaría
  todos los tokens y tumbaría el acceso de todos.
- [x] **Cabeceras:** `Permissions-Policy`, `X-DNS-Prefetch-Control`, y en la CSP
  `base-uri`, `form-action`, `manifest-src`, `media-src` y
  `upgrade-insecure-requests`. Quitado el comodín de googleapis de `script-src`.
- [x] Mensajes de error sin el cuerpo crudo de la respuesta, host validado en la
  redirección de pago, y tipo y tamaño en la subida del feed.
- [x] **Ticket de un solo uso para el SSE:** el JWT de Clerk ya no viaja en la url
  del stream. Dura un minuto, se consume con `GETDEL` y solo sirve para abrir la
  conexión. La reconexión pasa a retroceso exponencial.

### Descartado con razón

- **CSP con nonce (quitar `'unsafe-inline'`):** implementada con el soporte nativo
  de Clerk 7.4.2 y probada en un preview con Chromium. **Rompe la app entera:** 57
  bloqueos y pantallas en blanco, incluidos los chunks propios de Next. La causa es
  estructural: `'strict-dynamic'` hace que el navegador ignore la lista de dominios
  y confíe solo en el nonce, pero un nonce es único por respuesta y las páginas se
  sirven prerenderizadas. Exigiría volver dinámicas todas las rutas, peor para una
  PWA que el problema que resuelve. El riesgo de dejar `'unsafe-inline'` es bajo: la
  auditoría no encontró ni un punto de inyección en el frontend.
- **HSTS:** la auditoría lo reportó como faltante y es falso. Vercel ya lo envía con
  `max-age=63072000`. No se agregó `preload` (es prácticamente irreversible) ni
  `includeSubDomains` (no se pudo confirmar que todos los subdominios sirvan HTTPS).

### Verificación

`tsc --noEmit` y builds de producción en ambos proyectos, 15 tests del API, lint sin
errores, y producción probada en Chromium real: cero bloqueos de CSP. En el API,
`POST /stream/ticket` sin sesión responde 401 y un ticket inventado también.

### Pendiente de revisión en dispositivo

Entrar al dashboard, marcar un pago, subir una foto, entrar con una cuenta de
deportista (debe ver solo sus pagos, y Resultados debe seguir mostrando nombres) y
comprobar que dos pestañas se sincronizan solas.

### Sigue aplazado

- Rediseño del Inicio tipo comunidad: **diseño aprobado, sin implementar**.
- Limpiar espacios sobrantes en nombres de club y normalizar en la edición del
  superadmin.

---

## Sesión 2026-07-29

**Modelo:** Claude Opus 5
**Estado inicial:** `f840f7b`, rama `main`, app en producción
**Estado final:** `68e6f60`, todo desplegado

### Completado

- [x] **Cargador de módulo:** distancia fija desde el borde superior por dispositivo
  (móvil 400px, tablet y escritorio 320px) en vez de centrado en el espacio libre.
- [x] **ModuleReveal:** entrada unificada del contenido en los 17 módulos (fade up
  escalonado en CSS, sin dejar transform aplicado al terminar).
- [x] **RBAC:** miembros y sedes pasan a solo lectura para el entrenador; flujo de
  caja exige ADMIN; competencias y entrenamientos exigen ADMIN o COACH. Once rutas
  de escritura no validaban ningún rol y respondían a cualquiera con sesión.
- [x] **Suscripciones fantasma:** `GET /mi-suscripcion` hacía upsert y creaba planes
  de 450.000 a clubes en prueba. Separada lectura de escritura y limpiadas las 5
  filas existentes en producción.
- [x] **Superadmin — detalle de club:** ahora tiene rutas propias
  (`/superadmin/clubs/[id]` y `/finanzas`), el sidebar muestra los módulos del club,
  y la tarjeta de datos se completó con ubicación, contacto, banderas de estado y
  descripción. Historial de abonos a lo ancho.
- [x] **Estados de guardado:** puntos en onda + palomita en los botones con texto.
- [x] **PWA:** alcance del manifiesto en la raíz e `id`; service worker sin los
  helpers indefinidos que rompían la navegación.
- [x] **Sentry:** corregidos `removeChild` (444 ocurrencias, AnimatePresence fuera
  del portal) y `t.lat is not a function`. Los de Mercado Pago resueltos: eran del
  cambio de credenciales de prueba a producción el 16 de julio.
- [x] **Promoción 2 meses gratis** hasta el 31 de octubre: `diasDePrueba()` da 60
  días en auto-registro y en alta desde superadmin, con tests de las cuatro
  fronteras. Aplicada a los 6 clubes en prueba sumando a lo que les quedaba.
- [x] **Landing:** la promoción entra al titular como tercera línea, con entrada
  línea por línea con desenfoque, barrido de luz, latido en la pastilla y halo del
  botón. Corregido el flujo de registro que seguía prometiendo 15 días.

### Decidido y aplazado

- Barra de estado del iPhone detrás del degradado: descartado por ahora
  (ver memoria `veloclub-barra-estado-pwa`).
- Rediseño del Inicio tipo comunidad (degradado a todo el ancho, buscador y campana
  separados, logo junto al nombre): **diseño aprobado, sin implementar**.
- Limpiar espacios sobrantes en nombres de club (`"Correcaminos "` y
  `"Duvan Oviedo  Centro…"`) y normalizar en la edición del superadmin.

---

## Sesión 2026-06-16

**Modelo:** Claude Opus 4.8
**Estado inicial:** Working tree limpio, rama `main`, app en producción

### Completado esta sesión

- [x] **Menú "Más" (móvil):** agregado módulo "Club" al menú radial del rol ADMIN
  (antes solo COACH/STUDENT). Arco del `BottomCircleMenu` ahora es adaptativo:
  con 5+ ítems abre a 120° y radio 150 para que los íconos no se solapen.
- [x] **Fix tests backend:** vitest corría también los tests compilados en `dist/`
  tras un build y fallaban. `tsconfig` excluye `src/tests` del build de producción
  y vitest solo corre `src/**/*.test.ts`. 11/11 tests pasan.
- [x] **Trial en tiempo real (superadmin):** nuevo hook `web/lib/use-now.ts`
  (re-render cada 30s). El badge "Prueba · Nd" y el texto de días restantes en
  `/superadmin/clubs` se descuentan solos sin recargar.
- [x] **Registro Civil (RC):** agregado como tipo de documento en el formulario de
  miembros y en la plantilla de Excel (`web/lib/excel.ts`, dropdown + notas).
- [x] **Fix tarifa mensual:** al cambiar la tarifa de un miembro, los pagos
  PENDING/OVERDUE ya generados conservaban el monto viejo. Backend
  (`PUT /members/:id`) ahora hace `updateMany` de los pagos no pagados al nuevo
  monto (los PAID no se tocan) y el front invalida las queries de pagos.
- [x] **Dropdown de deporte (superadmin crear/editar club):** `SportSelect` se
  recortaba dentro del modal en móvil. Reescrito con portal a `document.body`
  + `position: fixed` + clamp al viewport (abre hacia arriba si no cabe).
- [x] **Campo teléfono del admin con indicativo de país:** reutilizado el
  componente `PhoneInput` en crear y editar club (opcional). Backend guarda
  `phone` en el Member admin; `/clubs/:id/miembros` devuelve `phone` para pre-llenar.
- [x] **Fix selector de país (`PhoneInput`):** mismo patrón de recorte que
  `SportSelect`. Aplicado el fix de portal al componente compartido → beneficia
  los 4 formularios que lo usan (ajustes, club, miembros, superadmin).
- [x] **Descripción + Open Graph profesional:** la meta description decía
  "Plataforma para clubes de patinaje" (limitaba a un deporte). Cambiada a
  "Plataforma integral para la gestión de clubes deportivos" en `layout.tsx` y
  `manifest.ts`. Agregado bloque `openGraph` + `twitter` con `metadataBase` y una
  imagen de marca dedicada `public/og-image.png` (1200×630, logo VC + tagline +
  dominio) → el preview del enlace se ve grande y profesional al compartir.
- [x] **Fix teléfono recortado en Ajustes → Mi perfil (móvil):** nombre y teléfono
  estaban en `grid grid-cols-2`; en móvil el selector de país apretaba el número.
  Cambiado a `grid-cols-1 sm:grid-cols-2` (apila en móvil, lado a lado en desktop).
- [x] **Fix "Guardar cambios" del teléfono no hacía nada (Ajustes):** bug de 3 capas:
  1. Front: `handleSaveProfile` salía en silencio en `if (!memberMe?.id) return`.
  2. Back: el lookup del miembro propio era estricto por `clerkId`, pero los miembros
     creados por el superadmin arrancan **sin clerkId** (vinculados por email) → 404.
  3. Deploy: Railway se quedó en un commit anterior y no tomó el fix.
  Solución: nuevo `PATCH /members/me/contact` self-resolving; `GET /members/me` y
  ese endpoint ahora buscan por `OR: [{ clerkId }, { email }]` dentro del club (igual
  que `me.ts`); el PATCH **auto-vincula el clerkId** si estaba null; front muestra
  error si falla. Re-deploy de Railway forzado con commit vacío.

### Notas técnicas
- Patrón estándar para dropdowns dentro de modales con `overflow`: portal +
  `fixed` + clamp al viewport + reposición en scroll/resize (respeta
  `visualViewport` para teclado móvil). Aplicado en `SportSelect` y `PhoneInput`.
- **Resolver "el miembro propio" SIEMPRE por `OR: [{ clerkId }, { email }]`**, nunca
  solo por `clerkId`: los miembros creados por el superadmin no tienen clerkId hasta
  su primer login y pueden quedar vinculados solo por email.
- **Deploy backend:** el API corre en **Railway** (no Vercel). El CI de GitHub Actions
  (`security.yml`) solo audita/lintea, NO despliega. Si Railway se queda en un commit
  viejo, forzar con `git commit --allow-empty` + push.
- **CI en rojo (pendiente):** `npm audit --audit-level=high` falla por 3 vulns high
  (esbuild/tsx, form-data). No bloquea el deploy de Railway, pero conviene `npm audit fix`.
- Typecheck y build de front y back verificados en cada paso.

---

## Sesión 2026-04-29

**Modelo:** Claude Sonnet 4.6
**Estado inicial:** Working tree limpio, rama `main`

### Contexto recuperado
- La sesión anterior se bloqueó (Claude se cortó mid-task)
- La tarea pendiente era: **convertir la app a PWA**
- El trabajo de PWA **no se llegó a iniciar** — no hay manifest, service worker, ni config PWA

### Estado del proyecto al inicio de sesión
- Plan 1 (Cimientos) mayoritariamente completo según commits recientes
- Páginas del dashboard existentes: `asistencia`, `calendario`, `flujo-caja`, `logros`, `miembros`, `pagos`, `reportes`, `sedes`
- Páginas adicionales: `completar-perfil`, `inactivo`, `no-access`, `superadmin`
- Auth con Clerk funcionando
- Backend en Render con rutas `/me` y `/clubs`
- No existen archivos `.env` locales (variables manejadas en Vercel/Render)

### Pendiente esta sesión
- [ ] Convertir la app a PWA (manifest + service worker + config Next.js)

### Completado esta sesión
- [x] Recuperación de contexto del proyecto
- [x] Creación de este archivo de historial
- [x] Memoria del proyecto guardada en `.claude/projects/.../memory/`
- [x] Conversión a PWA:
  - Instalado `@ducanh2912/next-pwa`
  - Creado `web/app/manifest.ts` (nombre, íconos, colores, start_url `/dashboard`)
  - Actualizado `web/next.config.ts` con config PWA (desactivado en dev, activo en prod)
  - Actualizado `web/.gitignore` para ignorar archivos generados (`sw.js`, `workbox-*.js`)
  - Build verificado exitosamente — `/manifest.webmanifest` aparece en rutas

---

## Plantilla para próximas sesiones

```
## Sesión YYYY-MM-DD

**Modelo:** Claude Sonnet 4.6 / Opus / etc.
**Estado inicial:** (clean / cambios pendientes / rama X)

### Contexto recuperado
- 

### Pendiente esta sesión
- [ ] 

### Completado esta sesión
- [x] 

### Problemas encontrados
- 

### Próximos pasos
- 

---

## Sesión 2026-06-01

**Modelo:** Claude Opus 4.6
**Commit final:** `5447bdd`

### Completado esta sesión

#### UI — Bottom bar + BottomCircleMenu
- Integración visual bump/bar: bump como hijo del bar con `overflow: visible` + `filter: drop-shadow` unificado → silueta de una sola pieza
- Burbujas del menú Más: color sólido, íconos blancos, etiquetas con `textShadow`
- Animación entrada/salida simétricas (mismo spring: stiffness 300, damping 24)
- Componente convertido a controlado (isOpen/onToggle/onClose) — estado en layout
- Overlay oscuro con blur cuando el menú está abierto

#### Modal de miembros — Rediseño completo
- Reemplazado Dialog por bottom sheet multi-paso con animación iOS (cubic-bezier 0.32,0.72,0,1 / 460ms)
- Pasos dinámicos por rol: STUDENT (5 pasos), COACH (3), ADMIN (2)
- Paso "Acudiente": guardianName/guardianPhone → emergencyContact/emergencyPhone
- Campo monthlyFee con formato COP y día de pago en la misma fila
- Avatar en tiempo real con iniciales mientras se escribe el nombre
- Step indicator animado (pill activo con flex:2)

#### API — Cron endpoints proactivos
- `POST /cron/generate-payments`: genera pagos PENDING del mes actual para todos los miembros con `monthlyFee` + `paymentDueDay` configurados (idempotente, no duplica si ya existe)
- `POST /cron/mark-overdue`: marca PENDING → OVERDUE cuando `dueDate` pasó
- Protección por header `X-Cron-Secret` (env var `CRON_SECRET`)
- Notificación SSE por cada club afectado

#### Finanzas — Tab "Estado"
- Nuevo tab "Estado de deportistas" entre Mensualidades y Flujo de Caja
- Vista de todos los STUDENTs con su estado de pago del mes seleccionado
- Estado: PAID / PENDING / OVERDUE / Sin pago este mes / Sin configurar
- Ordenamiento: OVERDUE → PENDING → sin pago → PAID → sin configurar
- Botón "Generar": crea pago PENDING con la tarifa configurada del miembro
- Botón "Marcar pagado" directo sin abrir modal
- WhatsApp al emergencyPhone (o phone) — solo aparece cuando hay pago pendiente/vencido
- Mini resumen numérico: Pagados / Pendientes / Sin pago

#### Base de datos
- `monthlyFee Float?` agregado a schema.prisma (ya estaba desde sesión anterior)
- Migración formal creada: `20260601000000_add_monthly_fee`
- Build script actualizado: `prisma migrate deploy && prisma generate && tsc` — la migración se aplica automáticamente en cada deploy de Railway

#### PWA
- Fix: removidos `cacheOnFrontEndNav` y `aggressiveFrontEndNavCaching` de `next.config.ts` — eliminaba crash `_async_to_generator is not defined` en el service worker

### Problemas encontrados
- Credenciales locales de Neon (`.env`) desactualizadas — `prisma db push` local fallaba con P1000. Solución: migración formal vía SQL + `prisma migrate deploy` en el build de Railway
- `prisma.config.ts` usa dotenvx que interfería con Prisma CLI. Solución: el build de Railway tiene el DATABASE_URL como env var de Railway, no necesita dotenv

### Próximos pasos
- Configurar Railway Cron Jobs en el dashboard de Railway:
  - `POST /cron/generate-payments` — día 1 de cada mes (cron: `0 8 1 * *`)
  - `POST /cron/mark-overdue` — todos los días (cron: `0 9 * * *`)
  - Agregar env var `CRON_SECRET` en Railway
- Verificar que la migración de `monthlyFee` se aplique correctamente en el próximo deploy
- Plan 3 — Asistencia: módulo pendiente de implementar

## Sesión 2026-06-10

**Cambios (commit 71c1771):**
- Fix global de animaciones: eliminado scale de entrada en todos los módulos (cargan como Inicio)
- Badge de rol en sentence case; imágenes de posts completas (object-contain)
- Mi Perfil: avatar 150px + modal para editar teléfono/correo (PUT /members/:id)
- Club: logo 150/170px, botón Seguir visible para admin
- Ajustes: rediseño desktop en dos columnas (Mi perfil | Mi club), ayuda y cerrar sesión en Mi perfil
- Social: Post/PostComment guardan authorClerkId (migración 20260610150000); clic en avatar/nombre redirige al perfil del autor (posts nuevos)
- Corregido error de sintaxis en perfil/page.tsx que rompía el build

**Pendiente:** Plan 3 (Asistencia) · trial 15 días (plan) · lightbox tab Fotos en Mi Perfil
