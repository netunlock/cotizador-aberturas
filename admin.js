/**
 * admin.js — Panel de administración del foro (admin.html).
 *
 * El login ya NO se valida acá. La contraseña viaja al worker
 * (POST /api/admin/login), que la compara con el secreto ADMIN_PASSWORD y
 * devuelve un token firmado que vence a las 8 horas. En este archivo no hay
 * ninguna contraseña ni token escrito: el repo es público y cualquiera puede
 * leerlo, así que acá no puede haber nada que sirva para entrar.
 *
 * El token se guarda en sessionStorage: se borra solo al cerrar la pestaña.
 *
 * Todo lo que escribieron los usuarios pasa por escapeHtml() antes de
 * mostrarse. En el panel es clave: si alguien publica un mensaje con <script>
 * y el panel lo mostrara tal cual, ese código correría con TU sesión de admin.
 */

// Abierto desde tu PC (localhost) usa el worker de `wrangler dev`; publicado, el de Cloudflare.
const ES_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const ENDPOINT = ES_LOCAL ? "http://127.0.0.1:8787" : "https://cotizador-forum.fgpereyra-92.workers.dev";

let sesionAdmin = null; // { token, vence }

window.addEventListener("load", () => {
  // Resto de la versión vieja: "adminLogin" no era una sesión real.
  localStorage.removeItem("adminLogin");
  try {
    const guardada = JSON.parse(sessionStorage.getItem("adminSesion"));
    if (guardada?.token && guardada.vence * 1000 > Date.now()) {
      sesionAdmin = guardada;
      mostrarDashboard();
      return;
    }
  } catch {
    // JSON roto: se descarta
  }
  sessionStorage.removeItem("adminSesion");
});

// ===== SESIÓN =====

async function login(e) {
  e.preventDefault();
  const campo = document.getElementById("password");
  const boton = e.target.querySelector('button[type="submit"]');
  boton.disabled = true;
  const datos = await api("/api/admin/login", { metodo: "POST", json: { password: campo.value } });
  boton.disabled = false;
  campo.value = ""; // la contraseña no queda cargada en el formulario

  if (!datos.ok) return mostrarErrorLogin(datos.error || "No se pudo ingresar");
  sesionAdmin = { token: datos.token, vence: datos.vence };
  sessionStorage.setItem("adminSesion", JSON.stringify(sesionAdmin));
  mostrarDashboard();
}

function logout(mensaje = "") {
  sesionAdmin = null;
  sessionStorage.removeItem("adminSesion");
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("adminNombre").textContent = "";
  document.getElementById("password").value = "";
  if (mensaje) mostrarErrorLogin(mensaje);
  else document.getElementById("loginError").innerHTML = "";
}

function mostrarDashboard() {
  document.getElementById("loginError").innerHTML = "";
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  document.getElementById("adminNombre").textContent = "Administrador";
  cargarDatos();
}

function mostrarErrorLogin(mensaje) {
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = mensaje;
  document.getElementById("loginError").replaceChildren(div);
}

/**
 * Llama a la API con el token de admin y SIEMPRE devuelve un objeto.
 * Si el servidor contesta 401 (token vencido o inválido), vuelve al login.
 */
async function api(ruta, { metodo = "GET", json } = {}) {
  const headers = {};
  if (sesionAdmin) headers.Authorization = `Bearer ${sesionAdmin.token}`;
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  let respuesta;
  try {
    respuesta = await fetch(ENDPOINT + ruta, { method: metodo, headers, body });
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch {
    // respuesta vacía o que no es JSON
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta !== "/api/admin/login" && sesionAdmin) {
      logout("La sesión venció o no es válida. Volvé a ingresar.");
    }
    return { ...datos, ok: false, error: datos.error || `Error del servidor (${respuesta.status})` };
  }
  return datos;
}

// ===== DATOS =====

async function cargarDatos() {
  const [stats, preguntas, usuarios, respuestas] = await Promise.all([
    api("/api/admin/stats"),
    api("/api/preguntas"),
    api("/api/admin/usuarios"),
    api("/api/admin/respuestas"),
  ]);
  if (!sesionAdmin) return; // hubo un 401 y ya se volvió al login

  renderEstadisticas(stats);
  renderPreguntas(preguntas);
  renderUsuarios(usuarios);
  renderRespuestas(respuestas);
  renderModeracion(respuestas);
}

