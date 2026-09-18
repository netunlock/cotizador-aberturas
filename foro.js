/**
 * foro.js — Lógica del Foro de Carpinteros (foro.html).
 *
 * Cómo se maneja la sesión:
 *  - Al entrar (login, registro o "responder anónimamente") el worker devuelve
 *    un token firmado. Se guarda en localStorage junto con el nombre.
 *  - Cada pedido que ESCRIBE (preguntar, responder, votar) manda ese token en
 *    el header Authorization. El servidor sabe quién sos por el token: el
 *    navegador ya no manda ningún usuario_id.
 *  - Leer el foro no necesita sesión.
 *
 * Todo lo que escribió un usuario (títulos, mensajes, nombres) pasa por
 * escapeHtml() antes de entrar a la página. Si no, alguien podría publicar un
 * mensaje con <script> y robarle la sesión a quien lo lea.
 */

// ============================================================
// BLOQUE 1 — Configuración
// ============================================================

// Abierta desde tu PC (localhost) usa el worker de `wrangler dev`; publicada, el de Cloudflare.
const ES_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const ENDPOINT = ES_LOCAL ? "http://127.0.0.1:8787" : "https://cotizador-forum.fgpereyra-92.workers.dev";

// Imágenes: estos límites tienen que coincidir con src/imagenes.js del worker.
const MAX_IMAGENES = 3;
const MAX_BYTES_IMAGEN = 1024 * 1024; // 1 MB
const LADOS_MAX = [1600, 1200, 900]; // si no entra en 1 MB, se prueba más chica

let sesion = null; // { token, vence, usuario: { id, nombre, es_invitado } }
let paginaActual = 1;
let categorias = [];
let hiloActualId = null;
let respuestaPendiente = null; // id de la pregunta que se estaba respondiendo sin sesión

// ============================================================
// BLOQUE 1.5 — Slugs y URLs amigables
// ============================================================

/** Genera un slug legible: "Mi Pregunta #123" → "mi-pregunta-123" */
function crearSlug(titulo, id) {
  const limpio = String(titulo)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^\w\s-]/g, "") // quita caracteres especiales
    .replace(/[\s]+/g, "-") // espacios a guiones
    .replace(/[-]+/g, "-") // guiones múltiples a uno solo
    .replace(/^-+|-+$/g, ""); // quita guiones al inicio/final
  return `${limpio}-${id}`.substring(0, 80);
}

/** Obtiene la URL amigable para un post */
function urlDelPost(titulo, id) {
  const slug = crearSlug(titulo, id);
  return `foro.html?post=${slug}`;
}

