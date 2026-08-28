import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../auth/middleware';
import { carpetaDe } from '../lib/deportes';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { validarSubida, TipoSubida } from '../lib/upload-guard';
import { resolverNombreAutor } from '../lib/nombre-autor';
import { uploadLimiter, comunidadLimiter, reporteLimiter } from '../lib/rate-limit';
import { notify } from '../lib/notify';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

const router = Router();

const COMMENT_SELECT = {
  id: true, authorClerkId: true, authorName: true, authorRole: true,
  authorAvatar: true, content: true, createdAt: true, parentId: true,
};

const POST_INCLUDE = {
  likes:    { select: { userId: true } },
  // Sube de 50 a 100 porque ahora las respuestas comparten el cupo con los
  // comentarios raiz: un hilo largo dejaba fuera conversaciones enteras.
  comments: { select: COMMENT_SELECT, orderBy: { createdAt: 'asc' as const }, take: 100 },
};

// Quien puede editar o borrar un comentario.
//
// La regla base es la de cualquier red social: cada quien manda sobre lo suyo
// y nadie mas. La moderacion es un extra acotado — solo el administrador, y
// solo dentro de las publicaciones internas del club. En el feed publico
// aparecen publicaciones de todo el mundo y ahi no modera nadie.
function puedeTocarComentario(
  req: { user?: { role: string; clubId?: string | null } | null; auth?: { clerkId?: string } | null },
  autorClerkId: string | null,
  post: { clubId: string; scope: string },
): boolean {
  if (autorClerkId && autorClerkId === req.auth?.clerkId) return true;
  return req.user?.role === 'ADMIN'
    && post.scope === 'PRIVATE'
    && post.clubId === req.user?.clubId;
}

const createPostSchema = z.object({
  content:       z.string().min(1).max(2000),
  imageUrl:      z.string().url().optional(),
  imagePublicId: z.string().optional(),
  mediaUrl:      z.string().url().optional(),
  mediaPublicId: z.string().optional(),
  mediaType:     z.enum(['image', 'video', 'file']).optional(),
  ubicacion:     z.string().max(120).optional(),
  scope:         z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
});

const commentSchema = z.object({
  content:  z.string().min(1).max(1000),
  parentId: z.string().min(1).max(60).optional(),
});

// POST /posts/upload-media — Subir imagen/video/archivo a Cloudinary
router.post('/upload-media', uploadLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const { data, type } = req.body as { data: string; type?: 'image' | 'video' | 'raw' };

  // "raw" pasa a significar documento (PDF o imagen). Antes aceptaba cualquier
  // archivo, incluidos ejecutables y HTML servidos desde el dominio de Cloudinary.
  const tipo: TipoSubida = type === 'video' ? 'video' : type === 'raw' ? 'doc' : 'image';
  const vMedia = validarSubida(data, tipo);
  if (!vMedia.ok) return res.status(400).json({ error: vMedia.error });

  try {
    const resourceType = tipo === 'video' ? 'video' : tipo === 'doc' ? 'raw' : 'image';
    const result = await cloudinary.uploader.upload(data, {
      folder: `veloclub/posts/${req.user.clubId}`,
      resource_type: resourceType,
    });
    res.json({ url: result.secure_url, publicId: result.public_id, mediaType: resourceType });
  } catch (err) {
    console.error('Error subiendo media a Cloudinary:', err);
    res.status(500).json({ error: 'Error al subir el archivo' });
  }
});

// GET /posts?scope=public|private
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const scope  = req.query.scope === 'public' ? 'PUBLIC' : 'PRIVATE';
  const clubId = req.user.clubId ?? '';

  // Esta ruta esta declarada de club entero, porque el muro publico cruza
  // clubes y porque los likes y comentarios se hacen sobre publicaciones
  // ajenas. Por eso el muro privado lleva el deporte escrito a mano: es el
  // unico de los dos que si es de la carpeta.
  const posts = await prisma.post.findMany({
    where: scope === 'PUBLIC'
      ? { scope: 'PUBLIC' }
      : { scope: 'PRIVATE', clubId, deporteId: req.deporteId ?? '' },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ posts });
});

