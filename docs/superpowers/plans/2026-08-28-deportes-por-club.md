# Varios deportes por club — Plan de implementación

> **Ejecutado el 28 de agosto de 2026.** Lo que sigue es el plan tal como se
> aprobó. Al final quedan anotadas las tres cosas que en la ejecución salieron
> distintas de lo escrito, y por qué.

**Qué se busca:** que un club pueda manejar varios deportes dentro de la misma
cuenta, con aislamiento total entre ellos. Cada deporte es una carpeta con sus
propios deportistas, sedes, asistencia, mensualidades, caja y resultados. Lo
único que cruza las carpetas es el dueño del club.

**Qué NO cambia:** el club sigue siendo el cliente y el que paga. Una sola
suscripción, calculada sobre la suma de deportistas de todas sus carpetas.

---

## Las reglas, tal como quedaron

| Regla | Decisión |
|-------|----------|
| Aislamiento | Total. Ninguna consulta cruza deportes. |
| Dueño del club | Ve todas las carpetas y cambia entre ellas. |
| Otros admins | Amarrados a una carpeta, como los entrenadores. |
| Entrenadores | Una carpeta. |
| Deportistas | Una carpeta. Quien practique dos son dos fichas distintas. |
| Suscripción | Una por club. El precio sale del total de deportistas. |
| Precio a futuro | Subirá también según cuántas carpetas tenga activas. |
| Enlaces de inscripción | Uno por carpeta, con su propio interruptor y vencimiento. |
| Datos que ya existen | Todos a la carpeta de Patinaje. |

---

## La idea de fondo

Hoy `clubId` es la frontera: aparece en 16 modelos y toda consulta filtra por
él. Este cambio agrega una segunda frontera, `deporteId`, que vive **dentro**
del club.

El riesgo de un cambio así no está en agregar la columna, está en olvidarse de
filtrar por ella en alguna consulta. Con 16 modelos y decenas de rutas,
agregar el filtro a mano en cada `where` garantiza que alguna se quede sin él,
y el síntoma es que un club ve deportistas de otro deporte sin que nadie se
entere.

**Por eso el filtro no se escribe ruta por ruta.** Se centraliza en un solo
lugar: un cliente de Prisma que ya viene con el club y el deporte puestos. Las
rutas lo usan y no pueden olvidarse de nada, porque no son ellas las que
deciden. Escribirlo una vez y auditarlo una vez, en vez de ochenta.

---

## Qué modelos tocan y cuáles no

**Llevan `deporteId` obligatorio** (son la operación diaria de un deporte):

`Location` · `Member` · `Attendance` · `ClaseHorario` · `Payment` ·
`CashEntry` · `Competition` · `TrainingSession` · `CalendarEvent` · `Post` ·
`Reporte`

**Llevan `deporteId` opcional:**

- `User`: en null significa que cruza todas las carpetas, que es el caso del
  dueño. Con valor, el usuario queda amarrado a esa carpeta.
- `Auditoria`: para saber en qué carpeta pasó cada cosa. No filtra nada, es
  registro.

**No lo llevan** (son del cliente, no del deporte):

`Club` · `ClubSuscripcion` · `SuscripcionPago` · `Cupon` · `CuponCanje` ·
`GastoPlataforma` · `IngresoPlataforma` · `ClubLead`

**Lo heredan de su padre y no necesitan columna propia:**

`MemberLocation` · `CompetitionEvent` · `EventResult` · `TrainingResult` ·
`PostLike` · `PostComment`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `api/prisma/schema.prisma` | Modificar | Modelo `Deporte`; `deporteId` en los modelos de arriba; `Club.ownerUserId`; mover los campos de inscripción de `Club` a `Deporte` |
| `api/prisma/migrations/<fecha>_deportes/migration.sql` | Crear | Columnas, tabla y traslado de los datos que ya existen |
| `api/src/lib/scope.ts` | Crear | El cliente de Prisma con club y deporte puestos |
| `api/src/auth/middleware.ts` | Modificar | Resolver la carpeta activa y verificar que el usuario tenga acceso |
| `api/src/routes/deportes.ts` | Crear | Listar, crear, renombrar, activar y desactivar carpetas |
| `api/src/routes/inscripcion.ts` | Modificar | El token pasa a ser de la carpeta |
| `api/src/routes/me.ts` | Modificar | Devolver las carpetas visibles y cuál está activa |
| Las demás rutas de dominio | Modificar | Pasar a usar el cliente con alcance |
| `api/src/lib/pricing.ts` | Modificar | Contar deportistas de todas las carpetas del club |
| `web/app/dashboard/layout.tsx` | Modificar | El selector de deporte, arriba del menú |
| `web/lib/api-client.ts` | Modificar | Mandar la carpeta activa en cada llamada |