/** Extrae el ID del slug: "mi-pregunta-123" → 123 */
function idDelSlug(slug) {
  const match = slug.match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Lee el slug desde la URL y abre el post automáticamente */
function cargarPostDesdUrl() {
  const params = new URLSearchParams(location.search);
  const slug = params.get("post");
  if (slug) {
    const id = idDelSlug(slug);
    if (id) {
      setTimeout(() => verHilo(id), 100); // después de que carguen los hilos
    }
  }
}

window.addEventListener("load", () => {
  cambiarTema(localStorage.getItem("temaBlog") || "clasico", false);

  // La versión anterior guardaba el usuario SIN token: esa "sesión" ya no sirve.
  localStorage.removeItem("usuarioForo");
  sesion = leerSesionGuardada();

  actualizarUserStatus();
  cargarCategorias();
  cargarHilos();
  cargarPostDesdUrl(); // abre post si viene desde URL amigable
});

// ============================================================
// BLOQUE 2 — Sesión y llamadas a la API
// ============================================================

function leerSesionGuardada() {
  try {
    const guardada = JSON.parse(localStorage.getItem("sesionForo"));
    if (guardada?.token && guardada.vence * 1000 > Date.now()) return guardada;
  } catch {
    // JSON roto: se descarta
  }
  localStorage.removeItem("sesionForo");
  return null;
}

/** Guarda la sesión que devuelve el worker en login, registro o invitado. */
function guardarSesion(datos) {
  sesion = { token: datos.token, vence: datos.vence, usuario: datos.usuario };
  localStorage.setItem("sesionForo", JSON.stringify(sesion));
  actualizarUserStatus();
}

function cerrarSesion() {
  sesion = null;
  localStorage.removeItem("sesionForo");
  actualizarUserStatus();
}

/**
 * Llama a la API y SIEMPRE devuelve un objeto (nunca tira excepción).
 *   api("/api/preguntas")                                   → lectura pública
 *   api("/api/votos/...", { metodo: "POST", json: {...} })  → con token
 *   api("/api/respuestas", { metodo: "POST", formData })    → con token e imágenes
 * Si falla, devuelve { ok: false, status, error } con un mensaje para mostrar.
 */
async function api(ruta, { metodo = "GET", json, formData } = {}) {
  const headers = {};
  let body;
  if (formData) {
    body = formData; // el navegador arma solo el Content-Type multipart
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  // El token sólo viaja en los pedidos que escriben (leer es público), y no en
  // los de /api/auth/, que justamente sirven para conseguir uno.
  const conToken = metodo !== "GET" && !ruta.startsWith("/api/auth/") && sesion;
  if (conToken) headers.Authorization = `Bearer ${sesion.token}`;

  let respuesta;
  try {
    respuesta = await fetch(ENDPOINT + ruta, { method: metodo, headers, body });
  } catch {
    return { ok: false, status: 0, error: "No se pudo conectar con el foro. Revisá tu conexión." };
  }
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch {
    // respuesta vacía o que no es JSON
  }
  if (!respuesta.ok) {
    let error = datos.error || `Error del servidor (${respuesta.status})`;
    // 401 con token = venció o dejó de valer: se cierra la sesión y se pide entrar de nuevo.
    if (respuesta.status === 401 && conToken) {
      cerrarSesion();
      error = "Tu sesión venció. Volvé a entrar.";
    }
    return { ...datos, ok: false, status: respuesta.status, error };
  }
  return datos;
}

// ============================================================
// BLOQUE 3 — Temas
// ============================================================

function cambiarTema(tema, guardar = true) {
  document.documentElement.setAttribute("data-tema", tema);
  document.querySelectorAll(".tema-btn").forEach((b) => b.classList.remove("activo"));
  // ".tema-btn" delante: si no, el selector encuentra primero al propio <html>.
  document.querySelector(`.tema-btn[data-tema="${tema}"]`)?.classList.add("activo");
  if (guardar) localStorage.setItem("temaBlog", tema);
}

// ============================================================
// BLOQUE 4 — Entrar: login, registro e invitados
// ============================================================

/** Abre el modal de login. "aviso" es un texto opcional que se muestra arriba. */
function mostrarAuthModal(aviso = "") {
  const contenedor = document.getElementById("authAviso");
  contenedor.replaceChildren();
  if (aviso) {
    const div = document.createElement("div");
    div.className = "alert alert-info";
    div.textContent = aviso;
    contenedor.appendChild(div);
  }
  document.getElementById("authModal").style.display = "flex";
  mostrarTabLogin();
}

function cerrarAuthModal() {
  document.getElementById("authModal").style.display = "none";
  for (const id of ["authAviso", "loginError", "regError"]) document.getElementById(id).innerHTML = "";
  document.getElementById("formLogin").reset();
  document.getElementById("formRegistro").reset();
}

function mostrarTabLogin() {
  document.getElementById("formLogin").style.display = "block";
  document.getElementById("formRegistro").style.display = "none";
  document.getElementById("tabLogin").style.background = "var(--color-primary)";
  document.getElementById("tabRegistro").style.background = "var(--color-bg-alt)";
}

function mostrarTabRegistro() {
  document.getElementById("formLogin").style.display = "none";
  document.getElementById("formRegistro").style.display = "block";
  document.getElementById("tabLogin").style.background = "var(--color-bg-alt)";
  document.getElementById("tabRegistro").style.background = "var(--color-primary)";
}

async function login(e) {
  e.preventDefault();
  const boton = e.target.querySelector('button[type="submit"]');
  bloquear(boton, "Entrando...");
  const datos = await api("/api/auth/login", {
    metodo: "POST",
    json: { email: valorDe("loginEmail"), password: document.getElementById("loginPassword").value },
  });
  desbloquear(boton);
  if (!datos.ok) return mostrarError("loginError", datos.error);
  guardarSesion(datos);
  cerrarAuthModal();
}

async function registro(e) {
  e.preventDefault();
  const password = document.getElementById("regPassword").value;
  if (password !== document.getElementById("regPasswordConfirm").value) {
    return mostrarError("regError", "Las contraseñas no coinciden");
  }
  const boton = e.target.querySelector('button[type="submit"]');
  bloquear(boton, "Creando cuenta...");
  const datos = await api("/api/auth/registro", {
    metodo: "POST",
    json: { email: valorDe("regEmail"), nombre: valorDe("regNombre"), password },
  });
  desbloquear(boton);
  if (!datos.ok) return mostrarError("regError", datos.error);
  guardarSesion(datos); // el registro ya deja la sesión iniciada
  cerrarAuthModal();
}

function actualizarUserStatus() {
  const status = document.getElementById("userStatus");
  const loginBtn = document.getElementById("loginBtn");
  if (sesion) {
    const marca = sesion.usuario.es_invitado ? ' <span class="insignia">invitado</span>' : "";
    status.innerHTML = `<span style="color: var(--color-accent); font-weight: bold;">${escapeHtml(sesion.usuario.nombre)}</span>${marca}
      <button class="btn" style="padding: 4px 12px; font-size: 10px; margin-left: 10px;" onclick="logout()">Desconectar</button>`;
    loginBtn.style.display = "none";
  } else {
    status.textContent = "";
    loginBtn.style.display = "inline-block";
  }
}

function logout() {
  cerrarSesion();
  cargarHilos(paginaActual);
}

// ----- Responder sin sesión: el modal de 3 opciones -----

function abrirOpcionesDeRespuesta(idPregunta) {
  respuestaPendiente = idPregunta;
  volverAOpcionesInvitado();
  document.getElementById("respuestaGuestModal").style.display = "flex";
}

function mostrarRespuestaAnonima() {
  document.getElementById("opcionesInvitado").style.display = "none";
  document.getElementById("formInvitado").style.display = "block";
  document.getElementById("invNombre").focus();
}

function volverAOpcionesInvitado() {
  document.getElementById("formInvitado").style.display = "none";
  document.getElementById("opcionesInvitado").style.display = "block";
  document.getElementById("invError").innerHTML = "";
}

/** Pide una sesión de invitado y publica la respuesta que estaba escrita. */
async function responderComoInvitado(e) {
  e.preventDefault();
  const boton = e.target.querySelector('button[type="submit"]');
  bloquear(boton, "Publicando...");
  const datos = await api("/api/auth/invitado", {
    metodo: "POST",
    json: { nombre: valorDe("invNombre"), email: valorDe("invEmail") },
  });
  desbloquear(boton);
  if (!datos.ok) return mostrarError("invError", datos.error);

  guardarSesion(datos);
  cerrarRespuestaGuestModal();
  document.getElementById("formInvitado").reset();
  if (respuestaPendiente) await publicarRespuesta(respuestaPendiente);
}

function mostrarRegistroRapido() {
  cerrarRespuestaGuestModal();
  mostrarAuthModal("Creá tu cuenta y después tocá de nuevo «Publicar Respuesta»: lo que escribiste no se pierde.");
  mostrarTabRegistro(); // después de abrir el modal, que por defecto muestra el login
}

function irAIniciarSesion() {
  cerrarRespuestaGuestModal();
  mostrarAuthModal("Entrá y después tocá de nuevo «Publicar Respuesta»: lo que escribiste no se pierde.");
}

function cerrarRespuestaGuestModal() {
  document.getElementById("respuestaGuestModal").style.display = "none";
}

// ============================================================
// BLOQUE 5 — Listado de hilos y búsqueda
// ============================================================

async function cargarCategorias() {
  const datos = await api("/api/categorias");
  categorias = datos.categorias || [];
  document.getElementById("catSelect").innerHTML =
    '<option value="">-- Elegí una categoría --</option>' +
    categorias.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}</option>`).join("");
}

async function cargarHilos(pagina = 1) {
  paginaActual = pagina;
  const d = await api(`/api/preguntas?pagina=${pagina}`);
  const lista = document.getElementById("threadsList");
  lista.classList.remove("loading");

  if (!d.preguntas) {
    lista.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px;">${escapeHtml(d.error || "No se pudo cargar el foro")}</td></tr>`;
    return;
  }
  lista.innerHTML = d.preguntas.length
    ? d.preguntas.map(filaDeHilo).join("")
    : '<tr><td colspan="4" style="text-align: center; padding: 30px;">No hay preguntas aún</td></tr>';

  let html = "";
  if (d.total_paginas > 1) {
    if (pagina > 1) html += `<a onclick="cargarHilos(${pagina - 1})">← Anterior</a>`;
    for (let i = 1; i <= Math.min(d.total_paginas, 5); i++) {
      html += pagina === i ? `<span class="active">${i}</span>` : `<a onclick="cargarHilos(${i})">${i}</a>`;
    }
    if (pagina < d.total_paginas) html += `<a onclick="cargarHilos(${pagina + 1})">Siguiente →</a>`;
  }
  document.getElementById("pagination").innerHTML = html;
  document.getElementById("totalStats").textContent = `Total: ${Number(d.total) || 0} preguntas`;
}

