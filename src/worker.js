/**
 * Cotizador de Aberturas — API del Foro (Cloudflare Worker + base D1)
 *
 * El código está repartido así:
 *   worker.js     → este archivo: el mapa de rutas y qué hace cada una
 *   seguridad.js  → sesiones firmadas, contraseñas y acceso de admin
 *   imagenes.js   → validar, guardar, servir y borrar imágenes
 *   util.js       → respuestas JSON, lectura de pedidos y validaciones
 *
 * ────────────────────────────────────────────────────────────────────
 * MAPA DE RUTAS
 * ────────────────────────────────────────────────────────────────────
 * Públicas (leer el foro no pide sesión):
 *   GET  /api/categorias
 *   GET  /api/preguntas?pagina=N&categoria=ID
 *   GET  /api/preguntas/:id
 *   GET  /api/preguntas/:id/respuestas
 *   GET  /api/buscar?q=texto
 *   GET  /api/imagenes/:id
 *
 * Cuentas (las tres devuelven { token, vence, usuario }):
 *   POST /api/auth/registro   { email, nombre, password }
 *   POST /api/auth/login      { email, password }
 *   POST /api/auth/invitado   { email, nombre }  → sin contraseña, sólo para responder
 *
 * Escriben (header  Authorization: Bearer <token del foro>):
 *   POST /api/preguntas         cuenta registrada
 *   POST /api/respuestas        cuenta registrada o invitado
 *   POST /api/votos/:tipo/:id   cuenta registrada
 *   Las dos primeras aceptan multipart/form-data con hasta 3 "imagenes".
 *
 * Panel (header  Authorization: Bearer <token de admin>):
 *   POST   /api/admin/login               { password } → se compara con ADMIN_PASSWORD
 *   GET    /api/admin/stats
 *   GET    /api/admin/usuarios
 *   GET    /api/admin/respuestas
 *   DELETE /api/admin/preguntas/:id
 *   DELETE /api/admin/respuestas/:id
 *   PUT    /api/admin/preguntas/:id/lock  { is_locked }
 *   PUT    /api/admin/preguntas/:id/pin   { is_pinned }
 *
 * REGLA DE ORO: quien escribe SIEMPRE sale del token (ver exigirUsuario). Si el
 * cuerpo trae un "usuario_id", se ignora. Antes se tomaba del cuerpo, y
 * cualquiera podía publicar a nombre de cualquiera.
 *
 * Secretos (se cargan con `wrangler secret put`, nunca van en el código):
 *   SESSION_SECRET  → firma las sesiones
 *   ADMIN_PASSWORD  → contraseña del panel
 */

import {
  CORS,
  ErrorHttp,
  LARGO_MAX,
  emailValido,
  idValido,
  json,
  leerFormulario,
  leerJson,
  textoObligatorio,
} from "./util.js";
import {
  esPasswordDeAdmin,
  exigirAdmin,
  exigirSesionesConfiguradas,
  exigirUsuario,
  hashearPassword,
  passwordNueva,
  sesionDeAdmin,
  sesionDeForo,
  verificarPassword,
} from "./seguridad.js";
import { imagenesDeFila, prepararImagenes, sentenciasParaBorrar, servirImagen } from "./imagenes.js";