---

## Los pasos

### 1. El modelo de datos

- [ ] Crear el modelo `Deporte`: id, clubId, nombre, activo, y los cuatro
      campos de inscripción que hoy están en `Club`.
- [ ] Agregar `deporteId` donde corresponde, según la lista de arriba.
- [ ] Agregar `Club.ownerUserId`, que declara quién es el dueño en vez de
      deducirlo de una fecha.
- [ ] `Club.deporte` queda como está por ahora. Se retira al final, cuando
      nada lo lea.

### 2. La migración de lo que ya existe

- [ ] **Antes de correr nada**, listar los clubes cuyo `deporte` declarado no
      sea Patinaje. Si sale alguno, se revisa a mano antes de seguir.
- [ ] Crear una carpeta «Patinaje» por cada club.
- [ ] Colgar de ella todo lo que hoy cuelga del club.
- [ ] Mover el token de inscripción del club a esa carpeta, **el mismo token**:
      los enlaces que ya están repartidos tienen que seguir funcionando.
- [ ] Marcar como dueño al admin más antiguo de cada club, y dejarlo escrito.
- [ ] Los demás admins quedan amarrados a esa carpeta.

### 3. El alcance en el backend

- [ ] Escribir el cliente con alcance y probar que una consulta sin carpeta
      falle en vez de devolver todo.
- [ ] Middleware: resolver la carpeta activa y rechazar al que pida una que no
      le corresponde.
- [ ] Pasar las rutas de dominio al cliente con alcance, una por una.
- [ ] `/me` devuelve las carpetas visibles.

### 4. Las carpetas

- [ ] Rutas para crear, renombrar, activar y desactivar.
- [ ] Impedir borrar una carpeta con deportistas dentro.
- [ ] Dejar registrado en `Auditoria` quién activa o desactiva, porque a futuro
      eso mueve el precio.

### 5. El frontend

- [ ] El selector arriba del menú, ya diseñado.
- [ ] Recordar la carpeta activa y mandarla en cada llamada.
- [ ] Que al cambiar de carpeta se limpie lo que hay en pantalla, para que no
      queden datos de la anterior mientras carga.
- [ ] El dueño ve el selector; los demás no.

### 6. El cobro

- [ ] `pricing.ts` cuenta los deportistas de todas las carpetas del club.
- [ ] Confirmar contra un club real que el monto no cambió con la migración.

---

## Dónde está el riesgo

**La fuga entre carpetas.** Es el único error grave de este plan: que alguien
vea deportistas de otro deporte. Se ataca centralizando el filtro y probándolo
antes de tocar las rutas.

**El cambio de dueño.** Si la deducción por fecha se equivoca, un admin queda
sin ver sus carpetas o viendo de más. Por eso se lista y se revisa antes, y
después queda declarado en vez de deducido.

**Los enlaces repartidos.** Si el token cambia en la migración, todo enlace que
un club ya mandó por WhatsApp deja de servir y nadie avisa. El token se
conserva.

---

## Lo que queda para después

- Subir el precio según cuántas carpetas tenga activas. El registro de
  activaciones queda listo en este plan; el cálculo se hace cuando se defina
  cuánto sube.
- Retirar `Club.deporte`.
- La página de precios dice hoy «Lo único que mueve el precio es cuántos
  deportistas tenga tu club». Deja de ser cierta el día que el número de
  carpetas entre al cálculo.


