/**
 * seguridad.js — Sesiones firmadas y contraseñas.
 *
 * ────────────────────────────────────────────────────────────────────
 * CÓMO ES UN TOKEN DE SESIÓN
 * ────────────────────────────────────────────────────────────────────
 * Son dos partes en base64url separadas por un punto:    datos.firma
 *
 *   datos → un JSON, por ejemplo {"aud":"foro","sub":12,"inv":0,"iat":...,"exp":...}
 *             aud = para qué sirve: "foro" o "admin"
 *             sub = id del usuario en la tabla usuarios ("admin" en el panel)
 *             inv = 1 si es un invitado
 *             exp = cuándo vence, en segundos desde 1970
 *   firma → HMAC-SHA256 de "datos" calculado con el secreto SESSION_SECRET
 *
 * Los datos NO están cifrados: cualquiera puede leerlos. Lo que nadie puede
 * hacer es CAMBIARLOS o inventar un token, porque sin SESSION_SECRET no hay
 * forma de calcular una firma que coincida. Es la misma idea que un JWT
 * (HS256), escrita sin librerías para que se entienda cada paso.
 *
 * Si alguna vez se filtra algo, cambiar SESSION_SECRET con
 * `wrangler secret put SESSION_SECRET` invalida TODAS las sesiones abiertas.
 */

import { ErrorHttp, aBase64Url, desdeBase64Url, LARGO_MAX } from "./util.js";

// Cuánto dura cada tipo de sesión, en segundos.
const DURACION = {
  usuario: 30 * 24 * 60 * 60, // 30 días
  invitado: 7 * 24 * 60 * 60, // 7 días
  admin: 8 * 60 * 60, // 8 horas
};

/**
 * Iteraciones de PBKDF2. Cuantas más, más caro le sale a un atacante probar
 * contraseñas si algún día se roba la base, pero también más CPU gasta cada
 * login. Cloudflare no acepta más de 100.000, y el plan gratuito de Workers
 * corta los pedidos que usan más de 10 ms de CPU: 60.000 deja margen.
 * Se puede cambiar sin romper nada: cada hash guarda sus propias iteraciones
 * y las cuentas se actualizan solas en su próximo login.
 */
const ITERACIONES_PBKDF2 = 60000;

const codificador = new TextEncoder();

// ============================ TOKENS ============================

