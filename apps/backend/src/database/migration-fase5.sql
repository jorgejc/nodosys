-- ============================================================
-- NODOSYS · FASE 5 — Gestión de Actividades y Viáticos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ── ENUMs ────────────────────────────────────────────────────
CREATE TYPE request_status AS ENUM (
  'borrador',       -- El docente lo está completando
  'pendiente',      -- Enviada, esperando revisión
  'aprobada',       -- Aprobada por decano/admin
  'rechazada',      -- Rechazada con motivo
  'en_ejecucion',   -- Actividad en curso
  'ejecutada',      -- Actividad completada, gastos registrados
  'cerrada'         -- Proceso finalizado con todos los soportes
);

CREATE TYPE expense_category AS ENUM (
  'alimentacion',
  'transporte',
  'hospedaje',
  'materiales',
  'comunicaciones',
  'otro'
);

CREATE TYPE evidence_type AS ENUM (
  'foto_evento',
  'factura',
  'factura_pendiente',
  'registro_participantes',
  'otro'
);

-- ── TABLA: activity_requests ──────────────────────────────────
-- Cada fila = una solicitud de actividad con viáticos
CREATE TABLE activity_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Código único generado al aprobar (ej: ACT-2026-047)
  activity_code    VARCHAR(20) UNIQUE,

  -- Puede estar vinculada al plan de trabajo (opcional)
  axis_activity_id UUID REFERENCES axis_activities(id) ON DELETE SET NULL,

  -- Información básica de la actividad
  title            VARCHAR(300) NOT NULL,
  description      TEXT,
  activity_date    DATE NOT NULL,
  end_date         DATE,
  location         VARCHAR(300),
  expected_participants INTEGER DEFAULT 0,

  -- ¿Requiere viáticos? (cada uno con monto estimado)
  requires_food          BOOLEAN NOT NULL DEFAULT FALSE,
  food_amount            DECIMAL(12,2) DEFAULT 0,

  requires_transport     BOOLEAN NOT NULL DEFAULT FALSE,
  transport_amount       DECIMAL(12,2) DEFAULT 0,

  requires_accommodation BOOLEAN NOT NULL DEFAULT FALSE,
  accommodation_amount   DECIMAL(12,2) DEFAULT 0,

  requires_materials     BOOLEAN NOT NULL DEFAULT FALSE,
  materials_amount       DECIMAL(12,2) DEFAULT 0,

  requires_other         BOOLEAN NOT NULL DEFAULT FALSE,
  other_description      VARCHAR(200),
  other_amount           DECIMAL(12,2) DEFAULT 0,

  -- ¿Requiere anticipo de dinero?
  requires_advance       BOOLEAN NOT NULL DEFAULT FALSE,
  advance_amount         DECIMAL(12,2) DEFAULT 0,

  -- Total estimado (calculado)
  total_estimated        DECIMAL(12,2) DEFAULT 0,

  -- Estado del proceso de aprobación
  status           request_status NOT NULL DEFAULT 'borrador',
  rejection_reason TEXT,

  -- Quién revisó y cuándo
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,

  -- Observaciones del revisor
  reviewer_notes   TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_requests_user   ON activity_requests(user_id);
CREATE INDEX idx_requests_status ON activity_requests(status);
CREATE INDEX idx_requests_date   ON activity_requests(activity_date);

-- ── TABLA: activity_expenses ──────────────────────────────────
-- Gastos REALES después de ejecutar la actividad
-- (puede haber múltiples fechas si la actividad dura varios días)
CREATE TABLE activity_expenses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id    UUID NOT NULL REFERENCES activity_requests(id) ON DELETE CASCADE,
  registered_by UUID REFERENCES users(id) ON DELETE SET NULL,

  expense_date  DATE NOT NULL,
  category      expense_category NOT NULL,
  description   VARCHAR(300),
  amount        DECIMAL(12,2) NOT NULL,

  -- URL de la foto del recibo/factura en Supabase Storage
  receipt_url   TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_request  ON activity_expenses(request_id);
CREATE INDEX idx_expenses_category ON activity_expenses(category);

-- ── TABLA: activity_participants ──────────────────────────────
-- Registro de asistentes a la actividad
CREATE TABLE activity_participants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES activity_requests(id) ON DELETE CASCADE,

  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(200),
  phone       VARCHAR(30),
  institution VARCHAR(200),
  role        VARCHAR(100),   -- "Estudiante", "Docente", "Comunidad"

  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_participants_request ON activity_participants(request_id);

-- ── TABLA: activity_evidence ──────────────────────────────────
-- Fotos del evento, facturas, otros archivos
CREATE TABLE activity_evidence (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id    UUID NOT NULL REFERENCES activity_requests(id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,

  evidence_type evidence_type NOT NULL,
  storage_url   TEXT NOT NULL,    -- URL en Supabase Storage
  file_name     VARCHAR(255),
  caption       VARCHAR(300),
  file_size_kb  INTEGER,

  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_request ON activity_evidence(request_id);
CREATE INDEX idx_evidence_type    ON activity_evidence(evidence_type);

-- ── SECUENCIA para el código de actividad ─────────────────────
-- Genera números consecutivos: ACT-2026-001, ACT-2026-002...
CREATE SEQUENCE IF NOT EXISTS activity_code_seq START 1;

-- Función para generar el código
CREATE OR REPLACE FUNCTION generate_activity_code()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num   INT;
  code      TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_num   := nextval('activity_code_seq');
  code      := 'ACT-' || year_part || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ── TRIGGERS ──────────────────────────────────────────────────
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON activity_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── VISTA: resumen de solicitudes por estado ──────────────────
CREATE OR REPLACE VIEW v_requests_summary AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'pendiente')      AS pendientes,
  COUNT(*) FILTER (WHERE status = 'aprobada')       AS aprobadas,
  COUNT(*) FILTER (WHERE status = 'rechazada')      AS rechazadas,
  COUNT(*) FILTER (WHERE status = 'ejecutada')      AS ejecutadas,
  COUNT(*) FILTER (WHERE status = 'cerrada')        AS cerradas,
  COUNT(*)                                           AS total,
  COALESCE(SUM(total_estimated) FILTER (WHERE status IN ('aprobada','en_ejecucion','ejecutada','cerrada')), 0) AS total_autorizado
FROM activity_requests
GROUP BY user_id;

SELECT '✅ Fase 5 - Tablas de actividades y viáticos creadas' AS resultado;
