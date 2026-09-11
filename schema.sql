-- Schema para Foro de Cotizador de Aberturas
-- Cloudflare D1 Database

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  password_hash TEXT,
  es_invitado BOOLEAN DEFAULT 0,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  es_admin BOOLEAN DEFAULT 0,
  rol TEXT DEFAULT 'usuario',
  avatar_url TEXT,
  firma TEXT,
  posts_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS preguntas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  categoria_id TEXT,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  imagenes TEXT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizada DATETIME DEFAULT CURRENT_TIMESTAMP,
  votos INTEGER DEFAULT 0,
  vistas INTEGER DEFAULT 0,
  respuestas_count INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT 0,
  is_pinned BOOLEAN DEFAULT 0,
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY(categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  id_pregunta INTEGER NOT NULL,
  contenido TEXT NOT NULL,
  imagenes TEXT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  votos INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT 0,
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY(id_pregunta) REFERENCES preguntas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS votos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  contenido_id INTEGER NOT NULL,
  tipo_voto TEXT NOT NULL,
  UNIQUE(usuario_id, tipo, contenido_id),
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_preguntas_fecha ON preguntas(fecha_actualizada DESC);
CREATE INDEX IF NOT EXISTS idx_preguntas_categoria ON preguntas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_preguntas_usuario ON preguntas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON respuestas(id_pregunta);
CREATE INDEX IF NOT EXISTS idx_respuestas_usuario ON respuestas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_votos_usuario ON votos(usuario_id);

-- Categorías actualizadas
INSERT INTO categorias (id, nombre, slug, descripcion) VALUES
  ('cotizador', 'Cotizador de aberturas', 'cotizador', 'Preguntas sobre el Cotizador de Aberturas'),
  ('calculos', 'Calculos, formulas, descuentos', 'calculos', 'Dudas sobre fórmulas y descuentos'),
  ('consultas', 'Consultas generales', 'consultas', 'Preguntas generales sobre el programa'),
  ('sistemas', 'Sistemas', 'sistemas', 'Preguntas sobre sistemas operativos y requisitos'),
  ('sugerencias', 'Sugerencias', 'sugerencias', 'Propuestas de mejora para el programa'),
  ('offtopic', 'Off topic', 'offtopic', 'Temas fuera del alcance del programa');
