-- Copia de cada consulta del formulario de /contacto/. Se aplica con
--   npx wrangler d1 execute inacons-contacto --remote --file=schema.sql
-- La IP no se guarda: solo un hash con sal, para limitar envíos por hora.

CREATE TABLE IF NOT EXISTS consultas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  creado    TEXT    NOT NULL DEFAULT (datetime('now')),
  nombre    TEXT    NOT NULL,
  correo    TEXT    NOT NULL,
  telefono  TEXT    NOT NULL,
  empresa   TEXT    NOT NULL DEFAULT '',
  servicio  TEXT    NOT NULL,
  mensaje   TEXT    NOT NULL,
  origen    TEXT    NOT NULL DEFAULT '',
  ip_hash   TEXT    NOT NULL,
  -- recibido → notificado | error. Un 'error' es una consulta que ventas no recibió.
  estado    TEXT    NOT NULL DEFAULT 'recibido',
  error     TEXT
);

CREATE INDEX IF NOT EXISTS consultas_creado ON consultas (creado);

-- Reportes del Canal Ético. En los anónimos nombre, correo y teléfono van
-- vacíos, y ninguna fila lleva la IP ni su hash. No se purgan solos: son
-- registros de cumplimiento.
CREATE TABLE IF NOT EXISTS reportes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo       TEXT    NOT NULL UNIQUE,
  creado       TEXT    NOT NULL DEFAULT (datetime('now')),
  tipo         TEXT    NOT NULL,
  modalidad    TEXT    NOT NULL,           -- nombre | anonimo
  nombre       TEXT    NOT NULL DEFAULT '',
  correo       TEXT    NOT NULL DEFAULT '',
  telefono     TEXT    NOT NULL DEFAULT '',
  relacion     TEXT    NOT NULL DEFAULT '',
  lugar        TEXT    NOT NULL DEFAULT '',
  fecha_hecho  TEXT    NOT NULL DEFAULT '',
  personas     TEXT    NOT NULL DEFAULT '',
  descripcion  TEXT    NOT NULL,
  origen       TEXT    NOT NULL DEFAULT '',
  destino      TEXT    NOT NULL,           -- a quién se avisó, por si cambia el reparto
  estado       TEXT    NOT NULL DEFAULT 'recibido',
  error        TEXT
);

-- Envíos recientes por conexión, para el límite por hora del Canal Ético.
-- Separado de reportes para no ligar un reporte anónimo a una conexión;
-- se vacía cada día.
CREATE TABLE IF NOT EXISTS limites (
  ruta     TEXT NOT NULL,
  ip_hash  TEXT NOT NULL,
  creado   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS limites_ip ON limites (ruta, ip_hash, creado);
