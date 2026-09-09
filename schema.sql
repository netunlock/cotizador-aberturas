-- Schema para Foro de Cotizador de Aberturas
-- Cloudflare D1 Database

CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS preguntas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id TEXT,
  nombre TEXT NOT NULL,
  email TEXT,
  pregunta TEXT NOT NULL,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  votos INTEGER DEFAULT 0,
  FOREIGN KEY(categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pregunta INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT,
  respuesta TEXT NOT NULL,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  votos INTEGER DEFAULT 0,
  FOREIGN KEY(id_pregunta) REFERENCES preguntas(id)
);

-- Categorías iniciales
INSERT INTO categorias (id, nombre, slug, descripcion) VALUES
  ('presupuestos', 'Presupuestos', 'presupuestos', 'Dudas sobre cómo hacer presupuestos y cotizaciones'),
  ('configuracion', 'Configuración', 'configuracion', 'Preguntas sobre configurar el programa'),
  ('reportes', 'Reportes y Exportación', 'reportes', 'Cómo generar reportes y exportar datos'),
  ('general', 'General', 'general', 'Otros temas y preguntas generales');
