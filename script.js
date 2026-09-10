/* ============================================================================
   COTIZADOR DE ABERTURAS — Lógica de la landing
   ----------------------------------------------------------------------------
   Todo lo que vas a necesitar tocar día a día está en los BLOQUES 1, 2 y 3.
   De ahí para abajo es el motor que arma la página; no hace falta modificarlo.

   IMPORTANTE — CÓMO FUNCIONA LA DESCARGA:
   El link del .zip NO está en esta página ni en este archivo. El interesado
   carga sus datos, se los mandamos a un script de Google (BLOQUE 3), y ese
   script le envía el link por mail. Si el mail que puso es falso, no le llega
   nada: esa es la única verificación real posible en un sitio estático.
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

  // Mensajes que aparecen ya escritos cuando el visitante abre WhatsApp o el mail
  msgLicencia: "Hola! Descargué el Cotizador de Aberturas y quiero pedir la licencia de prueba de 7 días.",
  msgGeneral:  "Hola! Tengo una consulta sobre el Cotizador de Aberturas.",
  asuntoMail:  "Consultas y Sugerencias — Cotizador de Aberturas"
};


/* ============================================================================
   BLOQUE 2 · VERSIONES DEL PROGRAMA   ★ EDITAR ACÁ PARA PUBLICAR UNA VERSIÓN ★
   ----------------------------------------------------------------------------
   OJO: acá NO va ningún link de descarga. El link vive solamente dentro del
   script de Google (ver apps-script/Codigo.gs), para que nadie pueda sacarlo
   mirando el código de la página y saltearse el formulario.

   CÓMO PUBLICAR UNA VERSIÓN NUEVA:
     1. Subí el .zip a MediaFire y copiá el link para compartir.
     2. Pegá ese link en el objeto LINKS del script de Google.
     3. Copiá un bloque { ... } de acá abajo, pegalo ARRIBA DE TODO,
        y poné destacada: true en el nuevo (sacáselo al anterior).

   CAMPOS:
     version    Número de versión. Tiene que coincidir EXACTO con la clave
                usada en el objeto LINKS del script de Google.   Ej: "3.1.0"
     fecha      Fecha de publicación, formato AAAA-MM-DD.
     estado     "estable" o "beta" (cambia el color de la etiqueta).
     tamano     Texto libre con el peso del archivo.
     destacada  true en UNA sola versión: es la del botón grande.
     notas      Lista de novedades (las que quieras).
   ========================================================================== */
const VERSIONES = [

  {
    version:   "3.0.0",
    fecha:     "2026-08-29",
    estado:    "estable",
    tamano:    "31,5 MB",
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
    fecha:     "2026-08-13",
    estado:    "estable",
    tamano:    "21,3 MB",
    destacada: false,
    notas: [
      "Dos modos de costeo del aluminio: por kilo y por barra",
      "Mejoras en el motor de despiece"
    ]
  },

  {
    version:   "2.1.0",
    fecha:     "2026-08-10",
    estado:    "estable",
    tamano:    "20,8 MB",
    destacada: false,
    notas: [
      "Importación de precios desde Excel",
      "Correcciones de formato de unidades"
    ]
  }

];


/* ============================================================================
   BLOQUE 3 · A DÓNDE SE MANDAN LOS DATOS DEL FORMULARIO   ★ EDITAR ACÁ ★
   ----------------------------------------------------------------------------
   Pegá acá la URL que te da Google al publicar el script como aplicación web
   (termina en /exec). El paso a paso está en README.md, punto 3.

   Mientras esté vacío, el formulario valida los datos igual, pero en vez de
   mandar el mail le ofrece al visitante pedirte el link por WhatsApp.
   ========================================================================== */
const ENDPOINT = "";


