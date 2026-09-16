-- =====================================================================
-- Migración del 14/09/2026: pone al día la base D1 de PRODUCCIÓN
-- =====================================================================
--
-- ¿Por qué hace falta?
--   La base "cotizador-forum" se creó con una versión vieja del esquema.
--   Después schema.sql sumó columnas (roles, contadores, fijar y cerrar
--   hilos) que nunca se agregaron a la base real. Verificado el 14/09/2026
--   leyendo sqlite_master de producción, faltan:
--     usuarios   → rol, avatar_url, firma, posts_count
--     preguntas  → fecha_actualizada, vistas, respuestas_count,
--                  is_locked, is_pinned
--     respuestas → is_locked
--   y todos los índices. Con la base así, el worker actual falla con
--   "no such column". Además se suma la tabla nueva "imagenes".
--
-- ¿Cómo se corre? UNA sola vez, y con el OK de Federico:
--   1) Respaldo, FUERA del repo (tiene emails y hashes de usuarios):
--        wrangler d1 export cotizador-forum --remote --output "../respaldos/foro-2026-09-14.sql"
--   2) Migración:
--        wrangler d1 execute cotizador-forum --remote --file migraciones/2026-09-14_columnas_faltantes_e_imagenes.sql
--
-- ¿Qué pasa si se corre dos veces?
--   SQLite no tiene "ADD COLUMN IF NOT EXISTS": la segunda vez frena con
--   "duplicate column name" en el primer ALTER.
--
-- ¿Y una base nueva (por ejemplo, para probar en tu PC)?
--   No usa este archivo: se crea directo con schema.sql, que ya tiene todo.
--
-- Es compatible con el worker viejo que está desplegado hoy: sólo AGREGA
-- columnas con valor por defecto y una tabla. No borra ni renombra nada.
-- =====================================================================

-- ---------- usuarios ----------
ALTER TABLE usuarios ADD COLUMN rol TEXT DEFAULT 'usuario';
ALTER TABLE usuarios ADD COLUMN avatar_url TEXT;
ALTER TABLE usuarios ADD COLUMN firma TEXT;
ALTER TABLE usuarios ADD COLUMN posts_count INTEGER DEFAULT 0;

-- ---------- preguntas ----------
-- SQLite no deja agregar una columna con DEFAULT CURRENT_TIMESTAMP (no es
-- un valor constante), así que se agrega vacía y se completa más abajo.
-- No pasa nada: el worker siempre la escribe explícitamente.
ALTER TABLE preguntas ADD COLUMN fecha_actualizada DATETIME;
ALTER TABLE preguntas ADD COLUMN vistas INTEGER DEFAULT 0;
ALTER TABLE preguntas ADD COLUMN respuestas_count INTEGER DEFAULT 0;
ALTER TABLE preguntas ADD COLUMN is_locked BOOLEAN DEFAULT 0;
ALTER TABLE preguntas ADD COLUMN is_pinned BOOLEAN DEFAULT 0;

-- ---------- respuestas ----------
ALTER TABLE respuestas ADD COLUMN is_locked BOOLEAN DEFAULT 0;

-- ---------- completar los datos que ya existen ----------
-- Última actividad = la respuesta más nueva, o la pregunta si no tiene respuestas.
UPDATE preguntas
SET fecha_actualizada = COALESCE(
  (SELECT MAX(r.fecha) FROM respuestas r WHERE r.id_pregunta = preguntas.id),
  preguntas.fecha
);

UPDATE preguntas
SET respuestas_count = (SELECT COUNT(*) FROM respuestas r WHERE r.id_pregunta = preguntas.id);

UPDATE usuarios
SET posts_count = (SELECT COUNT(*) FROM preguntas p WHERE p.usuario_id = usuarios.id)
                + (SELECT COUNT(*) FROM respuestas r WHERE r.usuario_id = usuarios.id);

-- es_admin ya existía en producción, pero "rol" es la columna que usa el código.
-- OJO: el rol sólo muestra la insignia "Admin" en el foro. NO da acceso al
-- panel: eso se controla únicamente con el secreto ADMIN_PASSWORD del worker.
UPDATE usuarios SET rol = 'admin' WHERE es_admin = 1;

-- ---------- tabla nueva: imagenes (igual que en schema.sql) ----------
-- preguntas.imagenes y respuestas.imagenes guardan un JSON con los id de
-- esta tabla, por ejemplo ["3f2a...","9b1c..."]. Cada imagen se sirve con
-- GET /api/imagenes/:id.
CREATE TABLE IF NOT EXISTS imagenes (
  id TEXT PRIMARY KEY,                 -- UUID aleatorio, no se puede adivinar
  usuario_id INTEGER NOT NULL,         -- quién la subió
  mime TEXT NOT NULL,                  -- image/jpeg, image/png o image/webp
  bytes INTEGER NOT NULL,              -- tamaño en bytes
  datos BLOB NOT NULL,                 -- la imagen en sí (ya comprimida en el navegador)
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ---------- índices (los mismos de schema.sql) ----------
CREATE INDEX IF NOT EXISTS idx_preguntas_fecha ON preguntas(fecha_actualizada DESC);
CREATE INDEX IF NOT EXISTS idx_preguntas_categoria ON preguntas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_preguntas_usuario ON preguntas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON respuestas(id_pregunta);
CREATE INDEX IF NOT EXISTS idx_respuestas_usuario ON respuestas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_votos_usuario ON votos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_usuario ON imagenes(usuario_id);