---

## Lo que cambió al ejecutarlo

**1. El filtro no se le pasa a las rutas: va montado en el cliente.**

El plan decía «un cliente de Prisma que ya viene con el club y el deporte
puestos» que las rutas usarían. Al empezar a aplicarlo aparecio que el proyecto
ya tenía `contexto-peticion.ts`, un AsyncLocalStorage por petición, y que la
auditoría ya resolvía el mismo problema montándose en el cliente global. Hacer
lo mismo con el alcance salió mejor por dos razones: no hay que tocar quince
archivos de rutas, y no queda forma de saltárselo. Lo que sí se paga es que las
rutas que cruzan clubes a propósito tienen que declararlo — y ese olvido falla
del lado seguro, dejando una pantalla vacía en vez de mostrando datos ajenos.

**2. La cabecera del deporte es una preferencia, no una credencial.**

El plan decía «rechazar al que pida una carpeta que no le corresponde». Se
escribió así y se cambió: un 403 en `requireAuth` deja a alguien trancado por
fuera de su propio club por un valor viejo guardado en el navegador, sin poder
ni cargar `/me` para arreglarlo. Ahora se ignora la carpeta pedida y se resuelve
la que sí le toca. El aislamiento no lo da el rechazo sino lo que se resuelve:
pedir la de otro no la abre en ningún caso. El intento queda en el log.

**3. Tres agujeros que la base de datos no habría atrapado.**

No estaban en el plan porque el plan miraba el esquema:

- Las claves de Redis llevaban solo el club. Cacheada la lista de patinaje, se
  le servía igual a quien estaba parado en natación, y la consulta ni llegaba a
  hacerse.
- El conteo que define el precio quedaba acotado a una carpeta, así que un club
  con dos deportes habría pagado el tramo de uno solo.
- El trabajo en cola que genera las cuotas del mes corre fuera de la petición y
  no heredaba el deporte: el administrador de patinaje se las habría generado
  también a los de natación.

---

## Cómo se verificó

- **La migración, contra una copia completa de producción** restaurada en una
  base de ensayo aparte: 19 carpetas creadas, 1558 deportistas, 10036
  asistencias y 1712 pagos reubicados, **cero filas apuntando a la carpeta de
  otro club**, y el token de inscripción idéntico byte a byte antes y después.
  La base de ensayo se borró al terminar.
- **El aislamiento, con datos inventados** y la prueba que quedó en
  `api/scripts/prueba-aislamiento.ts`: lecturas, búsqueda por id, filtros con
  `OR`, creación, `deleteMany`, `updateMany`, el conteo de club entero y el caso
  sin petición de por medio.
- `npm test` (60 pruebas), `tsc` en las dos mitades, `next lint` y `next build`.

---

## Lo que quedó pendiente

- **Un club sin dueño declarado.** «Grandes Paisas» tiene 221 deportistas y su
  único usuario es un ENTRENADOR, así que la migración lo dejó sin
  `ownerUserId`. Se decidió no promoverlo solo: una migración que le sube los
  permisos a alguien es peor que un club que por ahora no puede abrir un segundo
  deporte. Sigue funcionando igual que hoy, con su única carpeta.
- **Crear un deporte es una acción de escritorio.** En móvil el selector aparece
  solo si el club ya tiene más de uno. No hay barra superior en móvil a
  propósito, y sumarle una a todos los clubes para mostrarles un único deporte
  sería chrome que no informa nada.
- **Los eventos en vivo siguen siendo por club.** Un movimiento en patinaje hace
  que la pestaña abierta en natación se refresque de más. No es una fuga: al
  refrescarse pide sus propios datos. Se deja anotado por si molesta.
- **El muro (`Post`) quedó por carpeta**, como decía el plan. Es la decisión
  consistente con «aislamiento total», pero es la que más vale la pena mirar en
  uso: puede que un club quiera un solo muro para todo.
- **`Post_clubId_createdAt_idx`** existe en la base y no en el esquema. Es
  deriva anterior a este cambio (viene de `20260603000005_add_posts`) y se dejó
  como estaba.