/* ============================================================================
   BLOQUE 4 · MOTOR (de acá para abajo no hace falta tocar nada)
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


/* --- 4.1 Contacto: completa todos los enlaces de la página ---------------- */
function aplicarContacto() {
  // Tarjetas y links de WhatsApp (consulta general)
  $$("[data-wa-contacto]").forEach((el) => { el.href = linkWhatsApp(CONTACTO.msgGeneral); });

  // Botones "Pedir mi licencia de prueba"
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


/* --- 4.2 Descargas: versión destacada + historial -------------------------- */

/** Devuelve la versión marcada como destacada; si no hay ninguna, la primera. */
function versionDestacada() {
  return VERSIONES.find((v) => v.destacada) || VERSIONES[0];
}

/**
 * Devuelve el link de MediaFire para una versión.
 * El link real está en apps-script/Codigo.gs, pero mientras ENDPOINT esté vacío,
 * devolvemos un link placeholder. En producción, el script de Google lo maneja.
 */
function linkMediaFire(version) {
  return "https://www.mediafire.com/file/f3ubap9yqrviuti/CotizadorAberturas_v3.3.0.zip/file";
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
      <div class="dl__buttons">
        <button class="btn btn--primary btn--lg" type="button" data-abrir-modal data-version="${esc(v.version)}">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
          </svg>
          Pedir descarga
        </button>
        <a class="btn btn--secondary btn--lg" href="${esc(linkMediaFire(v.version))}" target="_blank" rel="noopener noreferrer">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
          </svg>
          Descargar directo
        </a>
      </div>
      <small>Gratis · sin registro</small>
    </div>
  `;
}

/** Dibuja la lista con todas las versiones */
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
        <button class="version-item__link" type="button" data-abrir-modal data-version="${esc(v.version)}">
          Descargar ↓
        </button>
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


/* --- 4.3 Validación de los datos del formulario ---------------------------- */

/* Dominios de correo descartable: son los que usa quien no quiere dejar
   un mail real. Si aparece alguno nuevo, agregalo a esta lista. */
const MAILS_DESCARTABLES = [
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com",
  "temp-mail.org", "maildrop.cc", "fakeinbox.com", "throwawaymail.com"
];

/** Nombre y apellido: dos palabras, sin números */
function validarNombre(valor) {
  const v = valor.trim().replace(/\s+/g, " ");
  if (v.length < 5)             return "Escribí tu nombre y apellido.";
  if (!v.includes(" "))         return "Falta el apellido.";
  if (/\d/.test(v))             return "El nombre no lleva números.";
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ' .-]+$/.test(v)) return "Usá sólo letras.";
  return "";
}

/** Localidad: algo escribible, sin ser un solo carácter */
function validarLocalidad(valor) {
  const v = valor.trim();
  if (v.length < 3)  return "Decinos de qué localidad sos.";
  if (/^\d+$/.test(v)) return "Escribí el nombre de la localidad, no un número.";
  return "";
}

/**
 * Email: verificamos el formato y descartamos los correos temporales.
 * Que exista de verdad se comprueba solo: si es falso, el link nunca le llega.
 */
function validarEmail(valor) {
  const v = valor.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return "Ese correo no parece válido.";
  const dominio = v.split("@")[1];
  if (MAILS_DESCARTABLES.includes(dominio)) {
    return "Necesitamos un correo real: ahí te llega el link de descarga.";
  }
  return "";
}

/**
 * WhatsApp argentino. Devuelve { error, numero } con el número normalizado
 * en formato internacional (549 + 10 dígitos), listo para wa.me.
 */
function validarWhatsApp(valor) {
  let d = String(valor).replace(/\D/g, "");     // sólo dígitos

  if (d.startsWith("54")) d = d.slice(2);       // saca el país
  if (d.startsWith("9"))  d = d.slice(1);       // saca el 9 de celular
  if (d.startsWith("0"))  d = d.slice(1);       // saca el 0 de larga distancia

  // Saca el 15 cuando viene pegado después de la característica
  if (d.length === 11 && d.slice(2, 4) === "15") d = d.slice(0, 2) + d.slice(4);
  if (d.length === 12 && d.slice(3, 5) === "15") d = d.slice(0, 3) + d.slice(5);
  if (d.length === 13 && d.slice(4, 6) === "15") d = d.slice(0, 4) + d.slice(6);

  if (d.length < 10)  return { error: "Faltan dígitos: va con característica, sin 0 y sin 15." };
  if (d.length > 10)  return { error: "Sobran dígitos: va con característica, sin 0 y sin 15." };
  if (/^(\d)\1+$/.test(d)) return { error: "Ese número no parece real." };

  return { error: "", numero: "549" + d };
}


/* --- 4.4 Modal de descarga ------------------------------------------------- */

const modal = {
  raiz:      null,
  form:      null,
  ultimoFoco: null,
  version:   ""
};

/** Muestra uno de los tres pasos: "form", "ok" o "error" */
function mostrarPaso(nombre) {
  $$("[data-paso]", modal.raiz).forEach((p) => { p.hidden = p.dataset.paso !== nombre; });
}

/** Abre el modal pidiendo una versión concreta */
function abrirModal(version) {
  if (!modal.raiz) return;

  modal.version = version || versionDestacada().version;
  modal.ultimoFoco = document.activeElement;

  // Deja escrito de qué versión se trata
  $$("[data-version-pedida]").forEach((el) => { el.textContent = "versión " + modal.version; });

  mostrarPaso("form");
  modal.raiz.hidden = false;
  document.body.style.overflow = "hidden";      // bloquea el scroll del fondo

  const primero = $("#f_nombre");
  if (primero) setTimeout(() => primero.focus(), 60);
}

/** Cierra el modal y devuelve el foco al botón que lo abrió */
function cerrarModal() {
  if (!modal.raiz || modal.raiz.hidden) return;
  modal.raiz.hidden = true;
  document.body.style.overflow = "";
  if (modal.ultimoFoco && modal.ultimoFoco.focus) modal.ultimoFoco.focus();
}

/** Pinta (o borra) el mensaje de error de un campo */
function marcarError(campo, mensaje) {
  const input = $("#f_" + campo);
  const aviso = $('[data-error-de="' + campo + '"]');
  if (!input || !aviso) return;

  aviso.textContent = mensaje;
  aviso.classList.toggle("visible", Boolean(mensaje));
  input.classList.toggle("es-invalido", Boolean(mensaje));
  input.setAttribute("aria-invalid", mensaje ? "true" : "false");
}

/** Lee el formulario, valida todo y devuelve los datos o null */
function leerFormulario() {
  const datos = {
    nombre:    $("#f_nombre").value.trim().replace(/\s+/g, " "),
    localidad: $("#f_localidad").value.trim(),
    email:     $("#f_email").value.trim().toLowerCase(),
    whatsapp:  $("#f_whatsapp").value.trim()
  };

  const errores = {
    nombre:    validarNombre(datos.nombre),
    localidad: validarLocalidad(datos.localidad),
    email:     validarEmail(datos.email)
  };

  const wa = validarWhatsApp(datos.whatsapp);
  errores.whatsapp = wa.error;

  Object.keys(errores).forEach((campo) => marcarError(campo, errores[campo]));

  // Enfoca el primer campo con problema
  const primerError = Object.keys(errores).find((c) => errores[c]);
  if (primerError) {
    const input = $("#f_" + primerError);
    if (input) input.focus();
    return null;
  }

  datos.whatsapp = wa.numero;                   // normalizado: 549...
  datos.version  = modal.version;
  return datos;
}

/** Arma el mensaje de WhatsApp de respaldo, con los datos ya cargados */
function prepararWhatsAppRespaldo(datos) {
  const texto =
    "Hola! Quiero descargar el Cotizador de Aberturas (versión " + (datos ? datos.version : modal.version) + ").\n" +
    (datos
      ? "Nombre: " + datos.nombre + "\nLocalidad: " + datos.localidad + "\nMail: " + datos.email
      : "");

  $$("[data-wa-descarga]").forEach((el) => { el.href = linkWhatsApp(texto); });
}

/** Envía los datos al script de Google */
async function enviarDatos(datos) {
  // El Content-Type de texto plano evita el preflight de CORS, que Apps Script no responde
  const respuesta = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(datos)
  });

  if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);

  const resultado = await respuesta.json();
  if (!resultado || resultado.ok !== true) throw new Error(resultado && resultado.error || "Respuesta inesperada");
  return resultado;
}

function activarModal() {
  modal.raiz = $("#modalDescarga");
  modal.form = $("#formDescarga");
  if (!modal.raiz || !modal.form) return;

  // Abrir: cualquier botón con data-abrir-modal (incluidos los que se dibujan después)
  document.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-abrir-modal]");
    if (!boton) return;
    e.preventDefault();
    abrirModal(boton.dataset.version);
  });

  // Cerrar: la X, el fondo oscuro y los botones "Cerrar"
  modal.raiz.addEventListener("click", (e) => {
    if (e.target.closest("[data-cerrar-modal]")) cerrarModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal(); });

  // Botón "Reintentar" del paso de error
  $$("[data-reintentar]", modal.raiz).forEach((b) => b.addEventListener("click", () => mostrarPaso("form")));

  // Limpia el error de un campo apenas el visitante lo corrige
  ["nombre", "localidad", "email", "whatsapp"].forEach((campo) => {
    const input = $("#f_" + campo);
    if (input) input.addEventListener("input", () => marcarError(campo, ""));
  });

  // Envío
  modal.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Trampa anti-robots: si el campo invisible viene lleno, es un bot
    const trampa = $("#f_web");
    if (trampa && trampa.value) return;

    const datos = leerFormulario();
    if (!datos) return;

    prepararWhatsAppRespaldo(datos);

    // Todavía no configuraste el script de Google: se ofrece el respaldo
    if (!ENDPOINT) {
      console.warn("ENDPOINT vacío: configurá la URL del script de Google en el BLOQUE 3 de script.js");
      mostrarPaso("error");
      return;
    }

    const boton = $("#btnEnviarDescarga");
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Enviando…";

    try {
      await enviarDatos(datos);
      $$("[data-mail-enviado]").forEach((el) => { el.textContent = datos.email; });
      mostrarPaso("ok");
      modal.form.reset();
    } catch (error) {
      console.error("No se pudo enviar el formulario:", error);
      mostrarPaso("error");
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  });
}


/* --- 4.5 Selector de tema (Blanco / Silver) -------------------------------
   Son los mismos dos temas del programa. El tema se guarda en el navegador de
   cada visitante, así lo encuentra igual la próxima vez que entre.
   El tema inicial se aplica en el <head> de index.html para que no parpadee.
   ------------------------------------------------------------------------- */
const TEMAS = ["blanco", "silver"];

function aplicarTema(tema) {
  if (TEMAS.indexOf(tema) === -1) tema = "blanco";

  document.documentElement.setAttribute("data-tema", tema);

  // Marca cuál de los dos botones está activo
  $$("[data-tema-btn]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.temaBtn === tema));
  });

  // El color de la barra del navegador en celular acompaña al tema
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "silver" ? "#2B2D42" : "#FFFFFF");

  try { localStorage.setItem("tema", tema); } catch (e) { /* modo incógnito: no pasa nada */ }
}

function activarSelectorTema() {
  let guardado = "blanco";
  try { guardado = localStorage.getItem("tema") || "blanco"; } catch (e) { /* ignorar */ }

  aplicarTema(guardado);

  $$("[data-tema-btn]").forEach((boton) => {
    boton.addEventListener("click", () => aplicarTema(boton.dataset.temaBtn));
  });
}


/* --- 4.6 Navegación en celular -------------------------------------------- */
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


/* --- 4.7 Sombra del encabezado al hacer scroll ---------------------------- */
function activarHeaderScroll() {
  const header = $("#header");
  if (!header) return;

  const actualizar = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  actualizar();
  window.addEventListener("scroll", actualizar, { passive: true });
}


/* --- 4.8 Año del pie ------------------------------------------------------ */
function pintarAnio() {
  $$("[data-anio]").forEach((el) => { el.textContent = new Date().getFullYear(); });
}


/* --- Arranque ------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  aplicarContacto();
  pintarBadgeVersion();
  pintarDestacada();
  pintarHistorial();
  activarModal();
  prepararWhatsAppRespaldo(null);   // por si el visitante llega al paso de error sin datos
  activarSelectorTema();
  activarMenuMovil();
  activarHeaderScroll();
  pintarAnio();
});
