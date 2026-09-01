# Grupos y horarios en la inscripción

**Fecha:** 2026-09-01
**Estado:** Pendiente de revisión del usuario
**Alcance:** modelo de datos, panel de administración, formulario público de inscripción, importador de Excel, asistencia

---

## 1. El problema

Un club tiene sedes, y una misma sede puede entrenar en varios horarios. Wilk
Skate y New Power Skate, los dos clubes que entraron en producción el 1 de
septiembre de 2026, son justo ese caso.

El formulario público de inscripción pregunta hoy tres cosas sobre el
entrenamiento: sede, categoría y nivel. Nunca pregunta **cuándo** entrena la
persona. Ese dato queda por fuera, y como el formulario es el único momento en
que el deportista está dispuesto a contestar, después toca perseguirlo por
WhatsApp uno por uno.

---

## 2. Lo que hay hoy, y por qué no alcanza

Vale la pena decirlo con precisión, porque el sistema **sí** tiene una forma de
agrupar gente. Solo que es implícita.

`ClaseHorario` ya existe con sede, día, hora, nombre y categoría. Y la planilla
de una clase no se declara: **se deduce**. En `api/src/routes/attendance.ts`
(líneas 222 a 225) la lista de una clase sale de cruzar dos condiciones sobre el
deportista.

```
planilla de la clase  =  miembros de la sede de la clase
                       ∩  miembros cuya category == ClaseHorario.categoria
```

Esa regla tiene una virtud grande y una falla exacta.

**La virtud** es que funciona sin que nadie inscriba a nadie. Un club importa su
Excel, arma su horario, y las planillas aparecen solas. Es la razón por la que
los dos clubes nuevos pudieron operar desde el primer día.

**La falla** es que dos clases de la misma sede y la misma categoría en horarios
distintos producen **exactamente la misma planilla**. El sistema no tiene cómo
distinguirlas, porque la pertenencia se deduce de atributos que ambas comparten.
Ese es, literalmente, el caso que el club reportó.

---

## 3. La decisión de fondo

Pasar de **pertenencia deducida** a **pertenencia declarada**. El deportista deja
de caer en una planilla por sus atributos y pasa a pertenecer a un grupo porque
alguien lo puso ahí, o porque él mismo lo eligió al inscribirse.

El costo es real y hay que nombrarlo. La pertenencia declarada exige que alguien
asigne. La deducida no exigía nada. Se gana precisión y se paga con trabajo de
administración.

---

## 4. El modelo

### 4.1 Grupo

Un grupo es **un nombre y una sede**. Nada más.

```prisma
model Grupo {
  id         String   @id @default(cuid())
  clubId     String
  deporteId  String
  locationId String
  nombre     String
  activo     Boolean  @default(true)
  clases     ClaseHorario[]
  miembros   MemberGrupo[]

  @@unique([locationId, nombre])
  @@index([clubId, deporteId])
}
```

El día y la hora **no viven en el grupo**. Viven en cada `ClaseHorario`, como
hoy. Un grupo de lunes, miércoles y viernes a las 6 a. m. son tres clases que
cuelgan del mismo grupo, no un campo con tres valores.

Esto importa porque la asistencia se toma por clase, no por grupo. Si el día
subiera al grupo, la asistencia perdería el detalle que ya tiene.

### 4.2 La pertenencia

```prisma
model MemberGrupo {
  memberId String
  grupoId  String
  @@id([memberId, grupoId])
}
```

Tabla puente igual que `MemberLocation`, y por la misma razón. Un deportista
puede entrenar en dos grupos, y ese caso ya se dio con las sedes.

### 4.3 ClaseHorario gana un padre

```prisma
grupoId String?
grupo   Grupo? @relation(...)
```

**Opcional a propósito.** Ver la sección 6.

---

## 5. Los tres campos que se pisan

Esta es la parte que más me preocupaba del diseño y por la que valía la pena
escribir el spec antes de tocar código. Hay tres campos que responden preguntas
parecidas y hay que decir cuál manda en cada caso.

| Campo | Qué es hoy | Qué es después |
|---|---|---|
| `Member.category` | Categoría de edad (Menores 3-10, Transición 11-13, Mayores 14+). **Además, la mitad del mecanismo de planilla.** | Sigue siendo la categoría de edad. **Deja de armar planillas.** Se queda para filtros en Miembros, competencias y reportes, que es donde de verdad sirve. |
| `Member.tipo` | El nivel (Escuela, Novatos, Avanzados y demás). No interviene en planillas. | Igual. No lo toca este cambio. |
| `ClaseHorario.categoria` | La otra mitad del mecanismo de planilla. | Se conserva, pero **solo como respaldo** para las clases sin grupo. Se marca así en el esquema para que nadie la use de nuevo como criterio principal. |

La regla en una línea: **la categoría describe al deportista, el grupo dice con
quién entrena.** Hoy la categoría hace las dos cosas y por eso no distingue dos
horarios.

---

## 6. La migración, que es la parte delicada

Hay clubes operando **hoy**. Si la planilla pasa a salir solo del grupo, el lunes
siguiente todas las listas de asistencia amanecen vacías. Eso no puede pasar.

