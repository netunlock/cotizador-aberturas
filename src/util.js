/**
 * util.js — Ayudas HTTP que usan todas las rutas del worker.
 *
 * Acá no hay lógica del foro: sólo cómo responder JSON, cómo leer el cuerpo
 * de un pedido con límite de tamaño y cómo validar textos que manda el usuario.
 */

// Largos máximos de lo que escribe el usuario. Si cambiás alguno, revisá foro.html.
export const LARGO_MAX = {
  titulo: 200,
  contenido: 10000,
  nombre: 60,
  email: 254,
  password: 200,
  busqueda: 100,
};

// Tamaño máximo de un pedido completo: texto + hasta 3 imágenes ya comprimidas.
export const MAX_BYTES_PEDIDO = 5 * 1024 * 1024;

/**
 * CORS abierto ("*"). En este caso es seguro porque la sesión viaja en el
 * header Authorization y NO en cookies: el navegador nunca lo agrega por su
 * cuenta, así que otra página no puede hacer pedidos "en nombre" de un
 * visitante. Sólo lo agrega el JavaScript de foro.html y admin.html.
 */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * Error con código HTTP. Cualquier función puede hacer
 *     throw new ErrorHttp(401, "Tenés que iniciar sesión")
 * y worker.js lo convierte en una respuesta JSON con ese código.
 * Es la misma idea que `raise HTTPException(...)` en FastAPI.
 */
export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

/** Respuesta JSON con los headers de CORS. */
export function json(datos, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Corta ANTES de leer si el pedido declara ser más grande que el límite. */
function controlarTamanio(request) {
  const largo = Number(request.headers.get("Content-Length") || 0);
  if (largo > MAX_BYTES_PEDIDO) {
    throw new ErrorHttp(413, "El mensaje es demasiado grande");
  }
}

/** Lee un cuerpo JSON que tiene que ser un objeto { ... }. */
export async function leerJson(request) {
  controlarTamanio(request);
  const texto = await request.text();
  if (texto.length > MAX_BYTES_PEDIDO) {
    throw new ErrorHttp(413, "El mensaje es demasiado grande");
  }
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorHttp(400, "JSON inválido");
  }
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    throw new ErrorHttp(400, "JSON inválido");
  }
  return datos;
}

/**
 * Lee un pedido que puede llegar de dos formas:
 *  - multipart/form-data: lo que manda foro.html, con o sin imágenes.
 *  - JSON: sin imágenes (práctico para probar con curl).
 * Devuelve { campos, archivos }: "campos" tiene los textos y "archivos" las
 * imágenes adjuntas en el campo "imagenes".
 */
export async function leerFormulario(request) {
  const tipo = request.headers.get("Content-Type") || "";
  if (!tipo.includes("multipart/form-data")) {
    return { campos: await leerJson(request), archivos: [] };
  }
  controlarTamanio(request);
  let formulario;
  try {
    formulario = await request.formData();
  } catch {
    throw new ErrorHttp(400, "Formulario inválido");
  }
  const campos = {};
  const archivos = [];
  for (const [clave, valor] of formulario.entries()) {
    if (typeof valor === "string") {
      campos[clave] = valor;
    } else if (clave === "imagenes") {
      archivos.push(valor);
    }
  }
  return { campos, archivos };
}

/** Texto obligatorio: sin espacios de más y con largo máximo. */
export function textoObligatorio(valor, campo, largoMax) {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new ErrorHttp(400, `Falta el campo "${campo}"`);
  }
  const limpio = valor.trim();
  if (limpio.length > largoMax) {
    throw new ErrorHttp(400, `"${campo}" no puede superar los ${largoMax} caracteres`);
  }
  return limpio;
}

/** Email normalizado (sin espacios, en minúsculas) con un control básico de formato. */
export function emailValido(valor) {
  const email = textoObligatorio(valor, "email", LARGO_MAX.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new ErrorHttp(400, "El email no es válido");
  }
  return email;
}

/** Id numérico positivo, por ejemplo el de una pregunta. */
export function idValido(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new ErrorHttp(400, `Falta el campo "${campo}"`);
  }
  return numero;
}

// ---------- base64url: base64 apto para headers y URLs ----------
// Igual que base64, pero con "-" y "_" en vez de "+" y "/", y sin "=" al final.

export function aBase64Url(bytes) {
  let binario = "";
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lanza un error si el texto no es base64url válido. */
export function desdeBase64Url(texto) {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((texto.length + 3) % 4);
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