// POST /posts
// Publica cualquiera, incluidos los deportistas. Antes se exigia ADMIN o ENTRENADOR
// y la comunidad quedaba en manos del cuerpo tecnico; la responsabilidad de lo
// publicado es de quien lo publica, que es el unico que puede editarlo o
// borrarlo despues.
router.post('/', comunidadLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const club = await prisma.club.findUnique({
    where: { id: req.user.clubId ?? '' }, select: { name: true },
  });

  const post = await prisma.post.create({
    data: {
      clubId:        req.user.clubId ?? '',
      deporteId:     carpetaDe(req),
      clubName:      club?.name ?? '',
      authorClerkId: req.auth?.clerkId ?? null,
      authorName:    await resolverNombreAutor(req.auth?.clerkId, req.auth?.name),
      authorRole:    req.user.role,
      authorAvatar:  req.auth?.picture ?? null,
      content:       parsed.data.content,
      imageUrl:      parsed.data.mediaUrl ?? parsed.data.imageUrl ?? null,
      imagePublicId: parsed.data.mediaPublicId ?? parsed.data.imagePublicId ?? null,
      ubicacion:     parsed.data.ubicacion?.trim() || null,
      scope:         parsed.data.scope,
    },
    include: POST_INCLUDE,
  });

  emitToClub(req.user.clubId ?? '', 'posts');
  res.status(201).json({ post });
});

// DELETE /posts/:id
// PATCH /posts/:id — editar la descripcion o mover entre Publico y Mi club.
// Solo esos dos campos: la foto, el autor y la fecha no se tocan al editar.
const updatePostSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  scope:   z.enum(['PUBLIC', 'PRIVATE']).optional(),
}).refine(d => d.content !== undefined || d.scope !== undefined, {
  message: 'Nada que actualizar',
});

router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const parsed = updatePostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  // Se ata al club: buscarla solo por id permitiria editar publicaciones de
  // otros clubes, cuyos ids viajan en el feed publico.
  const post = await prisma.post.findFirst({
    where: { id: String(req.params.id), clubId: req.user.clubId ?? '' },
  });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

  // Una publicacion le pertenece a quien la hizo: ni un administrador puede
  // editar la de otro. Se valida aqui y no solo escondiendo el menu, porque
  // esconder un boton no impide llamar al endpoint.
  if (!post.authorClerkId || post.authorClerkId !== req.auth?.clerkId) {
    return res.status(403).json({ error: 'Solo el autor puede editar su publicación' });
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: {
      ...(parsed.data.content !== undefined ? { content: parsed.data.content.trim() } : {}),
      ...(parsed.data.scope   !== undefined ? { scope: parsed.data.scope } : {}),
    },
    include: POST_INCLUDE,
  });

  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ post: updated });
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const post = await prisma.post.findFirst({ where: { id: String(req.params.id), clubId: req.user.clubId ?? '' } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

  // Igual que al editar: solo el autor. Ver la nota en PATCH /posts/:id.
  if (!post.authorClerkId || post.authorClerkId !== req.auth?.clerkId) {
    return res.status(403).json({ error: 'Solo el autor puede eliminar su publicación' });
  }

  if (post.imagePublicId) {
    await cloudinary.uploader.destroy(post.imagePublicId, { resource_type: 'image' }).catch(() => {});
  }

  await prisma.post.delete({ where: { id: String(req.params.id) } });
  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ ok: true });
});

// GET /posts/:id/likes — lista de usuarios que dieron like
router.get('/:id/likes', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);

  // Mismo alcance que /comments y /like: sin esto se listaban los usuarios que
  // dieron like a publicaciones privadas de otros clubes.
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (post.scope === 'PRIVATE' && post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Sin permisos' });

  const postLikes = await prisma.postLike.findMany({
    where: { postId },
    select: { userId: true },
  });

  const clerkIds = postLikes.map(l => l.userId);
  if (clerkIds.length === 0) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: { clerkId: { in: clerkIds } },
    select: { name: true, picture: true, role: true },
  });

  res.json({ users });
});

