-- ============================================================
-- NODOSYS · MIGRACIÓN FASE 2 — Inventario
-- Ejecutar: psql -U postgres -d nodosys_dev -f migration-fase2.sql
-- ============================================================

-- Nuevos roles en el ENUM de usuarios
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coordinador';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'decano';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vicerrector_extension';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- Nuevas columnas en users (facultad y programa)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS faculty  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS program  VARCHAR(200);

-- ── ENUM: estado físico de la unidad ─────────────────────
CREATE TYPE unit_condition AS ENUM (
  'excelente', 'bueno', 'regular', 'malo', 'dado_de_baja'
);

-- ── ENUM: disponibilidad de la unidad ────────────────────
CREATE TYPE unit_status AS ENUM (
  'disponible', 'en_prestamo', 'en_reparacion', 'dado_de_baja'
);

-- ── ENUM: tipos de movimiento ────────────────────────────
CREATE TYPE movement_type_v2 AS ENUM (
  'entrada', 'salida', 'devolucion', 'baja',
  'cambio_estado', 'cambio_ubicacion'
);

-- ── TABLA: inventory_units ───────────────────────────────
-- Cada fila = UN objeto físico real con su serial y estado
CREATE TABLE IF NOT EXISTS inventory_units (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id          UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  registered_by    UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Identificación de la unidad
  serial_number    VARCHAR(150) UNIQUE,   -- NULL en muebles, sillas, etc.
  internal_code    VARCHAR(100),          -- Código del nodo (ej: NODO-PC-001)

  -- Estado y disponibilidad
  condition        unit_condition NOT NULL DEFAULT 'bueno',
  status           unit_status    NOT NULL DEFAULT 'disponible',
  location         VARCHAR(200)   NOT NULL DEFAULT 'Nodo',

  -- Información de adquisición
  acquisition_date  DATE,
  acquisition_value DECIMAL(12, 2),

  -- Archivos
  photo_url        TEXT,
  qr_code          TEXT,

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_units_item     ON inventory_units(item_id);
CREATE INDEX IF NOT EXISTS idx_units_status   ON inventory_units(status);
CREATE INDEX IF NOT EXISTS idx_units_condition ON inventory_units(condition);
CREATE INDEX IF NOT EXISTS idx_units_serial   ON inventory_units(serial_number);

-- ── TABLA: inventory_movements ───────────────────────────
-- Cada movimiento = un evento en la vida de una unidad física
CREATE TABLE IF NOT EXISTS inventory_movements (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id              UUID NOT NULL REFERENCES inventory_units(id) ON DELETE CASCADE,
  registered_by        UUID REFERENCES users(id) ON DELETE SET NULL,

  movement_type        movement_type_v2 NOT NULL,
  movement_date        DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Para salidas / préstamos
  destination          VARCHAR(200),
  responsible          VARCHAR(200),
  responsible_id       VARCHAR(50),
  expected_return_date DATE,
  returned_at          DATE,

  -- Para cambio de estado
  previous_condition   VARCHAR(50),
  new_condition        VARCHAR(50),

  -- Para cambio de ubicación
  previous_location    VARCHAR(200),
  new_location         VARCHAR(200),

  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_unit ON inventory_movements(unit_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(movement_date);

-- ── Agregar columna track_by_unit a inventory_items ──────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS track_by_unit BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description   TEXT;

-- ── TRIGGER updated_at para inventory_units ───────────────
CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON inventory_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── VISTA: resumen de unidades por ítem ──────────────────
CREATE OR REPLACE VIEW v_item_units_summary AS
SELECT
  i.id                 AS item_id,
  i.name               AS item_name,
  i.brand,
  i.model,
  c.name               AS category_name,
  c.icon               AS category_icon,
  COUNT(u.id)          AS total_units,
  COUNT(CASE WHEN u.status = 'disponible'    THEN 1 END) AS disponible,
  COUNT(CASE WHEN u.status = 'en_prestamo'   THEN 1 END) AS en_prestamo,
  COUNT(CASE WHEN u.status = 'en_reparacion' THEN 1 END) AS en_reparacion,
  COUNT(CASE WHEN u.condition = 'excelente'  THEN 1 END) AS excelente,
  COUNT(CASE WHEN u.condition = 'bueno'      THEN 1 END) AS bueno,
  COUNT(CASE WHEN u.condition = 'regular'    THEN 1 END) AS regular,
  COUNT(CASE WHEN u.condition = 'malo'       THEN 1 END) AS malo,
  COUNT(CASE WHEN u.condition = 'dado_de_baja' THEN 1 END) AS dado_de_baja
FROM inventory_items i
JOIN inventory_categories c ON c.id = i.category_id
LEFT JOIN inventory_units u ON u.item_id = i.id
WHERE i.deleted_at IS NULL
GROUP BY i.id, i.name, i.brand, i.model, c.name, c.icon;

SELECT '✅ Migración Fase 2 ejecutada correctamente' AS resultado;