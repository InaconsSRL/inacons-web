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