// Cada ruta: [método, patrón de la URL, función]. Lo que va entre paréntesis
// en el patrón llega a la función en "params" (como los <id> de Flask).
const RUTAS = [
  ["GET", /^\/api\/categorias$/, listarCategorias],
  ["GET", /^\/api\/preguntas$/, listarPreguntas],
  ["GET", /^\/api\/preguntas\/(\d+)$/, verPregunta],
  ["GET", /^\/api\/preguntas\/(\d+)\/respuestas$/, listarRespuestas],
  ["GET", /^\/api\/buscar$/, buscar],
  ["GET", /^\/api\/imagenes\/([^/]+)$/, verImagen],

  ["POST", /^\/api\/auth\/registro$/, registrar],
  ["POST", /^\/api\/auth\/login$/, iniciarSesion],
  ["POST", /^\/api\/auth\/invitado$/, entrarComoInvitado],

  ["POST", /^\/api\/preguntas$/, crearPregunta],
  ["POST", /^\/api\/respuestas$/, crearRespuesta],
  ["POST", /^\/api\/votos\/(preguntas|respuestas)\/(\d+)$/, votar],

  ["POST", /^\/api\/admin\/login$/, loginAdmin],
  ["GET", /^\/api\/admin\/stats$/, adminEstadisticas],
  ["GET", /^\/api\/admin\/usuarios$/, adminUsuarios],
  ["GET", /^\/api\/admin\/respuestas$/, adminRespuestas],
  ["DELETE", /^\/api\/admin\/preguntas\/(\d+)$/, adminBorrarPregunta],
  ["DELETE", /^\/api\/admin\/respuestas\/(\d+)$/, adminBorrarRespuesta],
  ["PUT", /^\/api\/admin\/preguntas\/(\d+)\/lock$/, adminCerrarHilo],
  ["PUT", /^\/api\/admin\/preguntas\/(\d+)\/pin$/, adminFijarHilo],
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(request.url);
    try {
      for (const [metodo, patron, manejador] of RUTAS) {
        if (request.method !== metodo) continue;
        const coincidencia = url.pathname.match(patron);
        if (coincidencia) {
          return await manejador({ request, env, url, params: coincidencia.slice(1) });
        }
      }
      return json({ ok: false, error: "Endpoint no encontrado" }, 404);
    } catch (error) {
      if (error instanceof ErrorHttp) {
        return json({ ok: false, error: error.message }, error.status);
      }
      // Errores no previstos: el detalle queda en el log (`wrangler tail`),
      // al visitante no se le muestran detalles internos.
      console.error("Error inesperado:", error);
      return json({ ok: false, error: "Error interno del servidor" }, 500);
    }
  },
};

// ═════════════════════════════ LECTURA PÚBLICA ═════════════════════════════

// Campos que se devuelven de una pregunta. Nunca incluye el email del autor.
const CAMPOS_PREGUNTA = `
  p.id, p.usuario_id, p.categoria_id, p.titulo, p.contenido, p.imagenes,
  p.fecha, p.fecha_actualizada, p.votos, p.vistas, p.respuestas_count,
  p.is_locked, p.is_pinned,
  u.nombre AS autor, u.rol, u.es_invitado,
  c.nombre AS categoria_nombre`;

const FROM_PREGUNTAS = `
  FROM preguntas p
  JOIN usuarios u ON p.usuario_id = u.id
  LEFT JOIN categorias c ON p.categoria_id = c.id`;

/** Cambia la columna imagenes (texto JSON) por la lista de imágenes que se pueden mostrar. */
function conImagenes(fila) {
  return { ...fila, imagenes: imagenesDeFila(fila.imagenes) };
}

async function listarCategorias({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, nombre, slug, descripcion FROM categorias ORDER BY nombre"
  ).all();
  return json({ categorias: results || [] });
}

