# VeloClub — Diseño de la Aplicación

**Fecha:** 2026-04-27
**Estado:** Aprobado por el usuario

---

## 1. Resumen

VeloClub es una aplicación SaaS multi-tenant para clubes de patinaje. Cada club que se registra obtiene su propio espacio aislado dentro de la plataforma, con su propia base de datos de miembros, sedes, pagos, asistencia, logros y calendario. La app está pensada para que los clubes gestionen toda su operación diaria desde un único lugar.

---

## 2. Arquitectura General

La app se divide en tres servicios externos:

- **Vercel** — aloja el frontend (lo que ven los usuarios: pantallas, formularios, dashboard)
- **Render** — aloja el backend (la lógica del negocio y la base de datos)
- **Cloudinary** — aloja los archivos e imágenes (foto de perfil, documentos de identidad, seguros médicos)

**Autenticación:** Login con Google para los tres roles (admin, entrenador, alumno).

**Multi-tenant:** Cada club es un tenant aislado. Los datos de un club nunca son visibles para otro club.

---

## 3. Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso completo a todas las secciones. Gestiona el club, las sedes, miembros, pagos, flujo de caja, logros, calendario, reportes. |
| **Entrenador** | Mismos permisos que admin (en la práctica suele ser la misma persona). Registra asistencia, pagos, logros y crea eventos. |
| **Alumno** | Solo llena su perfil personal y consulta su información (asistencia, pagos, logros, calendario). No puede registrar ni modificar nada operativo. |

---

## 4. Flujo de Alta de un Club

1. El admin del club entra a la app y se registra con Google.
2. Crea su club (nombre, datos básicos).
3. Agrega las sedes que tiene el club.
4. Invita a entrenadores y alumnos (estos también ingresan con Google).
5. Comienza a operar normalmente.

---

## 5. Secciones de la App

El menú lateral contiene las siguientes secciones, mostradas según el rol del usuario:

1. **Dashboard** — Resumen al entrar, distinto por rol.
2. **Miembros** — Lista de alumnos, alta y gestión de sus datos.
3. **Asistencia** — Registro diario por grupo.
4. **Pagos** — Registro de mensualidades y estado por alumno.
5. **Flujo de Caja** — Ingresos, egresos y saldo del club.
6. **Logros** — Resultados por competencia y prueba.
7. **Calendario** — Eventos: entrenamientos, puntos de encuentro, competencias.
8. **Reportes** — Resúmenes y estadísticas del club.
9. **Notificaciones** — Campanita con avisos relevantes.

---

## 6. Detalle por Sección

### 6.1 Dashboard

Primera pantalla al entrar. Contenido según rol:

- **Admin/Entrenador:** alumnos con pagos pendientes, asistencia del día, saldo de flujo de caja, próximos eventos.
- **Alumno:** estado de su pago, su asistencia del mes, sus logros, próximos eventos.

### 6.2 Miembros

Lista de todos los alumnos del club. El entrenador/admin agrega alumnos y gestiona sus datos. El alumno completa su perfil.

**Perfil del alumno (en este orden):**

1. Nombre completo
2. Foto de perfil (Cloudinary)
3. Fecha de nacimiento
4. Documento de identidad — número en texto + adjunto del documento (PDF o JPG, Cloudinary)
5. Teléfono y contacto de emergencia
6. Seguro médico — adjunto (PDF o JPG, Cloudinary)
7. Sede o sedes a las que pertenece (puede ser más de una)
8. Categoría o nivel de patinaje

### 6.3 Asistencia

El entrenador selecciona la fecha y su grupo, y marca a cada alumno con uno de cuatro estados:

- Presente
- Ausente
- Excusa médica
- Tarde

El alumno consulta su historial completo de asistencia.

### 6.4 Pagos

- El entrenador/admin registra manualmente cada pago de mensualidad.
- Una mensualidad cubre todas las sedes a las que pertenece el alumno (no se paga por sede).
- Cada alumno tiene su propia fecha límite de pago, definida y ajustable por el entrenador/admin.
- La app envía notificaciones dentro de la app cuando se acerca o vence la fecha de pago.
- El alumno consulta su historial completo de pagos.

### 6.5 Flujo de Caja

Solo visible para admin/entrenador. Único para todo el club (las sedes no manejan flujo de caja independiente).

- **Ingresos:** se registran automáticamente cuando el entrenador/admin marca un pago de mensualidad.
- **Egresos:** los registra manualmente el entrenador/admin (arriendo, servicios, otros).
- **Devoluciones:** cuando se devuelve un pago a un alumno, se descuenta automáticamente del flujo de caja.
- Muestra el saldo total en tiempo real.

### 6.6 Logros

Los logros están atados a las competencias creadas en el calendario.

**Flujo:**

1. El entrenador crea una competencia en el calendario (nombre, fecha, lugar).
2. Dentro de la competencia agrega las pruebas que hubo (texto libre — el entrenador las escribe según las pruebas reales del patinaje).
3. Por cada prueba registra el resultado de cada deportista:
   - Posición
   - Categoría
   - Observaciones
4. El alumno consulta su historial completo de competencias, pruebas y resultados.

### 6.7 Calendario

El entrenador/admin crea eventos. Todos los roles pueden ver el calendario.

**Tipos de evento:**

- Entrenamiento
- Punto de encuentro
- Competencia (estas son las que se usan luego en logros)

**Recurrencia:**

- Eventos únicos (un solo día).
- Eventos recurrentes (por ejemplo, todos los días, o ciertos días de la semana).

**Asignación:**

- Por grupo de alumnos.
- Por sede.

### 6.8 Reportes

Solo admin/entrenador. Muestra resúmenes:

- Cuántos alumnos pagaron este mes y cuántos están pendientes.
- Porcentaje de asistencia por grupo o sede.
- Resumen de logros por competencia.
- Resumen de ingresos vs egresos del mes.

### 6.9 Notificaciones

Campanita en la parte superior. Solo dentro de la app (sin correo en esta etapa).

**Eventos que generan notificación:**

- Pago próximo a vencer.
- Pago vencido.
- Nuevo logro registrado (al alumno).
- Nuevo evento en el calendario (a los asignados).
- Cambios en eventos existentes.

---

## 7. Flujo de Datos

```
Usuario → Vercel (frontend) → Render (backend + base de datos) → Cloudinary (archivos)
```

- Cada petición del usuario pasa por el frontend en Vercel, que llama al backend en Render.
- Las imágenes y archivos (foto de perfil, documento de identidad, seguro médico) se suben directamente a Cloudinary; el backend solo guarda la URL.
- La autenticación con Google la valida el backend antes de permitir cualquier acción.

---

## 8. Aislamiento Multi-Tenant

- Cada club tiene un identificador único.
- Toda consulta al backend filtra por el club del usuario autenticado.
- Un usuario solo puede pertenecer a un club a la vez en esta etapa.
- Los datos (miembros, pagos, sedes, eventos, logros) están separados por club.

---

## 9. Fuera de Alcance (no incluido en esta versión)

- Notificaciones por correo electrónico (solo dentro de la app).
- WhatsApp.
- Pasarelas de pago automáticas (los pagos son registro manual).
- Flujo de caja independiente por sede.
- Que un alumno pertenezca a múltiples clubes.
- Pruebas predefinidas a nivel de plataforma (las escribe el entrenador cada vez).

---

## 10. Próximos Pasos

Pasar a la fase de plan de implementación: definir el orden de construcción, la base de datos detallada, las pantallas, las APIs, y los hitos de entrega.
