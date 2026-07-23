-- ============================================================
-- Migración: Tipos de proceso (FASE 3)
-- Rama: feature/tipos-proceso
-- Ejecutar en producción (desarrollo: TypeORM synchronize aplica automáticamente)
-- ============================================================

-- ── 1. Tabla mission_axes (jerarquía de 2 niveles) ──────────
CREATE TABLE IF NOT EXISTS mission_axes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(300) NOT NULL,
  parent_id UUID REFERENCES mission_axes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Seed de ejes misionales (idempotente) ────────────────
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF (SELECT COUNT(*) FROM mission_axes) = 0 THEN
    -- Ejes raíz
    INSERT INTO mission_axes (name) VALUES
      ('Docencia directa'),
      ('Asesorías de trabajo de grado'),
      ('Investigación'),
      ('Extensión');

    -- Eje padre: Administración académica
    INSERT INTO mission_axes (name) VALUES ('Administración académica')
    RETURNING id INTO v_admin_id;

    -- Subejes de Administración académica
    INSERT INTO mission_axes (name, parent_id) VALUES
      ('Gestión de programas', v_admin_id),
      ('Representatividad en cuerpos colegiados u otros', v_admin_id),
      ('Otras actividades administrativas (Internacionalización, Bienestar, entre otras)', v_admin_id);
  END IF;
END $$;

-- ── 3. Enum plantilla de sesión ─────────────────────────────
DO $$ BEGIN
  CREATE TYPE session_template_enum AS ENUM (
    'tres_momentos',
    'descripcion_libre',
    'investigacion'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 4. Columnas nuevas en processes ────────────────────────
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS strategy_id     UUID REFERENCES strategies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mission_axis_id UUID REFERENCES mission_axes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_template session_template_enum NOT NULL DEFAULT 'tres_momentos';

-- ── 5. Columnas nuevas en course_sessions (plantilla investigación) ──
ALTER TABLE course_sessions
  ADD COLUMN IF NOT EXISTS tema_tecnico          VARCHAR(500),
  ADD COLUMN IF NOT EXISTS herramienta_simulador VARCHAR(300),
  ADD COLUMN IF NOT EXISTS desarrollo            TEXT,
  ADD COLUMN IF NOT EXISTS resultados            TEXT;
