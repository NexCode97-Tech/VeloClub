import rateLimit from 'express-rate-limit';

const mensaje = { error: 'Demasiadas solicitudes, intenta más tarde' };
const VENTANA = 15 * 60 * 1000;

/**
 * Límites por endpoint. El límite global (1000/15min) es demasiado holgado para
 * operaciones donde cada intento tiene costo o revela información, así que estos
 * se aplican de forma dirigida sobre las rutas sensibles.
 */

/** Endpoints sensibles en general: 100 req / 15 min. */
export const strictLimiter = rateLimit({
  windowMs: VENTANA,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * Adivinanza de secretos. La respuesta distingue un valor válido de uno
 * inexistente, así que sin un tope bajo se pueden probar cientos de códigos.
 * Aplica a validación de cupones y al secreto de los cron.
 */
export const guessLimiter = rateLimit({
  windowMs: VENTANA,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * Intentos de pago. Un tope bajo corta las pruebas de tarjetas robadas sin
 * estorbar a un usuario que corrige datos y reintenta.
 */
export const paymentLimiter = rateLimit({
  windowMs: VENTANA,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * Subidas de archivos. Cada petición puede pesar varios MB, así que el tope
 * protege el ancho de banda y la cuota de Cloudinary.
 */
export const uploadLimiter = rateLimit({
  windowMs: VENTANA,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * Alta de recursos que generan trabajo o notificaciones al superadmin
 * (auto-registro de clubes, solicitudes de contacto, procesos masivos).
 */
export const createLimiter = rateLimit({
  windowMs: VENTANA,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * Publicar y comentar en la comunidad. Los Terminos prohiben el spam pero
 * nada lo impedia: se podian crear publicaciones en bucle. El tope es alto a
 * proposito — una conversacion animada no debe chocar contra el —, lo que
 * corta es la automatizacion.
 */
export const comunidadLimiter = rateLimit({
  windowMs: VENTANA,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * Reportar contenido. Se limita fuerte: denunciar en masa a alguien es en si
 * mismo una forma de acoso, y la unicidad por contenido no lo impide si el
 * atacante recorre publicacion por publicacion.
 */
export const reporteLimiter = rateLimit({
  windowMs: VENTANA,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * Formulario publico de inscripcion. Es el unico punto de la plataforma donde
 * alguien sin cuenta puede crear registros, asi que lleva dos topes en vez de
 * uno.
 *
 * Por IP van 40 cada 15 minutos, y no menos: en una jornada de inscripcion los
 * papas llenan el formulario ahi mismo, todos por el wifi del coliseo, y para
 * el servidor son la misma IP. Un tope de 20 los habria frenado a mitad de
 * jornada.
 */
export const inscripcionLimiter = rateLimit({
  windowMs: VENTANA,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
});

/**
 * El segundo tope va por enlace y no por IP, que es lo que de verdad protege al
 * club: quien quiera llenarlo de fichas basura solo necesita cambiar de red
 * —datos moviles, un proxy— y el limite por IP deja de servir. El enlace, en
 * cambio, es siempre el mismo.
 *
 * 150 por hora deja pasar cualquier inscripcion real, incluida una jornada
 * entera de un club grande, y corta la automatizacion. Si a un club le sobra
 * ese margen, tiene el boton de generar un enlace nuevo, que invalida el viejo.
 */
export const inscripcionPorEnlaceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
  keyGenerator: (req) => `enlace:${req.params.token ?? 'sin-token'}`,
});