### 6.1 La regla de convivencia

```
Si la clase tiene grupo    →  la planilla son los miembros de ese grupo.
Si la clase no tiene grupo →  la planilla sale de la regla vieja
                              (sede ∩ categoría), tal cual hoy.
```

Por eso `ClaseHorario.grupoId` es opcional. No es indecisión del modelo: es la
única forma de que un club que no ha armado grupos siga funcionando sin que
nadie le avise.

### 6.2 Qué hace la migración con lo que ya existe

1. Por cada combinación distinta de (`locationId`, `nombre`) en `ClaseHorario`,
   crear un `Grupo` con ese nombre y esa sede.
2. Apuntar cada `ClaseHorario` a su grupo.
3. Poblar `MemberGrupo` con el resultado de la regla vieja, es decir, los
   miembros que hoy aparecerían en esa planilla.

El paso 3 es el que hace que la migración sea invisible. El día después de
desplegar, cada planilla trae exactamente a la misma gente que traía antes. La
diferencia es que ahora esa pertenencia está escrita y se puede editar.

### 6.3 Verificación obligatoria antes de dar por buena la migración

Comparar, para cada clase de cada club en producción, la planilla vieja contra la
nueva. Deben coincidir fila por fila. Si alguna no coincide, la migración está
mal y se revierte. Esto se corre contra un volcado de producción, no contra datos
de prueba.

---

## 7. El formulario público

El paso 3 (Entrenamiento) queda así.

```
Sede donde entrena        [ desplegable ]        ← ya existe
Grupo y horario           [ desplegable ]        ← nuevo, se filtra por la sede
Categoría                 [ desplegable ]        ← ya existe
Nivel                     [ desplegable ]        ← ya existe
```

El desplegable de grupo muestra el nombre y debajo, en gris, los días y horas que
salen de sus clases. Así la persona elige por horario, que es como piensa, no por
un nombre de grupo que no conoce.

```
  Mañana
  Lun, Mié, Vie · 6:00 a. m.
```

**Obligatorio si el deporte tiene grupos. Se oculta si no tiene.** Un club que no
armó grupos no ve un campo vacío que no puede llenar. Es la misma decisión que ya
se tomó con las sedes, donde el enlace de inscripción no se comparte si no hay
sedes creadas.

**Un solo grupo en el formulario.** El modelo aguanta varios, pero pedirle dos al
que se está inscribiendo alarga un formulario que ya tiene cuatro pasos. El
segundo grupo se asigna desde el panel, que es donde el administrador sabe lo que
hace.

---

## 8. El panel

**Ajustes → Horario de clases** es donde ya se crean las clases, en
`web/components/ajustes/horario-clases.tsx`. Ahí mismo se crean y se editan los
grupos, y las clases pasan a colgar de uno. No se inventa una pantalla nueva: el
horario ya es el lugar donde el club piensa en esto.

**Miembros** gana el grupo en la ficha del deportista y como filtro, al lado del
filtro de categoría que ya existe.

---

## 9. El importador de Excel

La plantilla gana una columna **Grupo**, con las mismas reglas que ya tiene la
columna de sede.

- Se busca por nombre exacto dentro de la sede de esa fila.
- Si el grupo no existe, la fila **se importa sin grupo** y se reporta al final.

Ojo con esto: **es distinto de lo que hace hoy la columna de sede**, que ante un
nombre inexistente descarta la fila entera. Ese comportamiento ya causó un
problema real el 1 de septiembre, cuando dos filas de New Power Skate se
perdieron por un nombre de sede que no coincidía. La columna de grupo no repite
ese error, y de paso queda anotado que el de sede vale la pena revisarlo aparte.

---

## 10. Lo que este cambio NO hace

- No toca los pagos. Un grupo no tiene tarifa propia.
- No toca las competencias ni los resultados.
- No le asigna entrenador al grupo. Es lo siguiente que van a pedir, y es una
  decisión aparte, con su propio spec.
- No cambia `Member.tipo`.
- No normaliza el comportamiento del importador de sedes. Queda anotado en la
  sección 9 como trabajo aparte.

---

## 11. Riesgos

| Riesgo | Qué tan grave | Cómo se contiene |
|---|---|---|
| La migración cambia alguna planilla en producción | Alto | La verificación fila por fila de la sección 6.3, contra un volcado real, antes de desplegar |
| Un club queda con grupos a medias y planillas raras | Medio | La regla de convivencia de la sección 6.1: sin grupo, sigue la regla vieja |
| El formulario se alarga y la gente lo abandona | Medio | Un solo campo nuevo, y oculto si el club no tiene grupos |
| `Member.category` se sigue usando para armar planillas por costumbre | Medio | Se marca en el esquema y se deja el respaldo explícitamente acotado a las clases sin grupo |

---

## 12. Cuándo

El diseño queda listo ahora. La implementación conviene después de que Wilk Skate
y New Power Skate lleven unas semanas operando, porque ahí se ve cómo organizan
los horarios de verdad. Ese dato vale más que adivinarlo hoy, y el único costo de
esperar es que durante esas semanas los horarios se sigan manejando por fuera de
la plataforma, que es como se manejan hoy.