/** Pone el contenido de una pestaña (y le saca el estilo de "Cargando..."). */
function pintar(idLista, html) {
  const lista = document.getElementById(idLista);
  lista.classList.remove("loading");
  lista.innerHTML = html;
}

const errorHtml = (d) => `<div class="error">${escapeHtml(d.error || "No se pudo cargar")}</div>`;
const insigniaInvitado = (fila) => (fila.es_invitado ? ' <span class="insignia">invitado</span>' : "");

function renderEstadisticas(d) {
  const s = d.stats || {};
  const tarjeta = (valor, etiqueta) =>
    `<div class="stat-card"><div class="stat-value">${Number(valor) || 0}</div><div class="stat-label">${etiqueta}</div></div>`;
  document.getElementById("statsGrid").innerHTML = d.ok
    ? tarjeta(s.total_preguntas, "Preguntas") +
      tarjeta(s.total_respuestas, "Respuestas") +
      tarjeta(s.usuarios_registrados, "Usuarios (Registrados)") +
      tarjeta(s.usuarios_invitados, "Usuarios (Invitados)")
    : errorHtml(d);
}

function renderPreguntas(d) {
  if (!d.preguntas) return pintar("preguntasLista", errorHtml(d));
  if (!d.preguntas.length) return pintar("preguntasLista", "<p>No hay preguntas</p>");
  pintar(
    "preguntasLista",
    `<table class="tabla">
      <thead><tr><th>Título</th><th>Autor</th><th>Categoría</th><th>Votos</th><th>Acción</th></tr></thead>
      <tbody>
        ${d.preguntas
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.titulo)}${p.imagenes?.length ? ` <span title="Imágenes adjuntas">🖼️ ${p.imagenes.length}</span>` : ""}</td>
            <td>${escapeHtml(p.autor)}${insigniaInvitado(p)}</td>
            <td>${escapeHtml(p.categoria_nombre || "—")}</td>
            <td>${Number(p.votos) || 0}</td>
            <td><button class="btn-pequeño" onclick="eliminarPregunta(${Number(p.id)}, this)">Eliminar</button></td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`
  );
}

function renderUsuarios(d) {
  if (!d.ok) return pintar("usuariosLista", errorHtml(d));
  if (!d.usuarios.length) return pintar("usuariosLista", "<p>No hay usuarios</p>");
  pintar(
    "usuariosLista",
    `<table class="tabla">
      <thead><tr><th>Nombre</th><th>Email</th><th>Tipo</th><th>Posts</th><th>Fecha</th></tr></thead>
      <tbody>
        ${d.usuarios
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.nombre)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.es_invitado ? "Invitado" : "Registrado"}${u.rol === "admin" ? " (admin)" : ""}</td>
            <td>${Number(u.posts_count) || 0}</td>
            <td>${fecha(u.fecha_creacion)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`
  );
}