/** Una fila del listado. La usan tanto el listado como la búsqueda. */
function filaDeHilo(p) {
  return `
    <tr onclick="verHilo(${Number(p.id)})">
      <td>
        <div class="thread-title">
          ${p.is_pinned ? '<span class="thread-badge">📌</span>' : ""}
          ${p.is_locked ? '<span class="thread-badge">🔒</span>' : ""}
          ${p.imagenes?.length ? '<span class="thread-badge" title="Tiene imágenes">🖼️</span>' : ""}
          ${escapeHtml(p.titulo)}
        </div>
        <div class="thread-meta">por <strong>${htmlAutor(p)}</strong> en ${fecha(p.fecha)}</div>
      </td>
      <td style="text-align: center;"><strong>${Number(p.respuestas_count) || 0}</strong></td>
      <td style="text-align: center;"><strong>${Number(p.vistas) || 0}</strong></td>
      <td style="font-size: 10px;">${p.fecha_actualizada ? fecha(p.fecha_actualizada) : "N/A"}</td>
    </tr>`;
}

async function buscar() {
  const q = document.getElementById("buscar").value.trim();
  if (q.length < 2) return;
  const d = await api(`/api/buscar?q=${encodeURIComponent(q)}`);
  const preguntas = d.preguntas || [];
  document.getElementById("threadsList").innerHTML = preguntas.length
    ? preguntas.map(filaDeHilo).join("")
    : `<tr><td colspan="4" style="text-align: center;">${escapeHtml(d.error || "No se encontraron resultados")}</td></tr>`;
  document.getElementById("pagination").innerHTML = "";
}

