/* ============================================================================
   COTIZADOR DE ABERTURAS — Lógica de la landing
   ----------------------------------------------------------------------------
   Todo lo que vas a necesitar tocar día a día está en los BLOQUES 1 y 2.
   De ahí para abajo es el motor que arma la página; no hace falta modificarlo.
   ========================================================================== */

"use strict";


/* ============================================================================
   BLOQUE 1 · DATOS DE CONTACTO   ★ EDITAR ACÁ ★
   ----------------------------------------------------------------------------
   El número de WhatsApp va en formato internacional, sin +, sin 0 y sin 15:
       54  = Argentina
       9   = celular
       221 = La Plata
       5929482 = número
   ========================================================================== */
const CONTACTO = {
  whatsapp:        "5492215929482",
  whatsappVisible: "221 592-9482",
  email:           "cotizadoraberturas@gmail.com",
  responsable:     "Federico",

  // Mensajes que aparecen ya escritos cuando el usuario abre WhatsApp o el mail
  msgLicencia: "Hola! Descargué el Cotizador de Aberturas y quiero pedir la licencia de prueba de 7 días.",
  msgGeneral:  "Hola! Tengo una consulta sobre el Cotizador de Aberturas.",
  asuntoMail:  "Consultas y Sugerencias — Cotizador de Aberturas"
};


/* ============================================================================
   BLOQUE 2 · VERSIONES DEL PROGRAMA   ★ EDITAR ACÁ PARA PUBLICAR UNA VERSIÓN ★
   ----------------------------------------------------------------------------
   CÓMO AGREGAR UNA VERSIÓN NUEVA:
     1. Copiá uno de los bloques { ... } de abajo.
     2. Pegalo ARRIBA DE TODO de la lista (el primero es el más nuevo).
     3. Cambiá version, fecha, tamano, url y notas.
     4. Poné  destacada: true  en el nuevo y sacáselo al anterior.

   CAMPOS:
     version    Texto del número de versión.                     Ej: "3.1.0"
     fecha      Fecha de publicación en formato AAAA-MM-DD.      Ej: "2026-08-31"
     estado     "estable" o "beta" (cambia el color de la etiqueta).
     tamano     Texto libre con el peso del archivo.             Ej: "68 MB"
     url        Link directo de descarga (ver README, punto "Dónde subir el .zip").
     destacada  true en UNA sola versión: es la del botón grande.
     notas      Lista de novedades (pueden ser 1 o 10, las que quieras).
   ========================================================================== */
const VERSIONES = [

  {
    version:   "3.0.0",
    fecha:     "2026-08-29",
    estado:    "estable",
    tamano:    "68 MB",
    url:       "https://github.com/USUARIO/REPOSITORIO/releases/download/v3.0.0/CotizadorAberturas_v3.0.0.zip",
    destacada: true,
    notas: [
      "Módulo de órdenes de trabajo con despiece congelado",
      "Inventario opcional con libro mayor de movimientos",
      "PDF rediseñado con esquemas vectoriales de cada abertura",
      "Actualizaciones que no tocan la base de datos del cliente"
    ]
  },

  {
    version:   "2.2.0",
    fecha:     "2026-06-15",
    estado:    "estable",
    tamano:    "61 MB",
    url:       "https://github.com/USUARIO/REPOSITORIO/releases/download/v2.2.0/CotizadorAberturas_v2.2.0.zip",
    destacada: false,
    notas: [
      "Dos modos de costeo del aluminio: por kilo y por barra",
      "Mejoras en el motor de despiece"
    ]
  },

  {
    version:   "2.1.0",
    fecha:     "2026-04-02",
    estado:    "estable",
    tamano:    "58 MB",
    url:       "https://github.com/USUARIO/REPOSITORIO/releases/download/v2.1.0/CotizadorAberturas_v2.1.0.zip",
    destacada: false,
    notas: [
      "Importación de precios desde Excel",
      "Correcciones de formato de unidades"
    ]
  }

];


/* ============================================================================
   BLOQUE 3 · MOTOR (de acá para abajo no hace falta tocar nada)
   ========================================================================== */

/* --- Utilidades ---------------------------------------------------------- */

/** Atajo para document.querySelector */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
/** Atajo para querySelectorAll, ya convertido en array */
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Escapa texto antes de insertarlo como HTML (evita romper la página con < > &) */
function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/**
 * Convierte "2026-08-29" en "29 de agosto de 2026".
 * Se parsea a mano (no con new Date(texto)) para que no se corra un día
 * por diferencia de zona horaria.
 */
