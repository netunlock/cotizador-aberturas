/**
 * imagenes.js — Imágenes adjuntas a preguntas y respuestas.
 *
 * Recorrido de una imagen:
 *  1. foro.js la achica y la recomprime en el navegador (máx. 1600 px).
 *  2. La manda junto con la pregunta o la respuesta, en un multipart/form-data.
 *  3. Acá se revisa que sea DE VERDAD un JPEG, PNG o WebP mirando sus primeros
 *     bytes. No se confía en el nombre ni en el tipo que declara el navegador:
 *     así nadie puede colar, por ejemplo, un SVG o un HTML con JavaScript.
 *  4. Se guarda en la tabla "imagenes" con un id aleatorio (UUID), y en la
 *     pregunta o respuesta queda un JSON con esos id.
 *  5. Se muestra con <img src=".../api/imagenes/<id>">.
 *
 * ¿Por qué en D1 y no en R2, el almacenamiento de archivos de Cloudflare?
 * Porque no suma otro servicio para activar y configurar, y el foro es chico:
 * en el plan gratuito una base D1 llega a 500 MB, unas 1.500 fotos de 300 KB.
 * Si algún día queda corto, se pasa a R2 cambiando sólo este archivo.
 */

import { ErrorHttp, CORS } from "./util.js";

export const MAX_IMAGENES = 3;
export const MAX_BYTES_IMAGEN = 1024 * 1024; // 1 MB por imagen, ya comprimida (D1 acepta filas de hasta 2 MB)

// Formato de los id: un UUID como "3f2a9c1e-7b4d-4e8a-9c1f-2b3d4e5f6a7b".
const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Los mensajes cargados ANTES de esta versión (por ejemplo las respuestas del
// 14/09/2026) guardaban la URL de una imagen del propio sitio, como las de
// img/foro/. Se siguen mostrando, pero sólo si apuntan exactamente a una imagen
// dentro de netunlock.github.io/cotizador-aberturas/img/. El patrón no admite
// puntos en la ruta (así no hay "../") ni comillas. Mensajes nuevos con URLs ya
// no se pueden crear: las imágenes nuevas sólo entran como archivos.
const URL_IMAGEN_DEL_SITIO =
  /^https:\/\/netunlock\.github\.io\/cotizador-aberturas\/img\/[A-Za-z0-9_\-/]+\.(?:jpe?g|png|webp)$/;

/** Mira los primeros bytes (los "números mágicos") para saber el formato real. */
function formatoReal(bytes) {
  const empiezaCon = (firma, desde = 0) => firma.every((b, i) => bytes[desde + i] === b);
  if (empiezaCon([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empiezaCon([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP: "RIFF" + 4 bytes de tamaño + "WEBP"
  if (empiezaCon([0x52, 0x49, 0x46, 0x46]) && empiezaCon([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/**
 * Valida las imágenes recibidas y prepara sus INSERT, pero NO escribe nada.
 * Devuelve { ids, sentencias }: la ruta mete esas sentencias en el mismo
 * batch que la pregunta o respuesta, así si algo falla no queda nada a medias.
 */
export async function prepararImagenes(env, archivos, usuarioId) {
  const reales = archivos.filter((archivo) => archivo.size > 0);
  if (reales.length > MAX_IMAGENES) {
    throw new ErrorHttp(400, `Podés adjuntar hasta ${MAX_IMAGENES} imágenes por mensaje`);
  }
  const ids = [];
  const sentencias = [];
  for (const archivo of reales) {
    if (archivo.size > MAX_BYTES_IMAGEN) {
      throw new ErrorHttp(413, "Cada imagen puede pesar hasta 1 MB");
    }
    const datos = await archivo.arrayBuffer();
    const mime = formatoReal(new Uint8Array(datos));
    if (!mime) {
      throw new ErrorHttp(400, "Sólo se aceptan imágenes JPG, PNG o WebP");
    }
    const id = crypto.randomUUID();
    ids.push(id);
    sentencias.push(
      env.DB.prepare("INSERT INTO imagenes (id, usuario_id, mime, bytes, datos) VALUES (?, ?, ?, ?, ?)").bind(
        id,
        usuarioId,
        mime,
        datos.byteLength,
        datos
      )
    );
  }
  return { ids, sentencias };
}

/** GET /api/imagenes/:id */
export async function servirImagen(env, id) {
  const fila = FORMATO_ID.test(id)
    ? await env.DB.prepare("SELECT mime, datos FROM imagenes WHERE id = ?").bind(id).first()
    : null;
  if (!fila) {
    return new Response("Imagen no encontrada", { status: 404, headers: CORS });
  }
  return new Response(new Uint8Array(fila.datos), {
    headers: {
      ...CORS,
      "Content-Type": fila.mime,
      // Una imagen nunca cambia (un id = un archivo): el navegador la guarda un año.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Que el navegador no "adivine" otro tipo de archivo, y que si alguien
      // abre la URL directo no se pueda ejecutar nada.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/**
 * Lee la columna "imagenes" (texto JSON) y devuelve sólo lo que es seguro mostrar:
 * id de la tabla imagenes o, en mensajes viejos, URLs de imágenes del propio sitio.
 * Cualquier otra cosa se descarta en silencio.
 */
export function imagenesDeFila(valor) {
  if (!valor) return [];
  try {
    const lista = JSON.parse(valor);
    if (!Array.isArray(lista)) return [];
    return lista.filter((x) => typeof x === "string" && (FORMATO_ID.test(x) || URL_IMAGEN_DEL_SITIO.test(x)));
  } catch {
    return [];
  }
}

/**
 * Sentencias para borrar de la tabla las imágenes subidas (se usan al borrar
 * preguntas o respuestas). Las URLs viejas del sitio no están en la tabla: se ignoran.
 */
export function sentenciasParaBorrar(env, imagenes) {
  return imagenes
    .filter((x) => FORMATO_ID.test(x))
    .map((id) => env.DB.prepare("DELETE FROM imagenes WHERE id = ?").bind(id));
}