// ============================================================
// BLOQUE 6 — Un hilo: ver, votar y responder
// ============================================================

async function verHilo(id) {
  hiloActualId = id;
  const contenido = document.getElementById("threadContent");
  contenido.innerHTML = '<div class="loading">Cargando hilo...</div>';
  document.getElementById("threadModal").style.display = "flex";

  // La pregunta se pide por su id (antes se buscaba en la página 1 del listado,
  // y los hilos de las páginas siguientes no abrían).
  const [dPregunta, dRespuestas] = await Promise.all([
    api(`/api/preguntas/${id}`),
    api(`/api/preguntas/${id}/respuestas`),
  ]);
  if (hiloActualId !== id) return; // mientras cargaba se abrió otro hilo

  if (!dPregunta.ok) {
    contenido.innerHTML = `<div class="alert alert-error">${escapeHtml(dPregunta.error)}</div>
      <div style="text-align: center;"><button class="btn btn-secondary" onclick="cerrarThread()">Cerrar</button></div>`;
    return;
  }
  const p = dPregunta.pregunta;
  const respuestas = dRespuestas.respuestas || [];

  // Actualizar URL amigable usando history.pushState
  const slug = crearSlug(p.titulo, id);
  const urlAmigable = `foro.html?post=${slug}`;
  history.pushState({ postId: id, slug }, p.titulo, urlAmigable);

  contenido.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h2 style="color: var(--color-primary); margin-top: 0;">${escapeHtml(p.titulo)}</h2>
      ${p.is_locked ? '<div class="alert alert-error">🔒 Este hilo está cerrado. No se permiten nuevas respuestas.</div>' : ""}
      ${htmlPost(p, "#1 — Post Original", "preguntas", urlAmigable)}
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--color-border);">
      <h3 style="color: var(--color-primary);">Respuestas (${respuestas.length})</h3>
      ${respuestas.map((r, i) => htmlPost(r, `#${i + 2} — ${escapeHtml(r.autor)}`, "respuestas", urlAmigable)).join("")}
      ${p.is_locked ? "" : htmlFormularioRespuesta(Number(p.id))}
    </div>

    <div style="margin-top: 20px; text-align: center;">
      <button class="btn btn-secondary" onclick="cerrarThread()">Cerrar</button>
    </div>`;
}

/**
 * Un post: la pregunta original o una respuesta.
 * OJO: "encabezado" tiene que llegar YA escapado.
 */
function htmlPost(post, encabezado, tipo, urlCompartir = "") {
  const id = Number(post.id);
  const inicial = String(post.autor || "?").charAt(0).toUpperCase();
  const urlCompleta = urlCompartir ? `${location.origin}${location.pathname}?${urlCompartir.split("?")[1]}` : location.href;
  const vistas = Number(post.vistas) || 0;

  return `
    <div class="post-container">
      <div class="post-header">${encabezado}</div>
      <div style="display: flex; gap: 15px; padding: 10px;">
        <div class="post-avatar">${escapeHtml(inicial)}</div>
        <div style="flex: 1;">
          <div style="font-weight: bold; color: var(--color-primary);">${htmlAutor(post)}</div>
          <div style="font-size: 10px; color: var(--color-text-muted);">Publicado el ${fechaHora(post.fecha)} · 👁️ ${vistas} vistas</div>
        </div>
      </div>
      <div class="post-content">${escapeHtml(post.contenido).replace(/\n/g, "<br>")}</div>
      ${htmlImagenes(post.imagenes)}
      <div class="post-footer">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="vote-btn" onclick="votar(${id}, '${tipo}', 'up')">👍</button>
            <span>${Number(post.votos) || 0}</span>
            <button class="vote-btn" onclick="votar(${id}, '${tipo}', 'down')">👎</button>
          </div>
          ${tipo === "preguntas" ? `
            <div style="display: flex; gap: 6px; border-left: 1px solid var(--color-border); padding-left: 12px;">
              <button class="vote-btn" title="Compartir en Facebook" onclick="compartirEn('facebook', '${escapeHtml(post.titulo)}', '${encodeURIComponent(urlCompleta)}')">f</button>
              <button class="vote-btn" title="Compartir en WhatsApp" onclick="compartirEn('whatsapp', '${escapeHtml(post.titulo)}', '${encodeURIComponent(urlCompleta)}')">wa</button>
              <button class="vote-btn" title="Compartir en X" onclick="compartirEn('twitter', '${escapeHtml(post.titulo)}', '${encodeURIComponent(urlCompleta)}')">𝕏</button>
              <button class="vote-btn" title="Copiar enlace" onclick="copiarEnlace('${encodeURIComponent(urlCompleta)}')">🔗</button>
            </div>
          ` : ""}
        </div>
      </div>
    </div>`;
}

/** Abre la URL de compartir en la red social especificada */
function compartirEn(red, titulo, url) {
  let enlace = "";
  const titulo_enc = encodeURIComponent(titulo);
  switch(red) {
    case "facebook":
      enlace = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      break;
    case "whatsapp":
      const msg = encodeURIComponent(`${titulo}\n\n${decodeURIComponent(url)}`);
      enlace = `https://wa.me/?text=${msg}`;
      break;
    case "twitter":
      enlace = `https://twitter.com/intent/tweet?text=${titulo_enc}&url=${url}`;
      break;
  }
  if (enlace) window.open(enlace, "_blank", "width=600,height=400");
}