async function listarPreguntas({ env, url }) {
  const POR_PAGINA = 20;
  const categoria = url.searchParams.get("categoria");
  const pagina = Math.max(1, parseInt(url.searchParams.get("pagina"), 10) || 1);
  const filtro = categoria ? "WHERE p.categoria_id = ?" : "";
  const parametros = categoria ? [categoria] : [];

  const conteo = await env.DB.prepare(`SELECT COUNT(*) AS total FROM preguntas p ${filtro}`)
    .bind(...parametros)
    .first();
  const total = conteo?.total || 0;

  const { results } = await env.DB.prepare(
    `SELECT ${CAMPOS_PREGUNTA} ${FROM_PREGUNTAS} ${filtro}
     ORDER BY p.is_pinned DESC, p.fecha_actualizada DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...parametros, POR_PAGINA, (pagina - 1) * POR_PAGINA)
    .all();

  return json({
    preguntas: (results || []).map(conImagenes),
    total,
    pagina,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil(total / POR_PAGINA),
  });
}

async function verPregunta({ env, params }) {
  const fila = await env.DB.prepare(`SELECT ${CAMPOS_PREGUNTA} ${FROM_PREGUNTAS} WHERE p.id = ?`)
    .bind(Number(params[0]))
    .first();
  if (!fila) throw new ErrorHttp(404, "La pregunta no existe");
  return json({ ok: true, pregunta: conImagenes(fila) });
}

async function listarRespuestas({ env, params }) {
  const idPregunta = Number(params[0]);
  // Abrir el hilo suma una vista (igual que antes).
  await env.DB.prepare("UPDATE preguntas SET vistas = vistas + 1 WHERE id = ?").bind(idPregunta).run();

  const { results } = await env.DB.prepare(
    `SELECT r.id, r.usuario_id, r.contenido, r.imagenes, r.fecha, r.votos, r.is_locked,
            u.nombre AS autor, u.rol, u.es_invitado, u.posts_count
     FROM respuestas r
     JOIN usuarios u ON r.usuario_id = u.id
     WHERE r.id_pregunta = ?
     ORDER BY r.votos DESC, r.fecha ASC`
  )
    .bind(idPregunta)
    .all();
  return json({ respuestas: (results || []).map(conImagenes) });
}

async function buscar({ env, url }) {
  const q = (url.searchParams.get("q") || "").trim().slice(0, LARGO_MAX.busqueda);
  if (q.length < 2) return json({ preguntas: [] });

  const categoria = url.searchParams.get("categoria");
  let sql = `SELECT ${CAMPOS_PREGUNTA} ${FROM_PREGUNTAS} WHERE (p.titulo LIKE ? OR p.contenido LIKE ?)`;
  const parametros = [`%${q}%`, `%${q}%`];
  if (categoria) {
    sql += " AND p.categoria_id = ?";
    parametros.push(categoria);
  }
  const { results } = await env.DB.prepare(`${sql} ORDER BY p.fecha DESC LIMIT 50`)
    .bind(...parametros)
    .all();
  return json({ preguntas: (results || []).map(conImagenes) });
}

async function verImagen({ env, params }) {
  return servirImagen(env, params[0]);
}

// ═════════════════════════════════ CUENTAS ═════════════════════════════════

async function registrar({ request, env }) {
  await exigirSesionesConfiguradas(env);
  const datos = await leerJson(request);
  const email = emailValido(datos.email);
  const nombre = textoObligatorio(datos.nombre, "nombre", LARGO_MAX.nombre);
  const password = passwordNueva(datos.password);

  // lower() evita tener "Ana@x.com" y "ana@x.com" como dos cuentas distintas.
  const existente = await env.DB.prepare("SELECT id FROM usuarios WHERE lower(email) = ?").bind(email).first();
  if (existente) throw new ErrorHttp(409, "Ese email ya se usó en el foro");

  let resultado;
  try {
    resultado = await env.DB.prepare(
      "INSERT INTO usuarios (email, nombre, password_hash, es_invitado) VALUES (?, ?, ?, 0)"
    )
      .bind(email, nombre, await hashearPassword(password))
      .run();
  } catch (e) {
    // Dos registros simultáneos con el mismo email: el UNIQUE de la tabla frena al segundo.
    if (String(e.message).includes("UNIQUE")) throw new ErrorHttp(409, "Ese email ya se usó en el foro");
    throw e;
  }
  // El registro deja la sesión iniciada: no hace falta loguearse después.
  return json(await sesionDeForo(env, { id: resultado.meta.last_row_id, nombre, es_invitado: 0 }), 201);
}

async function iniciarSesion({ request, env }) {
  await exigirSesionesConfiguradas(env);
  const datos = await leerJson(request);
  const email = emailValido(datos.email);
  const password = typeof datos.password === "string" ? datos.password : "";
  const ERROR = "Email o contraseña incorrectos"; // mismo mensaje para cualquier falla

  if (!password || password.length > LARGO_MAX.password) throw new ErrorHttp(401, ERROR);

  // Los invitados no tienen contraseña: nunca entran por acá.
  const usuario = await env.DB.prepare(
    "SELECT id, nombre, password_hash, es_invitado FROM usuarios WHERE lower(email) = ? AND es_invitado = 0"
  )
    .bind(email)
    .first();
  if (!usuario) throw new ErrorHttp(401, ERROR);

  const { ok, actualizar } = await verificarPassword(password, usuario.password_hash);
  if (!ok) throw new ErrorHttp(401, ERROR);

  if (actualizar) {
    // Hash en formato viejo (SHA-256 sin sal): ahora que la contraseña es
    // correcta, se guarda en el formato nuevo. Pasa una sola vez por cuenta.
    await env.DB.prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?")
      .bind(await hashearPassword(password), usuario.id)
      .run();
  }
  return json(await sesionDeForo(env, usuario));
}

/**
 * Invitado: sin contraseña, sólo nombre y email, y sólo puede responder.
 * Si el email ya se usó como invitado se reutiliza ese registro (con su
 * nombre original). Eso implica que quien sepa el email de un invitado puede
 * responder como él; se acepta porque los emails no se muestran en el foro y
 * sus mensajes siempre salen marcados como "invitado".
 */
async function entrarComoInvitado({ request, env }) {
  await exigirSesionesConfiguradas(env);
  const datos = await leerJson(request);
  const email = emailValido(datos.email);
  const nombre = textoObligatorio(datos.nombre, "nombre", LARGO_MAX.nombre);

  // Primero las cuentas registradas (es_invitado = 0), por si hubiera dos filas.
  const existente = await env.DB.prepare(
    "SELECT id, nombre, es_invitado FROM usuarios WHERE lower(email) = ? ORDER BY es_invitado ASC"
  )
    .bind(email)
    .first();

  if (existente && !existente.es_invitado) {
    // Nunca se entrega por esta vía una sesión de una cuenta con contraseña.
    throw new ErrorHttp(409, "Ese email tiene una cuenta: iniciá sesión con tu contraseña");
  }
  if (existente) {
    return json(await sesionDeForo(env, existente));
  }
  const resultado = await env.DB.prepare("INSERT INTO usuarios (email, nombre, es_invitado) VALUES (?, ?, 1)")
    .bind(email, nombre)
    .run();
  return json(await sesionDeForo(env, { id: resultado.meta.last_row_id, nombre, es_invitado: 1 }), 201);
}

// ═══════════════════════════════ ESCRITURA ════════════════════════════════

async function crearPregunta({ request, env }) {
  const usuario = await exigirUsuario(request, env); // sólo cuentas registradas
  const { campos, archivos } = await leerFormulario(request);
  const titulo = textoObligatorio(campos.titulo, "titulo", LARGO_MAX.titulo);
  const contenido = textoObligatorio(campos.contenido, "contenido", LARGO_MAX.contenido);

  const categoriaId = typeof campos.categoria_id === "string" && campos.categoria_id ? campos.categoria_id : null;
  if (categoriaId) {
    const categoria = await env.DB.prepare("SELECT id FROM categorias WHERE id = ?").bind(categoriaId).first();
    if (!categoria) throw new ErrorHttp(400, "La categoría no existe");
  }

  const { ids, sentencias } = await prepararImagenes(env, archivos, usuario.id);

  // Todo en un batch: D1 lo ejecuta como una transacción (entra todo o nada).
  const resultados = await env.DB.batch([
    ...sentencias,
    env.DB.prepare(
      `INSERT INTO preguntas (usuario_id, categoria_id, titulo, contenido, imagenes,
                              fecha, fecha_actualizada, votos, vistas, respuestas_count)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0, 0, 0)`
    ).bind(usuario.id, categoriaId, titulo, contenido, ids.length ? JSON.stringify(ids) : null),
    env.DB.prepare("UPDATE usuarios SET posts_count = posts_count + 1 WHERE id = ?").bind(usuario.id),
  ]);
  const idPregunta = resultados[sentencias.length].meta.last_row_id;
  return json({ ok: true, id: idPregunta, imagenes: ids }, 201);
}

async function crearRespuesta({ request, env }) {
  const usuario = await exigirUsuario(request, env, { permitirInvitado: true });
  const { campos, archivos } = await leerFormulario(request);
  const idPregunta = idValido(campos.id_pregunta, "id_pregunta");
  const contenido = textoObligatorio(campos.contenido, "contenido", LARGO_MAX.contenido);

  const pregunta = await env.DB.prepare("SELECT id, is_locked FROM preguntas WHERE id = ?").bind(idPregunta).first();
  if (!pregunta) throw new ErrorHttp(404, "La pregunta no existe");
  // Antes el cierre de hilos sólo se respetaba en la pantalla; ahora lo controla el servidor.
  if (pregunta.is_locked) throw new ErrorHttp(403, "El hilo está cerrado: no admite respuestas nuevas");

  const { ids, sentencias } = await prepararImagenes(env, archivos, usuario.id);

  const resultados = await env.DB.batch([
    ...sentencias,
    env.DB.prepare(
      `INSERT INTO respuestas (usuario_id, id_pregunta, contenido, imagenes, fecha, votos)
       VALUES (?, ?, ?, ?, datetime('now'), 0)`
    ).bind(usuario.id, idPregunta, contenido, ids.length ? JSON.stringify(ids) : null),
    env.DB.prepare(
      "UPDATE preguntas SET respuestas_count = respuestas_count + 1, fecha_actualizada = datetime('now') WHERE id = ?"
    ).bind(idPregunta),
    env.DB.prepare("UPDATE usuarios SET posts_count = posts_count + 1 WHERE id = ?").bind(usuario.id),
  ]);
  const idRespuesta = resultados[sentencias.length].meta.last_row_id;
  return json({ ok: true, id: idRespuesta, imagenes: ids }, 201);
}

async function votar({ request, env, params }) {
  const usuario = await exigirUsuario(request, env); // los invitados no votan
  // El nombre de la tabla sale de una lista cerrada, nunca de texto del usuario.
  const tabla = params[0] === "preguntas" ? "preguntas" : "respuestas";
  const id = Number(params[1]);

  const { tipo_voto: tipoVoto } = await leerJson(request);
  if (tipoVoto !== "up" && tipoVoto !== "down") {
    throw new ErrorHttp(400, 'tipo_voto tiene que ser "up" o "down"');
  }
  const existe = await env.DB.prepare(`SELECT id FROM ${tabla} WHERE id = ?`).bind(id).first();
  if (!existe) throw new ErrorHttp(404, "No existe lo que querés votar");

  const valor = (tipo) => (tipo === "up" ? 1 : -1);
  const anterior = await env.DB.prepare(
    "SELECT id, tipo_voto FROM votos WHERE usuario_id = ? AND tipo = ? AND contenido_id = ?"
  )
    .bind(usuario.id, tabla, id)
    .first();

  if (!anterior) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO votos (usuario_id, tipo, contenido_id, tipo_voto) VALUES (?, ?, ?, ?)").bind(
        usuario.id,
        tabla,
        id,
        tipoVoto
      ),
      env.DB.prepare(`UPDATE ${tabla} SET votos = votos + ? WHERE id = ?`).bind(valor(tipoVoto), id),
    ]);
    return json({ ok: true, action: "added" }, 201);
  }
  if (anterior.tipo_voto === tipoVoto) {
    // El mismo voto otra vez lo saca.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM votos WHERE id = ?").bind(anterior.id),
      env.DB.prepare(`UPDATE ${tabla} SET votos = votos - ? WHERE id = ?`).bind(valor(tipoVoto), id),
    ]);
    return json({ ok: true, action: "removed" });
  }
  // El voto contrario lo da vuelta: de +1 a -1 hay 2 puntos de diferencia.
  await env.DB.batch([
    env.DB.prepare("UPDATE votos SET tipo_voto = ? WHERE id = ?").bind(tipoVoto, anterior.id),
    env.DB.prepare(`UPDATE ${tabla} SET votos = votos + ? WHERE id = ?`).bind(2 * valor(tipoVoto), id),
  ]);
  return json({ ok: true, action: "changed" });
}

// ═════════════════════════════════ PANEL ═════════════════════════════════
// Todas empiezan con exigirAdmin, ANTES de leer el cuerpo o tocar la base.

async function loginAdmin({ request, env }) {
  const { password } = await leerJson(request);
  const intento = typeof password === "string" ? password : "";
  if (!intento || intento.length > LARGO_MAX.password || !(await esPasswordDeAdmin(env, intento))) {
    throw new ErrorHttp(401, "Contraseña incorrecta");
  }
  return json(await sesionDeAdmin(env));
}

async function adminEstadisticas({ request, env }) {
  await exigirAdmin(request, env);
  const stats = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM preguntas) AS total_preguntas,
       (SELECT COUNT(*) FROM respuestas) AS total_respuestas,
       (SELECT COUNT(*) FROM usuarios WHERE es_invitado = 0) AS usuarios_registrados,
       (SELECT COUNT(*) FROM usuarios WHERE es_invitado = 1) AS usuarios_invitados`
  ).first();
  return json({ ok: true, stats });
}