// POST /posts/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);
  const userId = req.auth?.clerkId ?? '';

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (post.scope === 'PRIVATE' && post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Sin permisos' });

  // Consultar y despues escribir deja una rendija entre las dos consultas: con
  // dos toques seguidos, las dos peticiones ven que no hay «me gusta» y las dos
  // intentan crearlo, asi que la segunda choca contra la clave unica y salia un
  // 500 (VELOCLUB-API-7). Se resuelve dejando que la base decida: se intenta
  // borrar y, si no habia nada que borrar, se crea.
  const borrados = await prisma.postLike.deleteMany({ where: { postId, userId } });
  if (borrados.count > 0) return res.json({ liked: false });

  // createMany con skipDuplicates no falla si otra peticion se adelanto: el
  // resultado que le importa a quien toca es que quedo marcado.
  await prisma.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true });
  res.json({ liked: true });
});

// GET /posts/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (post.scope === 'PRIVATE' && post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Sin permisos' });

  const comments = await prisma.postComment.findMany({
    where: { postId },
    select: COMMENT_SELECT,
    orderBy: { createdAt: 'asc' },
  });

  res.json({ comments });
});

// POST /posts/:id/comments
router.post('/:id/comments', comunidadLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);

  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (post.scope === 'PRIVATE' && post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Sin permisos' });

  // Resolver a quien cuelga la respuesta. El padre tiene que ser del mismo
  // post: los ids de comentario viajan en los posts publicos, y sin esta
  // comprobacion se podria colgar una respuesta de un hilo de otro club.
  let parentId: string | null = null;
  // A quien se le contesta: es quien recibe el aviso, no el dueño del hilo.
  let destinatario: string | null = null;
  if (parsed.data.parentId) {
    const padre = await prisma.postComment.findFirst({
      where: { id: parsed.data.parentId, postId },
      select: { id: true, parentId: true, authorClerkId: true },
    });
    if (!padre) return res.status(404).json({ error: 'El comentario que respondes ya no existe' });
    // Un solo nivel: responderle a una respuesta cuelga del mismo raiz.
    parentId = padre.parentId ?? padre.id;
    destinatario = padre.authorClerkId;
  }

  const comment = await prisma.postComment.create({
    data: {
      postId,
      authorClerkId: req.auth?.clerkId ?? null,
      authorName:   await resolverNombreAutor(req.auth?.clerkId, req.auth?.name),
      authorRole:   req.user.role,
      authorAvatar: req.auth?.picture ?? null,
      content:      parsed.data.content,
      parentId,
    },
    select: COMMENT_SELECT,
  });

  // Aviso a quien corresponda. Una respuesta le llega a quien se le contesta;
  // un comentario suelto, al dueño de la publicacion. Nunca a uno mismo:
  // nadie necesita que le avisen de lo que acaba de escribir.
  //
  // Si es respuesta NO se avisa ademas al dueño del post: en un hilo de diez
  // mensajes recibiria diez avisos de una conversacion que no es con el.
  const aQuien = parentId ? destinatario : post.authorClerkId;
  if (aQuien && aQuien !== req.auth?.clerkId) {
    const recorte = comment.content.length > 80
      ? `${comment.content.slice(0, 80).trimEnd()}…`
      : comment.content;
    await notify(aQuien, post.clubId, {
      tipo:   parentId ? 'COMMENT_REPLY' : 'POST_COMMENT',
      titulo: parentId ? 'Respondieron tu comentario' : 'Comentaron tu publicación',
      cuerpo: `${comment.authorName}: ${recorte}`,
      link:   post.scope === 'PUBLIC' ? '/dashboard' : '/dashboard/club',
    });
  }

  emitToClub(req.user.clubId ?? '', 'posts');
  res.status(201).json({ comment });
});

// PATCH /posts/:id/comments/:commentId — editar contenido
router.patch('/:id/comments/:commentId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const content = String(req.body?.content ?? '').trim();
  if (!content) return res.status(400).json({ error: 'Contenido requerido' });

  // El comentario se ata a su post. El club ya no se filtra en la consulta:
  // uno comenta en el feed publico, donde hay publicaciones de otros clubes, y
  // atarlo aqui impedia borrar lo propio fuera del club. Quien decide es
  // `puedeTocarComentario`, que si compara el club para moderar.
  const comment = await prisma.postComment.findFirst({
    where: { id: String(req.params.commentId), postId: String(req.params.id) },
    include: { post: { select: { clubId: true, scope: true } } },
  });
  if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });
  if (!puedeTocarComentario(req, comment.authorClerkId, comment.post)) {
    return res.status(403).json({ error: 'Sin permisos' });
  }

  const updated = await prisma.postComment.update({
    where: { id: String(req.params.commentId) },
    data: { content },
    select: COMMENT_SELECT,
  });
  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ comment: updated });
});

