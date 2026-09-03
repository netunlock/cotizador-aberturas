/**
 * ============================================================================
 * COTIZADOR DE ABERTURAS — Receptor del formulario de descarga
 * ----------------------------------------------------------------------------
 * Qué hace, en orden:
 *   1. Recibe los datos que manda la landing (nombre, localidad, mail, WhatsApp).
 *   2. Los valida de nuevo acá (nunca hay que confiar en lo que llega del navegador).
 *   3. Los guarda como una fila en la planilla.
 *   4. Le manda al interesado un mail con el link de descarga.
 *   5. Te manda a vos un aviso con los datos, para que puedas contactarlo.
 *
 * El link de descarga vive SOLAMENTE en este archivo (objeto LINKS, más abajo).
 * Nunca viaja a la página web, así que nadie puede sacarlo mirando el código
 * del sitio y saltearse el formulario.
 *
 * INSTALACIÓN: ver README.md de la landing, punto 3.
 * ============================================================================
 */


/* ============================================================================
   CONFIGURACIÓN   ★ ESTO ES LO ÚNICO QUE TENÉS QUE EDITAR ★
   ========================================================================== */

/**
 * ID de cada archivo en tu Google Drive.
 *
 * Para sacar el ID: abrí el .zip en Drive → "Compartir" → "Copiar vínculo".
 * Te da algo así:
 *     https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I/view?usp=sharing
 *                                     └────── esto es el ID ──────┘
 *
 * La clave (a la izquierda) tiene que coincidir EXACTO con el campo "version"
 * del array VERSIONES de script.js.
 *
 * IMPORTANTE: en Drive, cada archivo tiene que estar compartido como
 * "Cualquier persona con el enlace · Lector". Si no, el interesado recibe el
 * mail pero no puede abrirlo.
 */
var LINKS = {
  "3.0.0": "PEGAR_ACA_EL_ID_DEL_ZIP_3_0_0",
  "2.2.0": "PEGAR_ACA_EL_ID_DEL_ZIP_2_2_0",
  "2.1.0": "PEGAR_ACA_EL_ID_DEL_ZIP_2_1_0"
};

/** Tu mail: acá te llega el aviso cada vez que alguien pide la descarga. */
var MI_MAIL = "cotizadoraberturas@gmail.com";

/** Tu WhatsApp en formato internacional, para incluirlo en el mail. */
var MI_WHATSAPP = "5492215929482";

/** Nombre que aparece como remitente del mail. */
var REMITENTE = "Cotizador de Aberturas";

/** Nombre de la hoja donde se guardan los pedidos (se crea sola). */
var HOJA = "Descargas";


/* ============================================================================
   PUNTO DE ENTRADA
   ========================================================================== */

/**
 * Recibe el POST que manda el formulario de la landing.
 * Devuelve siempre JSON: { ok: true } o { ok: false, error: "..." }.
 */
function doPost(e) {
  try {
    var datos = JSON.parse(e.postData.contents);

    // --- Validación del lado del servidor -----------------------------------
    var error = validar(datos);
    if (error) return json({ ok: false, error: error });

    // --- Guardar en la planilla ---------------------------------------------
    guardarFila(datos);

    // --- Mail al interesado con el link -------------------------------------
    enviarMailDescarga(datos);

    // --- Aviso para vos ------------------------------------------------------
    avisarme(datos);

    return json({ ok: true });

  } catch (err) {
    // Queda registrado en Apps Script → Ejecuciones, por si hay que revisarlo
    console.error("Error en doPost: " + err);
    return json({ ok: false, error: "No pudimos procesar el pedido." });
  }
}

/**
 * Sirve para probar que el script está publicado: si abrís la URL /exec en el
 * navegador y ves {"ok":true,...}, la instalación quedó bien.
 */
function doGet() {
  return json({ ok: true, mensaje: "Receptor de descargas activo." });
}


/* ============================================================================
   VALIDACIÓN
   ========================================================================== */

/** Devuelve un texto con el problema, o "" si los datos están bien. */
function validar(d) {
  if (!d) return "No llegaron datos.";

  var nombre    = String(d.nombre    || "").trim();
  var localidad = String(d.localidad || "").trim();
  var email     = String(d.email     || "").trim().toLowerCase();
  var whatsapp  = String(d.whatsapp  || "").replace(/\D/g, "");
  var version   = String(d.version   || "").trim();

  if (nombre.length < 5 || nombre.indexOf(" ") === -1) return "Falta el nombre y apellido.";
  if (/\d/.test(nombre))                               return "El nombre no lleva números.";
  if (localidad.length < 3)                            return "Falta la localidad.";
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))    return "El correo no es válido.";
  if (whatsapp.length < 12 || whatsapp.length > 13)    return "El WhatsApp no es válido.";
  if (!LINKS[version])                                 return "Esa versión no está disponible.";
  if (String(LINKS[version]).indexOf("PEGAR_ACA") === 0) return "La descarga todavía no está configurada.";

  return "";
}


/* ============================================================================
   PLANILLA
   ========================================================================== */

/** Agrega una fila con el pedido. Crea la hoja y los encabezados si no existen. */
function guardarFila(d) {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja  = libro.getSheetByName(HOJA);

  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
    hoja.appendRow(["Fecha", "Nombre", "Localidad", "Email", "WhatsApp", "Versión", "Contactado"]);
    hoja.getRange("A1:G1").setFontWeight("bold");
    hoja.setFrozenRows(1);
  }

  hoja.appendRow([
    new Date(),
    d.nombre,
    d.localidad,
    d.email,
    "+" + d.whatsapp,             // el + evita que la planilla lo trate como número
    d.version,
    ""                            // columna para que vos marques a quién ya contactaste
  ]);
}