async function adminUsuarios({ request, env }) {
  await exigirAdmin(request, env);
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, email, es_invitado, rol, posts_count, fecha_creacion
     FROM usuarios ORDER BY fecha_creacion DESC`
  ).all();
  return json({ ok: true, usuarios: results || [] });
}

async function adminRespuestas({ request, env }) {
  await exigirAdmin(request, env);
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.contenido, r.imagenes, r.fecha, r.votos, r.is_locked,
            u.nombre AS autor, u.es_invitado,
            p.id AS id_pregunta, p.titulo AS pregunta_titulo
     FROM respuestas r
     JOIN usuarios u ON r.usuario_id = u.id
     JOIN preguntas p ON r.id_pregunta = p.id
     ORDER BY r.fecha DESC
     LIMIT 100`
  ).all();
  return json({ ok: true, respuestas: (results || []).map(conImagenes) });
}

async function adminBorrarPregunta({ request, env, params }) {
  await exigirAdmin(request, env);
  const id = Number(params[0]);

  const pregunta = await env.DB.prepare("SELECT imagenes FROM preguntas WHERE id = ?").bind(id).first();
  if (!pregunta) throw new ErrorHttp(404, "La pregunta no existe");
  const { results: respuestas } = await env.DB.prepare("SELECT imagenes FROM respuestas WHERE id_pregunta = ?")
    .bind(id)
    .all();
  const imagenes = [pregunta, ...(respuestas || [])].flatMap((fila) => imagenesDeFila(fila.imagenes));

  // El orden importa por las claves foráneas: primero lo que depende de la pregunta.
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM votos WHERE tipo = 'respuestas' AND contenido_id IN (SELECT id FROM respuestas WHERE id_pregunta = ?)"
    ).bind(id),
    env.DB.prepare("DELETE FROM votos WHERE tipo = 'preguntas' AND contenido_id = ?").bind(id),
    env.DB.prepare("DELETE FROM respuestas WHERE id_pregunta = ?").bind(id),
    env.DB.prepare("DELETE FROM preguntas WHERE id = ?").bind(id),
    ...sentenciasParaBorrar(env, imagenes),
  ]);
  return json({ ok: true, message: "Pregunta eliminada" });
}