/** Copia el enlace al portapapeles */
function copiarEnlace(url) {
  const texto = decodeURIComponent(url);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(() => {
      alert("Enlace copiado al portapapeles");
    });
  } else {
    // Fallback para navegadores viejos
    const input = document.createElement("textarea");
    input.value = texto;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    alert("Enlace copiado al portapapeles");
  }
}

function htmlFormularioRespuesta(idPregunta) {
  return `
    <div style="margin-top: 20px; padding: 20px; background: var(--color-bg-alt); border-radius: 3px;">
      <h4 style="margin-top: 0; color: var(--color-primary);">Responder</h4>
      <form id="formRespuesta" onsubmit="enviarRespuesta(event, ${idPregunta})">
        <div class="form-group">
          <label for="respContenido">Tu respuesta *</label>
          <textarea id="respContenido" placeholder="Escribí tu respuesta..." maxlength="10000" required></textarea>
        </div>
        <div class="form-group">
          <label for="respImagenes">Imágenes (máx ${MAX_IMAGENES})</label>
          <input type="file" id="respImagenes" class="input-archivo" accept="image/*" multiple />
        </div>
        <div id="respError"></div>
        <button type="submit" class="btn">Publicar Respuesta</button>
      </form>
    </div>`;
}

/** Miniaturas que abren la imagen completa en otra pestaña. */
function htmlImagenes(imagenes) {
  const urls = (Array.isArray(imagenes) ? imagenes : []).map(urlDeImagen).filter(Boolean);
  if (!urls.length) return "";
  const enlaces = urls.map(
    (url) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="Imagen adjunta" loading="lazy" /></a>`
  );
  return `<div class="post-images">${enlaces.join("")}</div>`;
}

/**
 * Cada imagen llega como el id de una imagen subida o, en mensajes cargados
 * antes de esta versión, como la URL de una imagen del propio sitio. El worker
 * ya filtra, pero acá se vuelve a controlar: cualquier otra cosa se descarta.
 */
function urlDeImagen(valor) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor)) {
    return `${ENDPOINT}/api/imagenes/${valor}`;
  }
  if (/^https:\/\/netunlock\.github\.io\/cotizador-aberturas\/img\/[A-Za-z0-9_\-/]+\.(?:jpe?g|png|webp)$/.test(valor)) {
    return valor;
  }
  return null;
}

function cerrarThread() {
  document.getElementById("threadModal").style.display = "none";
  hiloActualId = null;
}

async function votar(id, tabla, tipo) {
  if (!sesion) return mostrarAuthModal("Entrá o creá una cuenta para votar.");
  if (sesion.usuario.es_invitado) {
    return mostrarAuthModal("Para votar necesitás una cuenta. Como invitado sólo podés responder.");
  }
  const d = await api(`/api/votos/${tabla}/${id}`, { metodo: "POST", json: { tipo_voto: tipo } });
  if (d.ok) {
    if (hiloActualId) verHilo(hiloActualId);
  } else if (d.status === 401) {
    mostrarAuthModal(d.error);
  } else {
    alert(d.error);
  }
}

async function enviarRespuesta(e, idPregunta) {
  e.preventDefault();
  if (!sesion) return abrirOpcionesDeRespuesta(idPregunta);
  await publicarRespuesta(idPregunta);
}

async function publicarRespuesta(idPregunta) {
  const form = document.getElementById("formRespuesta");
  if (!form) return;
  const boton = form.querySelector('button[type="submit"]');
  bloquear(boton, "Publicando...");
  try {
    const formData = await armarFormulario(
      { id_pregunta: idPregunta, contenido: valorDe("respContenido") },
      document.getElementById("respImagenes").files
    );
    const d = await api("/api/respuestas", { metodo: "POST", formData });
    if (!d.ok) {
      if (d.status === 401) abrirOpcionesDeRespuesta(idPregunta); // la sesión venció
      throw new Error(d.error);
    }
    respuestaPendiente = null;
    verHilo(idPregunta);
    cargarHilos(paginaActual); // actualiza el contador de respuestas del listado
  } catch (error) {
    mostrarError("respError", error.message);
    desbloquear(boton);
  }
}

// ============================================================
// BLOQUE 7 — Nueva pregunta
// ============================================================

function mostrarNuevaPregunta() {
  if (!sesion) return mostrarAuthModal("Entrá o creá una cuenta para hacer una pregunta.");
  if (sesion.usuario.es_invitado) {
    return mostrarAuthModal("Para preguntar necesitás una cuenta. Como invitado sólo podés responder.");
  }
  document.getElementById("pregError").innerHTML = "";
  document.getElementById("preguntaModal").style.display = "flex";
}

function cerrarPreguntaModal() {
  document.getElementById("preguntaModal").style.display = "none";
}

async function crearPregunta(e) {
  e.preventDefault();
  const form = e.target;
  const boton = form.querySelector('button[type="submit"]');
  bloquear(boton, "Publicando...");
  try {
    const formData = await armarFormulario(
      {
        categoria_id: document.getElementById("catSelect").value,
        titulo: valorDe("pregTitulo"),
        contenido: valorDe("pregContenido"),
      },
      document.getElementById("pregImagenes").files
    );
    const d = await api("/api/preguntas", { metodo: "POST", formData });
    if (!d.ok) {
      if (d.status === 401 || d.status === 403) {
        cerrarPreguntaModal();
        mostrarAuthModal(d.error);
      }
      throw new Error(d.error);
    }
    form.reset();
    cerrarPreguntaModal();
    await cargarHilos(1);
    verHilo(d.id); // abre la pregunta recién publicada
  } catch (error) {
    mostrarError("pregError", error.message);
  } finally {
    desbloquear(boton);
  }
}

// ============================================================
// BLOQUE 8 — Imágenes: achicar, comprimir y armar el envío
// ============================================================

/**
 * Arma el FormData con los textos y las imágenes ya comprimidas.
 * Tira un Error con un mensaje para mostrar si alguna imagen no sirve.
 */
async function armarFormulario(campos, archivos) {
  const formData = new FormData();
  for (const [clave, valor] of Object.entries(campos)) formData.append(clave, valor);

  const lista = Array.from(archivos || []);
  if (lista.length > MAX_IMAGENES) throw new Error(`Podés adjuntar hasta ${MAX_IMAGENES} imágenes`);
  for (const archivo of lista) {
    const imagen = await comprimirImagen(archivo);
    formData.append("imagenes", imagen, imagen.type === "image/webp" ? "imagen.webp" : "imagen.jpg");
  }
  return formData;
}

/**
 * Achica la imagen (lado mayor de 1600 px como máximo) y la recomprime.
 * Una foto de celular de 4 MB queda en unos 200-400 KB. Devuelve un Blob.
 */
async function comprimirImagen(archivo) {
  if (!archivo.type.startsWith("image/")) throw new Error(`"${archivo.name}" no es una imagen`);
  let bitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    throw new Error(`No se pudo leer "${archivo.name}". Probá con una foto JPG o PNG.`);
  }
  try {
    for (const ladoMax of LADOS_MAX) {
      const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * escala));
      canvas.height = Math.max(1, Math.round(bitmap.height * escala));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // fondo blanco para los PNG con transparencia
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      // WebP deja más nítidas las capturas de pantalla; si el navegador no lo genera, JPEG.
      let blob = await canvasABlob(canvas, "image/webp", 0.85);
      if (!blob || blob.type !== "image/webp") blob = await canvasABlob(canvas, "image/jpeg", 0.85);
      if (blob && blob.size <= MAX_BYTES_IMAGEN) return blob;
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`"${archivo.name}" es demasiado grande, incluso achicada`);
}

function canvasABlob(canvas, tipo, calidad) {
  return new Promise((resolver) => canvas.toBlob(resolver, tipo, calidad));
}

// ============================================================
// BLOQUE 9 — Utilidades
// ============================================================

/** Todo texto que viene de la base pasa por acá antes de ir al HTML. */
function escapeHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(texto ?? "").replace(/[&<>"']/g, (c) => mapa[c]);
}

/** Nombre del autor con su insignia: "Admin" (rol en la base) o "invitado". */
function htmlAutor(fila) {
  let insignia = "";
  if (fila.rol === "admin") insignia = ' <span class="insignia insignia-admin">Admin</span>';
  else if (fila.es_invitado) insignia = ' <span class="insignia">invitado</span>';
  return escapeHtml(fila.autor) + insignia;
}

/** Muestra un error como texto plano (nunca como HTML). */
function mostrarError(idContenedor, mensaje) {
  const div = document.createElement("div");
  div.className = "alert alert-error";
  div.textContent = mensaje || "Ocurrió un error";
  document.getElementById(idContenedor)?.replaceChildren(div);
}

function valorDe(id) {
  return document.getElementById(id).value.trim();
}

function bloquear(boton, texto) {
  if (!boton) return;
  boton.dataset.textoOriginal = boton.textContent;
  boton.textContent = texto;
  boton.disabled = true;
}

function desbloquear(boton) {
  if (!boton || !boton.disabled) return;
  boton.textContent = boton.dataset.textoOriginal || boton.textContent;
  boton.disabled = false;
}

/** Las fechas de D1 vienen en UTC y sin zona ("2026-09-14 18:30:00"). */
function aFecha(texto) {
  if (!texto) return null;
  const iso = String(texto).replace(" ", "T");
  const d = new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fecha(texto) {
  return aFecha(texto)?.toLocaleDateString() ?? "";
}

function fechaHora(texto) {
  return aFecha(texto)?.toLocaleString() ?? "";
}