function renderRespuestas(d) {
  if (!d.ok) return pintar("respuestasLista", errorHtml(d));
  if (!d.respuestas.length) return pintar("respuestasLista", "<p>No hay respuestas</p>");
  pintar(
    "respuestasLista",
    `<table class="tabla">
      <thead><tr><th>ID</th><th>Autor</th><th>En Post</th><th>Contenido</th><th>Votos</th><th>Acciones</th></tr></thead>
      <tbody>
        ${d.respuestas
          .map((r) => {
            const texto = String(r.contenido || "");
            return `
          <tr>
            <td>${Number(r.id)}</td>
            <td>${escapeHtml(r.autor)}${insigniaInvitado(r)}</td>
            <td>${escapeHtml(String(r.pregunta_titulo || "").substring(0, 40))}</td>
            <td>${escapeHtml(texto.substring(0, 50))}${texto.length > 50 ? "…" : ""}${r.imagenes?.length ? ` 🖼️ ${r.imagenes.length}` : ""}</td>
            <td>${Number(r.votos) || 0}</td>
            <td><button class="btn-pequeno" style="background: var(--color-error);" onclick="eliminarRespuesta(${Number(r.id)}, this)">Eliminar</button></td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>`
  );
}

/** Tarjetas con las últimas 10 respuestas completas, con sus imágenes. */
function renderModeracion(d) {
  if (!d.ok) return pintar("moderacionLista", errorHtml(d));
  const recientes = d.respuestas.slice(0, 10);
  if (!recientes.length) return pintar("moderacionLista", "<p>No hay contenido para moderar</p>");
  pintar(
    "moderacionLista",
    `<h3>Respuestas recientes para revisar</h3>
    ${recientes
      .map(
        (r) => `
      <div class="tarjeta-moderacion">
        <div style="color: var(--color-primary); font-weight: bold; margin-bottom: 5px;">👤 ${escapeHtml(r.autor)}${insigniaInvitado(r)}</div>
        <div style="color: var(--color-text-muted); font-size: 11px; margin-bottom: 10px;">
          En: "${escapeHtml(String(r.pregunta_titulo || "").substring(0, 50))}" | Votos: ${Number(r.votos) || 0} | ${fechaHora(r.fecha)}
        </div>
        <div style="color: var(--color-text-body); margin-bottom: 10px; word-wrap: break-word;">${escapeHtml(r.contenido).replace(/\n/g, "<br>")}</div>
        ${miniaturas(r.imagenes)}
        <button class="btn-pequeno" style="background: var(--color-error);" onclick="eliminarRespuesta(${Number(r.id)}, this)">🗑️ Eliminar</button>
      </div>`
      )
      .join("")}`
  );
}

function miniaturas(imagenes) {
  const urls = (Array.isArray(imagenes) ? imagenes : []).map(urlDeImagen).filter(Boolean);
  if (!urls.length) return "";
  const enlaces = urls.map(
    (url) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="Imagen adjunta" loading="lazy" /></a>`
  );
  return `<div class="miniaturas">${enlaces.join("")}</div>`;
}

/**
 * Cada imagen llega como el id de una imagen subida o, en mensajes cargados
 * antes de esta versión, como la URL de una imagen del propio sitio. Cualquier
 * otra cosa se descarta (el worker ya filtra, pero acá se vuelve a controlar).
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

function cambiarTab(tab, boton) {
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("visible"));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("activo"));
  document.getElementById(tab).classList.add("visible");
  boton.classList.add("activo");
}

// ===== ACCIONES =====

/**
 * Primer clic: el botón pide confirmación durante 3 segundos.
 * Devuelve true sólo si es el segundo clic, dentro de ese tiempo.
 */
function confirmarConSegundoClic(btn) {
  if (btn.dataset.confirmando === "si") return true;
  const textoOriginal = btn.textContent;
  btn.dataset.confirmando = "si";
  btn.textContent = "¿Confirmás?";
  btn.style.opacity = "0.7";
  setTimeout(() => {
    btn.dataset.confirmando = "";
    btn.textContent = textoOriginal;
    btn.style.opacity = "1";
  }, 3000);
  return false;
}

async function eliminarPregunta(id, btn) {
  if (!confirmarConSegundoClic(btn)) return;
  btn.disabled = true;
  const d = await api(`/api/admin/preguntas/${id}`, { metodo: "DELETE" });
  if (d.ok) return cargarDatos();
  btn.disabled = false;
  if (sesionAdmin) alert(`❌ No se pudo eliminar: ${d.error}`);
}

async function eliminarRespuesta(id, btn) {
  if (!confirmarConSegundoClic(btn)) return;
  btn.disabled = true;
  const d = await api(`/api/admin/respuestas/${id}`, { metodo: "DELETE" });
  if (d.ok) return cargarDatos();
  btn.disabled = false;
  if (sesionAdmin) alert(`❌ No se pudo eliminar: ${d.error}`);
}

// ===== UTILIDADES =====

/** Todo texto que viene de la base pasa por acá antes de ir al HTML. */
function escapeHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(texto ?? "").replace(/[&<>"']/g, (c) => mapa[c]);
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