function fechaLegible(iso) {
  const partes = String(iso).split("-");
  if (partes.length !== 3) return iso;                 // por si viene con otro formato
  const fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  if (isNaN(fecha)) return iso;
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

/** Arma el link de WhatsApp con el mensaje ya escrito */
function linkWhatsApp(mensaje) {
  return "https://wa.me/" + CONTACTO.whatsapp + "?text=" + encodeURIComponent(mensaje);
}

/** Arma el link de mail con asunto y cuerpo ya escritos */
function linkMail(asunto, cuerpo) {
  let url = "mailto:" + CONTACTO.email + "?subject=" + encodeURIComponent(asunto);
  if (cuerpo) url += "&body=" + encodeURIComponent(cuerpo);
  return url;
}


/* --- 3.1 Contacto: completa todos los enlaces de la página ---------------- */
function aplicarContacto() {
  // Tarjetas y links de WhatsApp (consulta general)
  $$("[data-wa-contacto]").forEach((el) => { el.href = linkWhatsApp(CONTACTO.msgGeneral); });

  // Botón "Pedir mi licencia de prueba" (mensaje específico de licencia)
  $$("[data-wa-licencia]").forEach((el) => {
    el.href = linkWhatsApp(CONTACTO.msgLicencia);
    el.target = "_blank";
    el.rel = "noopener";
  });

  // Links de mail
  $$("[data-mail-contacto]").forEach((el) => { el.href = "mailto:" + CONTACTO.email; });

  // Botón "Consultas y Sugerencias"
  $$("[data-consultas]").forEach((el) => { el.href = linkMail(CONTACTO.asuntoMail, ""); });

  // Textos visibles (por si cambiás el número o el mail en el BLOQUE 1)
  $$("[data-wa-visible]").forEach((el)   => { el.textContent = CONTACTO.whatsappVisible; });
  $$("[data-mail-visible]").forEach((el) => { el.textContent = CONTACTO.email; });
}


/* --- 3.2 Descargas: versión destacada + historial -------------------------- */

/** Devuelve la versión marcada como destacada; si no hay ninguna, la primera. */
function versionDestacada() {
  return VERSIONES.find((v) => v.destacada) || VERSIONES[0];
}

/** Dibuja la tarjeta grande de la última versión */
function pintarDestacada() {
  const cont = $("#descargaDestacada");
  const v = versionDestacada();
  if (!cont || !v) return;

  const esBeta = v.estado === "beta";

  cont.innerHTML = `
    <div class="dl__info">
      <div class="dl__top">
        <span class="dl__version">Versión ${esc(v.version)}</span>
        <span class="dl__tag ${esBeta ? "dl__tag--beta" : ""}">
          ${esBeta ? "Beta" : "Última versión"}
        </span>
      </div>

      <div class="dl__meta">
        <span>Publicada el ${esc(fechaLegible(v.fecha))}</span>
        ${v.tamano ? `<span>${esc(v.tamano)}</span>` : ""}
        <span>Windows 10 / 11</span>
      </div>

      ${Array.isArray(v.notas) && v.notas.length
        ? `<ul class="dl__notas">${v.notas.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
        : ""}
    </div>

    <div class="dl__action">
      <a class="btn btn--primary btn--lg" href="${esc(v.url)}" target="_blank" rel="noopener">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
        </svg>
        Descargar ${esc(v.version)}
      </a>
      <small>Archivo .zip · no requiere instalación</small>
    </div>
  `;
}

/** Dibuja la lista con TODAS las versiones (incluida la destacada, para tener el historial completo) */
function pintarHistorial() {
  const lista  = $("#listaVersiones");
  const bloque = $("#bloqueVersiones");
  const boton  = $("#toggleVersiones");
  if (!lista || !bloque) return;

  // Si sólo existe una versión, no tiene sentido mostrar el historial
  if (VERSIONES.length < 2) { bloque.hidden = true; return; }
  bloque.hidden = false;

  lista.innerHTML = VERSIONES.map((v) => {
    const esBeta = v.estado === "beta";
    return `
      <li class="version-item">
        <span class="version-item__num">
          v${esc(v.version)}
          ${esBeta ? '<span class="dl__tag dl__tag--beta">Beta</span>' : ""}
        </span>
        <span class="version-item__info">
          ${esc(fechaLegible(v.fecha))}${v.tamano ? " · " + esc(v.tamano) : ""}
          ${Array.isArray(v.notas) && v.notas.length ? " · " + esc(v.notas[0]) : ""}
        </span>
        <a class="version-item__link" href="${esc(v.url)}" target="_blank" rel="noopener">Descargar ↓</a>
      </li>
    `;
  }).join("");

  // Mostrar / ocultar el historial
  if (boton) {
    boton.addEventListener("click", () => {
      const abierto = boton.getAttribute("aria-expanded") === "true";
      boton.setAttribute("aria-expanded", String(!abierto));
      lista.hidden = abierto;
      boton.textContent = abierto ? "Ver versiones anteriores" : "Ocultar historial";
    });
  }
}

/** Escribe el número de versión en la etiqueta del hero */
function pintarBadgeVersion() {
  const v = versionDestacada();
  if (!v) return;
  $$("[data-version-badge]").forEach((el) => { el.textContent = "Versión " + v.version + " disponible"; });
}


/* --- 3.3 Navegación en celular ------------------------------------------- */
function activarMenuMovil() {
  const boton = $("#navToggle");
  const menu  = $("#navMenu");
  if (!boton || !menu) return;

  const cerrar = () => {
    menu.classList.remove("is-open");
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-label", "Abrir menú");
  };

  boton.addEventListener("click", () => {
    const abierto = menu.classList.toggle("is-open");
    boton.setAttribute("aria-expanded", String(abierto));
    boton.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
  });

  // Al tocar cualquier link del menú, se cierra
  $$("a", menu).forEach((a) => a.addEventListener("click", cerrar));

  // También se cierra con la tecla Escape
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
}


/* --- 3.4 Sombra del encabezado al hacer scroll ---------------------------- */
function activarHeaderScroll() {
  const header = $("#header");
  if (!header) return;

  const actualizar = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  actualizar();
  window.addEventListener("scroll", actualizar, { passive: true });
}


/* --- 3.5 Año del pie ------------------------------------------------------ */
function pintarAnio() {
  $$("[data-anio]").forEach((el) => { el.textContent = new Date().getFullYear(); });
}


/* --- Arranque ------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  aplicarContacto();
  pintarBadgeVersion();
  pintarDestacada();
  pintarHistorial();
  activarMenuMovil();
  activarHeaderScroll();
  pintarAnio();
});