/* ============================================================================
   MAILS
   ========================================================================== */

/** Arma el link de descarga a partir del ID de Drive. */
function linkDeDescarga(version) {
  // La pantalla de Drive con el botón "Descargar". Es la más prolija para
  // archivos grandes: la descarga directa (uc?export=download) muestra un
  // aviso de "no se pudo analizar en busca de virus" arriba de los 25 MB.
  return "https://drive.google.com/file/d/" + LINKS[version] + "/view";
}

/** Mail que recibe el interesado, con el link. */
function enviarMailDescarga(d) {
  var link = linkDeDescarga(d.version);
  var wa   = "https://wa.me/" + MI_WHATSAPP;

  var asunto = "Tu descarga del Cotizador de Aberturas v" + d.version;

  var cuerpo =
    "Hola " + primerNombre(d.nombre) + ",\n\n" +
    "Acá tenés el link para descargar el Cotizador de Aberturas v" + d.version + ":\n\n" +
    link + "\n\n" +
    "CÓMO EMPEZAR\n" +
    "1. Descargá el archivo y descomprimí la carpeta.\n" +
    "2. Hacé doble clic en el ejecutable (no necesita instalación).\n" +
    "3. Al abrirlo vas a ver un código de 16 caracteres en la pantalla de activación.\n" +
    "4. Mandanos ese código y te generamos la LICENCIA DE PRUEBA GRATUITA DE 7 DÍAS.\n\n" +
    "Escribinos por WhatsApp: " + wa + "\n" +
    "O respondé este mismo mail.\n\n" +
    "Cualquier duda estamos.\n" +
    REMITENTE;

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#334155;line-height:1.6;max-width:560px">' +
      '<p>Hola <strong>' + escapar(primerNombre(d.nombre)) + '</strong>,</p>' +
      '<p>Acá tenés tu descarga del <strong>Cotizador de Aberturas v' + escapar(d.version) + '</strong>:</p>' +
      '<p style="margin:26px 0">' +
        '<a href="' + link + '" style="background:#2563eb;color:#fff;text-decoration:none;' +
        'padding:14px 28px;border-radius:999px;font-weight:bold;display:inline-block">' +
        'Descargar el programa</a>' +
      '</p>' +
      '<p style="background:#fffbeb;border-left:4px solid #d97706;padding:14px 18px;border-radius:6px">' +
        '<strong>Importante:</strong> una vez descargado el programa, comunicate con nosotros ' +
        'para generarte tu <strong>licencia de prueba gratuita de 7 días</strong>. ' +
        'Al abrirlo vas a ver un código de 16 caracteres: mandanoslo y te devolvemos la clave.' +
      '</p>' +
      '<h3 style="color:#0f172a;margin-top:26px">Cómo empezar</h3>' +
      '<ol style="padding-left:20px">' +
        '<li>Descargá el archivo y descomprimí la carpeta.</li>' +
        '<li>Doble clic en el ejecutable: no necesita instalación.</li>' +
        '<li>Copiá el código de activación que aparece en pantalla.</li>' +
        '<li>Mandánoslo y te habilitamos los 7 días de prueba.</li>' +
      '</ol>' +
      '<p style="margin-top:26px">' +
        '<a href="' + wa + '" style="color:#16a34a;font-weight:bold;text-decoration:none">' +
        'Escribinos por WhatsApp</a> o respondé este mismo mail.' +
      '</p>' +
      '<p style="color:#64748b;font-size:13px;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:14px">' +
        REMITENTE + ' · Software de cotización y despiece para carpinterías de aluminio.' +
      '</p>' +
    '</div>';

  MailApp.sendEmail({
    to: d.email,
    subject: asunto,
    body: cuerpo,          // versión de texto plano, por si el cliente no muestra HTML
    htmlBody: html,
    name: REMITENTE,
    replyTo: MI_MAIL
  });
}

/** Aviso para vos, con los datos del interesado listos para contactarlo. */
function avisarme(d) {
  var cuerpo =
    "Nuevo pedido de descarga (v" + d.version + ")\n\n" +
    "Nombre:    " + d.nombre + "\n" +
    "Localidad: " + d.localidad + "\n" +
    "Email:     " + d.email + "\n" +
    "WhatsApp:  +" + d.whatsapp + "\n\n" +
    "Escribirle por WhatsApp: https://wa.me/" + d.whatsapp + "\n";

  MailApp.sendEmail({
    to: MI_MAIL,
    subject: "Descarga pedida por " + d.nombre + " (" + d.localidad + ")",
    body: cuerpo,
    name: REMITENTE
  });
}


/* ============================================================================
   AUXILIARES
   ========================================================================== */

/** Devuelve la respuesta como JSON. */
function json(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/** "Juan Carlos Pérez" -> "Juan" */
function primerNombre(nombre) {
  return String(nombre).trim().split(" ")[0];
}

/** Evita que un dato con < o > rompa el HTML del mail. */
function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


/* ============================================================================
   PRUEBA MANUAL
   ----------------------------------------------------------------------------
   Ejecutá esta función desde el editor (botón ▶ con "probar" seleccionado)
   para verificar que se guarda la fila y que llegan los dos mails, sin tener
   que pasar por la página web.
   ========================================================================== */
function probar() {
  var falso = {
    nombre:    "Juan Pérez",
    localidad: "La Plata",
    email:     MI_MAIL,          // se lo manda a vos mismo
    whatsapp:  "5492215929482",
    version:   "3.0.0"
  };

  var error = validar(falso);
  if (error) {
    console.log("La validación falló: " + error);
    return;
  }

  guardarFila(falso);
  enviarMailDescarga(falso);
  avisarme(falso);
  console.log("Listo: revisá la planilla y tu casilla.");
}