// DELETE /posts/:id/comments/:commentId
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  // Ver la nota en PATCH: el club no se filtra aca sino al decidir permisos.
  const comment = await prisma.postComment.findFirst({
    where: { id: String(req.params.commentId), postId: String(req.params.id) },
    include: { post: { select: { clubId: true, scope: true } } },
  });
  if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });
  if (!puedeTocarComentario(req, comment.authorClerkId, comment.post)) {
    return res.status(403).json({ error: 'Sin permisos' });
  }

  // Las respuestas se van con el comentario (cascada en la FK). Se devuelven
  // los ids para que la lista del cliente los quite sin recargar el post.
  const respuestas = await prisma.postComment.findMany({
    where: { parentId: comment.id },
    select: { id: true },
  });

  await prisma.postComment.delete({ where: { id: String(req.params.commentId) } });
  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ ok: true, eliminados: [comment.id, ...respuestas.map(r => r.id)] });
});

// ─── Reportar contenido ───────────────────────────────────────────────────────
//
// Los Terminos permiten retirar contenido "previa solicitud". Esto es la
// solicitud: llega a la cola del superadmin, que es quien decide. Reportar no
// oculta nada por si solo — que una denuncia baje contenido automaticamente
// convierte el boton en un arma contra quien no cae bien.

const reporteSchema = z.object({
  motivo: z.enum([
    'SPAM', 'ACOSO', 'ODIO', 'CONTENIDO_SEXUAL', 'VIOLENCIA',
    'SUPLANTACION', 'DERECHOS_AUTOR', 'OTRO',
  ]),
  detalle: z.string().max(500).optional(),
});

// POST /posts/:id/report  ·  POST /posts/:id/comments/:commentId/report
async function crearReporte(req: Request, res: Response, commentId: string | null) {
  if (!req.auth?.clerkId) return res.status(401).json({ error: 'No autenticado' });

  const parsed = reporteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const postId = String(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, clubId: true, scope: true, content: true, authorClerkId: true, authorName: true },
  });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  // Lo interno de otro club no se ve, asi que tampoco se reporta.
  if (post.scope === 'PRIVATE' && post.clubId !== req.user?.clubId) {
    return res.status(404).json({ error: 'Publicación no encontrada' });
  }

  let contenido = post.content;
  let autorClerkId = post.authorClerkId;
  let autorNombre  = post.authorName;

  if (commentId) {
    const comment = await prisma.postComment.findFirst({
      where: { id: commentId, postId },
      select: { content: true, authorClerkId: true, authorName: true },
    });
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });
    contenido = comment.content;
    autorClerkId = comment.authorClerkId;
    autorNombre  = comment.authorName;
  }

  // Reportarse a uno mismo no tiene sentido: para eso esta borrar.
  if (autorClerkId && autorClerkId === req.auth.clerkId) {
    return res.status(400).json({ error: 'No puedes reportar tu propio contenido' });
  }

  try {
    await prisma.reporte.create({
      data: {
        postId,
        commentId,
        reporterClerkId: req.auth.clerkId,
        reporterName:    req.auth.name ?? 'Alguien',
        clubId:          post.clubId,
        motivo:          parsed.data.motivo,
        detalle:         parsed.data.detalle?.trim() || null,
        // Copia del texto: si el autor lo edita o lo borra, sin esto se
        // revisaria un reporte sobre algo que ya no existe.
        contenidoCopia:  contenido.slice(0, 2000),
        autorClerkId,
        autorNombre,
      },
    });
  } catch (err) {
    // Choque contra el indice unico: ya lo habia reportado. Se responde ok
    // igual, para no confirmarle a nadie si su reporte anterior sigue en pie.
    if (!(err && typeof err === 'object' && 'code' in err && err.code === 'P2002')) throw err;
  }

  res.status(201).json({ ok: true });
}

router.post('/:id/report', reporteLimiter, requireAuth, (req, res) =>
  crearReporte(req, res, null));

router.post('/:id/comments/:commentId/report', reporteLimiter, requireAuth, (req, res) =>
  crearReporte(req, res, String(req.params.commentId)));

export default router;