async function adminBorrarRespuesta({ request, env, params }) {
  await exigirAdmin(request, env);
  const id = Number(params[0]);

  const respuesta = await env.DB.prepare("SELECT id_pregunta, imagenes FROM respuestas WHERE id = ?").bind(id).first();
  if (!respuesta) throw new ErrorHttp(404, "Respuesta no encontrada");

  await env.DB.batch([
    env.DB.prepare("DELETE FROM votos WHERE tipo = 'respuestas' AND contenido_id = ?").bind(id),
    env.DB.prepare("DELETE FROM respuestas WHERE id = ?").bind(id),
    env.DB.prepare("UPDATE preguntas SET respuestas_count = MAX(respuestas_count - 1, 0) WHERE id = ?").bind(
      respuesta.id_pregunta
    ),
    ...sentenciasParaBorrar(env, imagenesDeFila(respuesta.imagenes)),
  ]);
  return json({ ok: true, message: "Respuesta eliminada" });
}

async function adminCerrarHilo({ request, env, params }) {
  await exigirAdmin(request, env);
  const { is_locked: cerrar } = await leerJson(request);
  const resultado = await env.DB.prepare("UPDATE preguntas SET is_locked = ? WHERE id = ?")
    .bind(cerrar ? 1 : 0, Number(params[0]))
    .run();
  if (!resultado.meta.changes) throw new ErrorHttp(404, "La pregunta no existe");
  return json({ ok: true, message: cerrar ? "Hilo cerrado" : "Hilo reabierto" });
}

async function adminFijarHilo({ request, env, params }) {
  await exigirAdmin(request, env);
  const { is_pinned: fijar } = await leerJson(request);
  const resultado = await env.DB.prepare("UPDATE preguntas SET is_pinned = ? WHERE id = ?")
    .bind(fijar ? 1 : 0, Number(params[0]))
    .run();
  if (!resultado.meta.changes) throw new ErrorHttp(404, "La pregunta no existe");
  return json({ ok: true, message: fijar ? "Hilo fijado" : "Hilo desfijado" });
}
