/**
 * Cotizador de Aberturas — Foro con D1 + Categorías
 * Endpoints para preguntas, respuestas y votación, filtradas por categoría
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      // GET /api/categorias
      if (path === "/api/categorias" && request.method === "GET") {
        const result = await env.DB.prepare(
          "SELECT id, nombre, slug, descripcion FROM categorias ORDER BY nombre"
        ).all();
        return new Response(
          JSON.stringify({ categorias: result.results || [] }),
          { status: 200, headers }
        );
      }

      // GET /api/preguntas?categoria=<id>
      if (path === "/api/preguntas" && request.method === "GET") {
        const categoria = url.searchParams.get("categoria");
        let query = `
          SELECT
            p.id, p.categoria_id, p.nombre, p.email, p.pregunta,
            p.fecha, p.votos,
            c.nombre as categoria_nombre
          FROM preguntas p
          LEFT JOIN categorias c ON p.categoria_id = c.id
        `;
        let params = [];

        if (categoria) {
          query += " WHERE p.categoria_id = ?";
          params.push(categoria);
        }

        query += " ORDER BY p.fecha DESC";

        const result = await env.DB.prepare(query).bind(...params).all();
        return new Response(
          JSON.stringify({ preguntas: result.results || [] }),
          { status: 200, headers }
        );
      }

      // GET /api/preguntas/:id/respuestas
      if (path.match(/^\/api\/preguntas\/\d+\/respuestas$/) && request.method === "GET") {
        const id = path.split("/")[3];
        const result = await env.DB.prepare(
          "SELECT id, id_pregunta, nombre, email, respuesta, fecha, votos FROM respuestas WHERE id_pregunta = ? ORDER BY votos DESC, fecha ASC"
        ).bind(id).all();
        return new Response(
          JSON.stringify({ respuestas: result.results || [] }),
          { status: 200, headers }
        );
      }

      // POST /api/preguntas
      if (path === "/api/preguntas" && request.method === "POST") {
        const body = await request.json();
        const { categoria_id, nombre, email, pregunta, token } = body;

        // Validar Turnstile (si está configurado)
        if (env.TURNSTILE_SECRET_KEY && token) {
          const turnstileResult = await fetch("https://challenges.cloudflare.com/turnstile/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: env.TURNSTILE_SECRET_KEY,
              response: token
            })
          }).then(r => r.json());

          if (!turnstileResult.success) {
            return new Response(
              JSON.stringify({ ok: false, error: "Verificación de spam fallida" }),
              { status: 400, headers }
            );
          }
        }

        // Validar datos
        if (!nombre || nombre.length < 3) {
          return new Response(
            JSON.stringify({ ok: false, error: "Nombre inválido" }),
            { status: 400, headers }
          );
        }

        if (!pregunta || pregunta.length < 10) {
          return new Response(
            JSON.stringify({ ok: false, error: "Pregunta muy corta" }),
            { status: 400, headers }
          );
        }

        // Insertar pregunta
        try {
          const result = await env.DB.prepare(
            "INSERT INTO preguntas (categoria_id, nombre, email, pregunta, fecha, votos) VALUES (?, ?, ?, ?, datetime('now'), 0)"
          ).bind(categoria_id || null, nombre, email || null, pregunta).run();

          return new Response(
            JSON.stringify({ ok: true, id: result.meta.last_row_id }),
            { status: 201, headers }
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: "Error al guardar pregunta" }),
            { status: 500, headers }
          );
        }
      }

      // POST /api/respuestas
      if (path === "/api/respuestas" && request.method === "POST") {
        const body = await request.json();
        const { id_pregunta, nombre, email, respuesta, token } = body;

        // Validar Turnstile
        if (env.TURNSTILE_SECRET_KEY && token) {
          const turnstileResult = await fetch("https://challenges.cloudflare.com/turnstile/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: env.TURNSTILE_SECRET_KEY,
              response: token
            })
          }).then(r => r.json());

          if (!turnstileResult.success) {
            return new Response(
              JSON.stringify({ ok: false, error: "Verificación de spam fallida" }),
              { status: 400, headers }
            );
          }
        }

        // Validar datos
        if (!nombre || nombre.length < 3) {
          return new Response(
            JSON.stringify({ ok: false, error: "Nombre inválido" }),
            { status: 400, headers }
          );
        }

        if (!respuesta || respuesta.length < 5) {
          return new Response(
            JSON.stringify({ ok: false, error: "Respuesta muy corta" }),
            { status: 400, headers }
          );
        }

        // Insertar respuesta
        try {
          const result = await env.DB.prepare(
            "INSERT INTO respuestas (id_pregunta, nombre, email, respuesta, fecha, votos) VALUES (?, ?, ?, ?, datetime('now'), 0)"
          ).bind(id_pregunta, nombre, email || null, respuesta).run();

          return new Response(
            JSON.stringify({ ok: true, id: result.meta.last_row_id }),
            { status: 201, headers }
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: "Error al guardar respuesta" }),
            { status: 500, headers }
          );
        }
      }

      // POST /api/votos/:tabla/:id
      if (path.match(/^\/api\/votos\/(preguntas|respuestas)\/\d+$/) && request.method === "POST") {
        const parts = path.split("/");
        const tabla = parts[3];
        const id = parts[4];
        const body = await request.json();
        const { tipo } = body; // "up" o "down"

        const delta = tipo === "up" ? 1 : tipo === "down" ? -1 : 0;

        if (delta === 0) {
          return new Response(
            JSON.stringify({ ok: false, error: "Tipo de voto inválido" }),
            { status: 400, headers }
          );
        }

        try {
          await env.DB.prepare(
            `UPDATE ${tabla} SET votos = votos + ? WHERE id = ?`
          ).bind(delta, id).run();

          return new Response(
            JSON.stringify({ ok: true }),
            { status: 200, headers }
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: "Error al votar" }),
            { status: 500, headers }
          );
        }
      }

      // 404
      return new Response(
        JSON.stringify({ ok: false, error: "Endpoint no encontrado" }),
        { status: 404, headers }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers }
      );
    }
  }
};
