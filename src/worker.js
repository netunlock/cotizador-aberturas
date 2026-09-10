/**
 * Cotizador de Aberturas — Foro con Auth + Imágenes + Admin
 * Endpoints REST con D1
 */

import crypto from "node:crypto";

const hashPassword = (pwd) => crypto.createHash("sha256").update(pwd).digest("hex");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      // AUTH: Registro
      if (path === "/api/auth/registro" && request.method === "POST") {
        const { email, nombre, password } = await request.json();
        if (!email || !nombre || !password) {
          return json({ ok: false, error: "Faltan campos" }, 400, headers);
        }
        const passHash = hashPassword(password);
        try {
          await env.DB.prepare(
            "INSERT INTO usuarios (email, nombre, password_hash, es_invitado) VALUES (?, ?, ?, 0)"
          ).bind(email, nombre, passHash).run();
          return json({ ok: true, message: "Registrado correctamente" }, 201, headers);
        } catch (e) {
          return json({ ok: false, error: "Email ya existe" }, 400, headers);
        }
      }

      // AUTH: Login
      if (path === "/api/auth/login" && request.method === "POST") {
        const { email, password } = await request.json();
        if (!email || !password) {
          return json({ ok: false, error: "Faltan campos" }, 400, headers);
        }
        const passHash = hashPassword(password);
        const user = await env.DB.prepare(
          "SELECT id, nombre FROM usuarios WHERE email = ? AND password_hash = ?"
        ).bind(email, passHash).first();

        if (!user) {
          return json({ ok: false, error: "Credenciales inválidas" }, 401, headers);
        }
        return json({ ok: true, usuario: { id: user.id, nombre: user.nombre, email } }, 200, headers);
      }

      // AUTH: Login como invitado
      if (path === "/api/auth/invitado" && request.method === "POST") {
        const { nombre, email } = await request.json();
        if (!nombre || !email) {
          return json({ ok: false, error: "Faltan campos" }, 400, headers);
        }
        // Crear usuario temporal
        try {
          const result = await env.DB.prepare(
            "INSERT INTO usuarios (email, nombre, es_invitado) VALUES (?, ?, 1)"
          ).bind(email, nombre).run();
          return json(
            { ok: true, usuario: { id: result.meta.last_row_id, nombre, email, es_invitado: true } },
            201,
            headers
          );
        } catch (e) {
          // Si el email ya existe como invitado, devolverlo
          const existing = await env.DB.prepare(
            "SELECT id FROM usuarios WHERE email = ? AND es_invitado = 1"
          ).bind(email).first();
          if (existing) {
            return json({ ok: true, usuario: { id: existing.id, nombre, email, es_invitado: true } }, 200, headers);
          }
          return json({ ok: false, error: "Error creando sesión" }, 500, headers);
        }
      }

      // CATEGORÍAS
      if (path === "/api/categorias" && request.method === "GET") {
        const cats = await env.DB.prepare(
          "SELECT id, nombre, slug, descripcion FROM categorias ORDER BY nombre"
        ).all();
        return json({ categorias: cats.results || [] }, 200, headers);
      }

      // PREGUNTAS: Listar
      if (path === "/api/preguntas" && request.method === "GET") {
        const categoria = url.searchParams.get("categoria");
        let query = `
          SELECT
            p.id, p.usuario_id, p.categoria_id, p.titulo, p.contenido,
            p.imagenes, p.fecha, p.votos,
            u.nombre as autor,
            c.nombre as categoria_nombre
          FROM preguntas p
          JOIN usuarios u ON p.usuario_id = u.id
          LEFT JOIN categorias c ON p.categoria_id = c.id
        `;
        let params = [];

        if (categoria) {
          query += " WHERE p.categoria_id = ?";
          params.push(categoria);
        }

        query += " ORDER BY p.fecha DESC LIMIT 50";

        const result = await env.DB.prepare(query).bind(...params).all();
        return json({ preguntas: result.results || [] }, 200, headers);
      }

      // PREGUNTAS: Crear
      if (path === "/api/preguntas" && request.method === "POST") {
        const { usuario_id, categoria_id, titulo, contenido, imagenes } = await request.json();

        if (!usuario_id || !titulo || !contenido) {
          return json({ ok: false, error: "Faltan campos" }, 400, headers);
        }

        try {
          const result = await env.DB.prepare(
            `INSERT INTO preguntas (usuario_id, categoria_id, titulo, contenido, imagenes, fecha, votos)
             VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`
          ).bind(usuario_id, categoria_id || null, titulo, contenido, imagenes ? JSON.stringify(imagenes) : null).run();

          return json({ ok: true, id: result.meta.last_row_id }, 201, headers);
        } catch (e) {
          console.error("Error creando pregunta:", e);
          return json({ ok: false, error: "Error al guardar" }, 500, headers);
        }
      }

      // RESPUESTAS: Listar
      if (path.match(/^\/api\/preguntas\/\d+\/respuestas$/) && request.method === "GET") {
        const id = path.split("/")[3];
        const result = await env.DB.prepare(
          `SELECT r.id, r.usuario_id, r.contenido, r.imagenes, r.fecha, r.votos,
                  u.nombre as autor
           FROM respuestas r
           JOIN usuarios u ON r.usuario_id = u.id
           WHERE r.id_pregunta = ?
           ORDER BY r.votos DESC, r.fecha ASC`
        ).bind(id).all();
        return json({ respuestas: result.results || [] }, 200, headers);
      }

      // RESPUESTAS: Crear
      if (path === "/api/respuestas" && request.method === "POST") {
        const { usuario_id, id_pregunta, contenido, imagenes } = await request.json();

        if (!usuario_id || !id_pregunta || !contenido) {
          return json({ ok: false, error: "Faltan campos" }, 400, headers);
        }

        try {
          const result = await env.DB.prepare(
            `INSERT INTO respuestas (usuario_id, id_pregunta, contenido, imagenes, fecha, votos)
             VALUES (?, ?, ?, ?, datetime('now'), 0)`
          ).bind(usuario_id, id_pregunta, contenido, imagenes ? JSON.stringify(imagenes) : null).run();

          return json({ ok: true, id: result.meta.last_row_id }, 201, headers);
        } catch (e) {
          console.error("Error creando respuesta:", e);
          return json({ ok: false, error: "Error al guardar" }, 500, headers);
        }
      }

      // VOTOS: Registrar
      if (path.match(/^\/api\/votos\/(preguntas|respuestas)\/\d+$/) && request.method === "POST") {
        const parts = path.split("/");
        const tabla = parts[3] === "preguntas" ? "preguntas" : "respuestas";
        const id = parts[4];
        const { usuario_id, tipo_voto } = await request.json();

        if (!usuario_id || !tipo_voto) {
          return json({ ok: false, error: "Faltan campos" }, 400, headers);
        }

        try {
          // Verificar si ya votó
          const existing = await env.DB.prepare(
            "SELECT id, tipo_voto FROM votos WHERE usuario_id = ? AND tipo = ? AND contenido_id = ?"
          ).bind(usuario_id, tabla, id).first();

          if (existing) {
            if (existing.tipo_voto === tipo_voto) {
              // Deshacer voto
              await env.DB.prepare("DELETE FROM votos WHERE id = ?").bind(existing.id).run();
              const delta = tipo_voto === "up" ? -1 : 1;
              await env.DB.prepare(`UPDATE ${tabla} SET votos = votos + ? WHERE id = ?`).bind(delta, id).run();
              return json({ ok: true, action: "removed" }, 200, headers);
            } else {
              // Cambiar voto
              const oldDelta = existing.tipo_voto === "up" ? -1 : 1;
              const newDelta = tipo_voto === "up" ? 1 : -1;
              const totalDelta = oldDelta + newDelta;

              await env.DB.prepare("UPDATE votos SET tipo_voto = ? WHERE id = ?").bind(tipo_voto, existing.id).run();
              await env.DB.prepare(`UPDATE ${tabla} SET votos = votos + ? WHERE id = ?`).bind(totalDelta, id).run();
              return json({ ok: true, action: "changed" }, 200, headers);
            }
          } else {
            // Nuevo voto
            await env.DB.prepare(
              "INSERT INTO votos (usuario_id, tipo, contenido_id, tipo_voto) VALUES (?, ?, ?, ?)"
            ).bind(usuario_id, tabla, id, tipo_voto).run();

            const delta = tipo_voto === "up" ? 1 : -1;
            await env.DB.prepare(`UPDATE ${tabla} SET votos = votos + ? WHERE id = ?`).bind(delta, id).run();
            return json({ ok: true, action: "added" }, 201, headers);
          }
        } catch (e) {
          console.error("Error votando:", e);
          return json({ ok: false, error: "Error al votar" }, 500, headers);
        }
      }

      // BÚSQUEDA: Preguntas por palabra clave
      if (path === "/api/buscar" && request.method === "GET") {
        const q = url.searchParams.get("q") || "";
        const categoria = url.searchParams.get("categoria");

        if (q.length < 2) {
          return json({ preguntas: [] }, 200, headers);
        }

        let query = `
          SELECT
            p.id, p.usuario_id, p.categoria_id, p.titulo, p.contenido,
            p.imagenes, p.fecha, p.votos,
            u.nombre as autor,
            c.nombre as categoria_nombre
          FROM preguntas p
          JOIN usuarios u ON p.usuario_id = u.id
          LEFT JOIN categorias c ON p.categoria_id = c.id
          WHERE (p.titulo LIKE ? OR p.contenido LIKE ?)
        `;
        let params = [`%${q}%`, `%${q}%`];

        if (categoria) {
          query += " AND p.categoria_id = ?";
          params.push(categoria);
        }

        query += " ORDER BY p.fecha DESC LIMIT 50";

        const result = await env.DB.prepare(query).bind(...params).all();
        return json({ preguntas: result.results || [] }, 200, headers);
      }

      // ADMIN: Estadísticas
      if (path === "/api/admin/stats" && request.method === "GET") {
        const adminToken = url.searchParams.get("token");
        // Token simple (en producción usar JWT o similar)
        if (adminToken !== "admin123") {
          return json({ ok: false, error: "No autorizado" }, 401, headers);
        }

        const stats = await env.DB.prepare(
          `SELECT
            (SELECT COUNT(*) FROM preguntas) as total_preguntas,
            (SELECT COUNT(*) FROM respuestas) as total_respuestas,
            (SELECT COUNT(*) FROM usuarios WHERE es_invitado = 0) as usuarios_registrados,
            (SELECT COUNT(*) FROM usuarios WHERE es_invitado = 1) as usuarios_invitados`
        ).first();

        return json({ ok: true, stats }, 200, headers);
      }

      // ADMIN: Listar usuarios
      if (path === "/api/admin/usuarios" && request.method === "GET") {
        const adminToken = url.searchParams.get("token");
        if (adminToken !== "admin123") {
          return json({ ok: false, error: "No autorizado" }, 401, headers);
        }

        const users = await env.DB.prepare(
          "SELECT id, nombre, email, es_invitado, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC"
        ).all();

        return json({ ok: true, usuarios: users.results || [] }, 200, headers);
      }

      // ADMIN: Eliminar pregunta
      if (path.match(/^\/api\/admin\/preguntas\/\d+$/) && request.method === "DELETE") {
        const adminToken = url.searchParams.get("token");
        if (adminToken !== "admin123") {
          return json({ ok: false, error: "No autorizado" }, 401, headers);
        }

        const id = path.split("/")[4];
        if (!id || isNaN(id)) {
          return json({ ok: false, error: "ID inválido" }, 400, headers);
        }

        try {
          const result = await env.DB.prepare("DELETE FROM preguntas WHERE id = ?").bind(id).run();
          return json({ ok: true, message: "Pregunta eliminada", result: result.meta }, 200, headers);
        } catch (e) {
          console.error("Error DELETE pregunta:", e);
          return json({ ok: false, error: e.message || "Error al eliminar" }, 500, headers);
        }
      }

      // 404
      return json({ ok: false, error: "Endpoint no encontrado" }, 404, headers);
    } catch (error) {
      console.error("Error general:", error);
      return json({ ok: false, error: error.message }, 500, headers);
    }
  },
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