/** Clave HMAC a partir del secreto. Si falta o es corto, falla CERRADO. */
async function claveDeSesion(env) {
  const secreto = env.SESSION_SECRET;
  if (typeof secreto !== "string" || secreto.length < 32) {
    console.error("Falta SESSION_SECRET o tiene menos de 32 caracteres");
    throw new ErrorHttp(503, "El servidor no tiene configuradas las sesiones");
  }
  return crypto.subtle.importKey(
    "raw",
    codificador.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Corta ANTES de tocar la base si faltan los secretos de sesión. Así, por
 * ejemplo, un registro no deja la cuenta creada y encima contesta error.
 */
export async function exigirSesionesConfiguradas(env) {
  await claveDeSesion(env);
}

/** Arma y firma un token. Devuelve { token, vence }. */
async function crearToken(env, datos, duracionSegundos) {
  const ahora = Math.floor(Date.now() / 1000);
  const carga = { ...datos, iat: ahora, exp: ahora + duracionSegundos };
  const cargaB64 = aBase64Url(codificador.encode(JSON.stringify(carga)));
  const firma = await crypto.subtle.sign("HMAC", await claveDeSesion(env), codificador.encode(cargaB64));
  return { token: `${cargaB64}.${aBase64Url(new Uint8Array(firma))}`, vence: carga.exp };
}

/**
 * Lee el header "Authorization: Bearer <token>" y devuelve los datos del
 * token si la firma es válida y no venció. Si algo no cierra, devuelve null.
 */
async function leerToken(request, env) {
  const encabezado = request.headers.get("Authorization") || "";
  if (!encabezado.startsWith("Bearer ")) return null;
  const partes = encabezado.slice(7).trim().split(".");
  if (partes.length !== 2) return null;
  const [cargaB64, firmaB64] = partes;

  let firma;
  try {
    firma = desdeBase64Url(firmaB64);
  } catch {
    return null;
  }
  // verify recalcula la firma con el secreto y compara en tiempo constante.
  const clave = await claveDeSesion(env);
  const firmaValida = await crypto.subtle.verify("HMAC", clave, firma, codificador.encode(cargaB64));
  if (!firmaValida) return null;

  let carga;
  try {
    carga = JSON.parse(new TextDecoder().decode(desdeBase64Url(cargaB64)));
  } catch {
    return null;
  }
  if (!carga || typeof carga.exp !== "number" || carga.exp <= Math.floor(Date.now() / 1000)) {
    return null; // vencido o mal formado
  }
  return carga;
}

/** Lo que devuelven login, registro e invitado: token + datos públicos del usuario. */
export async function sesionDeForo(env, usuario) {
  const esInvitado = Boolean(usuario.es_invitado);
  const { token, vence } = await crearToken(
    env,
    { aud: "foro", sub: usuario.id, inv: esInvitado ? 1 : 0 },
    esInvitado ? DURACION.invitado : DURACION.usuario
  );
  return {
    ok: true,
    token,
    vence,
    usuario: { id: usuario.id, nombre: usuario.nombre, es_invitado: esInvitado },
  };
}

/** Lo que devuelve el login del panel. */
export async function sesionDeAdmin(env) {
  const { token, vence } = await crearToken(env, { aud: "admin", sub: "admin" }, DURACION.admin);
  return { ok: true, token, vence };
}

/**
 * Exige una sesión del foro y devuelve el usuario REAL según la base.
 * Todas las rutas que escriben toman el usuario de acá, nunca del cuerpo.
 */
export async function exigirUsuario(request, env, { permitirInvitado = false } = {}) {
  const sesion = await leerToken(request, env);
  if (!sesion || sesion.aud !== "foro" || !Number.isInteger(sesion.sub)) {
    throw new ErrorHttp(401, "Tenés que iniciar sesión");
  }
  // Se confirma contra la base: si la cuenta ya no existe, la sesión no vale.
  const usuario = await env.DB.prepare("SELECT id, nombre, es_invitado FROM usuarios WHERE id = ?")
    .bind(sesion.sub)
    .first();
  if (!usuario) {
    throw new ErrorHttp(401, "Tu sesión ya no es válida. Volvé a entrar.");
  }
  if (usuario.es_invitado && !permitirInvitado) {
    throw new ErrorHttp(403, "Para esto necesitás una cuenta: como invitado sólo podés responder");
  }
  return usuario;
}

/**
 * Exige una sesión del PANEL. Sólo sirven los tokens que emite
 * /api/admin/login (aud "admin"). Un token del foro no alcanza aunque ese
 * usuario tenga rol 'admin' en la base: ese rol es sólo una insignia visual.
 */
export async function exigirAdmin(request, env) {
  const sesion = await leerToken(request, env);
  if (!sesion || sesion.aud !== "admin") {
    throw new ErrorHttp(401, "No autorizado");
  }
  return sesion;
}

/** Compara la contraseña ingresada contra el secreto ADMIN_PASSWORD. */
export async function esPasswordDeAdmin(env, intento) {
  const real = env.ADMIN_PASSWORD;
  if (typeof real !== "string" || real.length < 12) {
    console.error("Falta ADMIN_PASSWORD o tiene menos de 12 caracteres");
    throw new ErrorHttp(503, "El acceso de administrador no está configurado");
  }
  // En vez de comparar los textos se comparan sus HMAC: quedan del mismo
  // largo y la comparación tarda lo mismo, acierte o no.
  const clave = await claveDeSesion(env);
  const [a, b] = await Promise.all([
    crypto.subtle.sign("HMAC", clave, codificador.encode(intento)),
    crypto.subtle.sign("HMAC", clave, codificador.encode(real)),
  ]);
  return igualesEnTiempoConstante(new Uint8Array(a), new Uint8Array(b));
}

// ========================= CONTRASEÑAS =========================
// Formato que se guarda en usuarios.password_hash:
//     pbkdf2_sha256$<iteraciones>$<sal en base64url>$<hash en base64url>
// Formato viejo (hasta el 14/09/2026): SHA-256 en hexadecimal, sin sal.
// Ese era el problema del hashPassword() anterior: dos personas con la misma
// contraseña tenían el mismo hash, y una GPU prueba miles de millones por segundo.

/** Valida una contraseña nueva. */
export function passwordNueva(valor) {
  if (typeof valor !== "string" || valor.length < 6) {
    throw new ErrorHttp(400, "La contraseña tiene que tener al menos 6 caracteres");
  }
  if (valor.length > LARGO_MAX.password) {
    throw new ErrorHttp(400, "La contraseña es demasiado larga");
  }
  return valor;
}

async function derivar(password, sal, iteraciones) {
  const material = await crypto.subtle.importKey("raw", codificador.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones },
    material,
    256
  );
  return new Uint8Array(bits);
}

/** Genera el hash para guardar. Cada llamada usa una sal aleatoria nueva. */
export async function hashearPassword(password) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(password, sal, ITERACIONES_PBKDF2);
  return `pbkdf2_sha256$${ITERACIONES_PBKDF2}$${aBase64Url(sal)}$${aBase64Url(hash)}`;
}

/**
 * Verifica una contraseña contra lo guardado. Devuelve { ok, actualizar }:
 * actualizar=true significa que el hash está en un formato viejo (o con otras
 * iteraciones) y conviene regenerarlo ahora que tenemos la contraseña correcta.
 */
export async function verificarPassword(password, guardado) {
  if (typeof guardado !== "string" || !guardado) return { ok: false, actualizar: false };
  try {
    if (guardado.startsWith("pbkdf2_sha256$")) {
      const [, textoIteraciones, salB64, hashB64] = guardado.split("$");
      const iteraciones = Number(textoIteraciones);
      if (!Number.isInteger(iteraciones) || iteraciones < 1 || iteraciones > 100000) {
        return { ok: false, actualizar: false };
      }
      const calculado = await derivar(password, desdeBase64Url(salB64), iteraciones);
      return {
        ok: igualesEnTiempoConstante(calculado, desdeBase64Url(hashB64)),
        actualizar: iteraciones !== ITERACIONES_PBKDF2,
      };
    }
    // Formato viejo: sha256(password) en hexadecimal.
    if (/^[0-9a-f]{64}$/.test(guardado)) {
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", codificador.encode(password)));
      const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
      return {
        ok: igualesEnTiempoConstante(codificador.encode(hex), codificador.encode(guardado)),
        actualizar: true,
      };
    }
  } catch (e) {
    console.error("Hash de contraseña ilegible:", e);
  }
  return { ok: false, actualizar: false };
}

/** Compara dos listas de bytes sin cortar en la primera diferencia. */
function igualesEnTiempoConstante(a, b) {
  if (a.length !== b.length) return false;
  let diferencias = 0;
  for (let i = 0; i < a.length; i++) diferencias |= a[i] ^ b[i];
  return diferencias === 0;
}
