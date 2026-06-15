-- ============================================================
-- NODOSYS · FIX PRODUCCIÓN — Plan de Trabajo
-- Archivo: fix-produccion.sql
-- Ejecutar en: Supabase → SQL Editor (pegar completo)
-- Fecha: 2026-06-13
-- ============================================================
-- PROBLEMA: migration-fase3.sql tiene "CREATE TABLE work_plans"
-- sin IF NOT EXISTS. Si schema.sql fue aplicado primero en
-- Supabase, la migración entera falló y nunca se crearon:
--   · work_plan_axes
--   · axis_activities
--   · v_plan_summary   ← causa directa del 500 en GET /workplan/:id
--   · v_axis_summary   ← causa directa del 500 en GET /workplan/:id/summary
--
-- CONFLICTO ADICIONAL: evidence_type está definido con valores
-- distintos en migration-fase3.sql y migration-fase5.sql.
-- Este script usa el nombre "workplan_evidence_type" para el tipo
-- del plan de trabajo y evita pisar el tipo de actividades.
--
-- Este script es IDEMPOTENTE: puede ejecutarse más de una vez
-- sin dañar datos existentes.
-- ============================================================


-- ============================================================
-- PASO 1: ENUMs
-- ============================================================

-- Roles nuevos que puede faltar en user_role si migration-fase2
-- no se ejecutó completo, o si se agregaron al entity después.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'docente';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vicerrector_academico';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'equipo_extension';
-- Los siguientes deberían existir desde migration-fase2, pero
-- ADD VALUE IF NOT EXISTS es no-destructivo.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coordinador';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'decano';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vicerrector_extension';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- plan_status: puede existir desde schema.sql con los mismos valores.
DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM (
    'borrador',
    'activo',
    'completado',
    'archivado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- axis_type: nuevo, solo para work_plan_axes.
DO $$ BEGIN
  CREATE TYPE axis_type AS ENUM (
    'docencia_directa',
    'trabajos_de_grado',
    'investigacion',
    'extension',
    'gestion_de_programas',
    'representacion_cuerpos_colegiados',
    'otras_administrativas'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- activity_status: nuevo, para axis_activities.
DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM (
    'pendiente',
    'en_proceso',
    'finalizada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- course_level: nuevo, para docencia directa en axis_activities.
DO $$ BEGIN
  CREATE TYPE course_level AS ENUM (
    'pregrado',
    'posgrado',
    'tecnico',
    'tecnologia',
    'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- course_type: nuevo, para docencia directa en axis_activities.
DO $$ BEGIN
  CREATE TYPE course_type AS ENUM (
    'teorico',
    'teorico_practica',
    'practica',
    'laboratorio'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- workplan_evidence_type: nombre propio para evitar el conflicto con
-- el "evidence_type" de migration-fase5.sql (que tiene valores
-- distintos: foto_evento, factura, etc.).
-- Los valores aquí corresponden al enum EvidenceType de axis-activity.entity.ts.
DO $$ BEGIN
  CREATE TYPE workplan_evidence_type AS ENUM (
    'documento',
    'informe',
    'presentacion',
    'video',
    'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- PASO 2: Tabla work_plans
-- ============================================================
-- Creación con IF NOT EXISTS para el caso de Supabase limpio.
-- Si ya existe desde schema.sql, las cláusulas ALTER TABLE
-- a continuación agregan las columnas faltantes.

CREATE TABLE IF NOT EXISTS work_plans (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resolution_number VARCHAR(50),
  faculty           VARCHAR(200),
  program           VARCHAR(200),
  semester          VARCHAR(20)  NOT NULL,
  year              INT          NOT NULL DEFAULT 0,
  total_hours       DECIMAL(8,2) NOT NULL DEFAULT 0,
  fill_date         DATE,
  status            plan_status  NOT NULL DEFAULT 'borrador',
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Columnas que existen en la entidad pero NO en el schema.sql original.
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS resolution_number VARCHAR(50);
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS faculty           VARCHAR(200);
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS program           VARCHAR(200);
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS year              INT NOT NULL DEFAULT 0;
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS fill_date         DATE;
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS notes             TEXT;

-- En schema.sql, nodo_id, name, start_date y end_date eran NOT NULL
-- pero la entidad actual no los mapea. Si el backend hace un INSERT
-- sin esas columnas, la BD lanzará un error de constraint.
-- Los hacemos nullable para que el backend funcione sin romper datos.
DO $$ BEGIN
  ALTER TABLE work_plans ALTER COLUMN nodo_id     DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_plans ALTER COLUMN name        DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_plans ALTER COLUMN start_date  DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_plans ALTER COLUMN end_date    DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Índices (IF NOT EXISTS disponible desde PostgreSQL 9.5)
CREATE INDEX IF NOT EXISTS idx_workplans_user_id ON work_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workplans_status  ON work_plans(status);


-- ============================================================
-- PASO 3: Tabla work_plan_axes
-- ============================================================

CREATE TABLE IF NOT EXISTS work_plan_axes (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_plan_id   UUID         NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  axis_type      axis_type    NOT NULL,
  planned_hours  DECIMAL(8,2) NOT NULL DEFAULT 0,
  display_order  INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(work_plan_id, axis_type)
);

CREATE INDEX IF NOT EXISTS idx_axes_work_plan_id ON work_plan_axes(work_plan_id);


-- ============================================================
-- PASO 4: Tabla axis_activities
-- ============================================================

CREATE TABLE IF NOT EXISTS axis_activities (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  axis_id          UUID NOT NULL REFERENCES work_plan_axes(id) ON DELETE CASCADE,
  sequence_number  INT  NOT NULL DEFAULT 1,
  name             VARCHAR(500) NOT NULL,

  -- Hoja 1: campos de Docencia Directa
  course_code      VARCHAR(100),
  group_code       VARCHAR(50),
  num_students     INT,
  level            course_level,
  course_type      course_type,
  weeks            INT,
  hours_per_week   DECIMAL(5,2),

  -- Hoja 1: campos de Trabajos de Grado
  thesis_modality  VARCHAR(200),
  student_name     VARCHAR(300),

  -- Horas
  planned_hours    DECIMAL(8,2) NOT NULL DEFAULT 0,
  executed_hours   DECIMAL(8,2) NOT NULL DEFAULT 0,

  -- Hoja 2: Seguimiento y evidencias
  specific_description    TEXT,
  dim_inclusion           BOOLEAN NOT NULL DEFAULT FALSE,
  dim_territorial         BOOLEAN NOT NULL DEFAULT FALSE,
  dim_human               BOOLEAN NOT NULL DEFAULT FALSE,
  dimension_justification TEXT,
  activity_status         activity_status        NOT NULL DEFAULT 'pendiente',
  start_date              DATE,
  end_date                DATE,
  -- Usa workplan_evidence_type para no pisar el evidence_type de fase5
  evidence_type           workplan_evidence_type,
  evidence_url            TEXT,
  teacher_observations    TEXT,
  dean_observations       TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axis_activities_axis_id ON axis_activities(axis_id);
CREATE INDEX IF NOT EXISTS idx_axis_activities_status  ON axis_activities(activity_status);


-- ============================================================
-- PASO 5: Triggers updated_at
-- ============================================================
-- La función update_updated_at_column() debe existir (viene de schema.sql).
-- Si no existe, crearla también.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER update_work_plans_updated_at
    BEFORE UPDATE ON work_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_work_plan_axes_updated_at
    BEFORE UPDATE ON work_plan_axes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_axis_activities_updated_at
    BEFORE UPDATE ON axis_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- PASO 6: Vistas — FIX DIRECTO de los errores 500
-- ============================================================
-- GET /workplan/:id        → findOne() llama a getPlanSummary()
--                            que hace SELECT * FROM v_plan_summary
-- GET /workplan/:id/summary → getPlanSummary() directo

CREATE OR REPLACE VIEW v_axis_summary AS
SELECT
  ax.id                                                          AS axis_id,
  ax.work_plan_id,
  ax.axis_type,
  ax.planned_hours,
  wp.total_hours                                                 AS plan_total_hours,
  ROUND(
    (ax.planned_hours / NULLIF(wp.total_hours, 0) * 100)::numeric, 1
  )                                                              AS planned_percentage,
  COALESCE(SUM(a.executed_hours), 0)                            AS executed_hours,
  ROUND(
    (COALESCE(SUM(a.executed_hours), 0) /
     NULLIF(ax.planned_hours, 0) * 100)::numeric, 1
  )                                                              AS executed_percentage,
  COUNT(a.id)                                                    AS total_activities,
  COUNT(CASE WHEN a.activity_status = 'finalizada' THEN 1 END)  AS finished_activities,
  COUNT(CASE WHEN a.activity_status = 'en_proceso' THEN 1 END)  AS in_progress_activities
FROM work_plan_axes ax
JOIN  work_plans      wp ON wp.id = ax.work_plan_id
LEFT JOIN axis_activities a  ON a.axis_id = ax.id
GROUP BY
  ax.id, ax.work_plan_id, ax.axis_type, ax.planned_hours, wp.total_hours;


-- v_plan_summary: la vista que causa el 500 en ambos endpoints.
-- El service la consulta con: SELECT * FROM v_plan_summary WHERE plan_id = $1
CREATE OR REPLACE VIEW v_plan_summary AS
SELECT
  wp.id                                                          AS plan_id,
  wp.user_id,
  wp.semester,
  wp.year,
  wp.total_hours,
  wp.status,
  COALESCE(SUM(a.executed_hours), 0)                            AS total_executed_hours,
  ROUND(
    (COALESCE(SUM(a.executed_hours), 0) /
     NULLIF(wp.total_hours, 0) * 100)::numeric, 1
  )                                                              AS overall_completion_percentage,
  COUNT(DISTINCT ax.id)                                         AS total_axes,
  COUNT(a.id)                                                    AS total_activities,
  COUNT(CASE WHEN a.activity_status = 'finalizada' THEN 1 END)  AS finished_activities
FROM work_plans wp
LEFT JOIN work_plan_axes  ax ON ax.work_plan_id = wp.id
LEFT JOIN axis_activities a  ON a.axis_id = ax.id
GROUP BY
  wp.id, wp.user_id, wp.semester, wp.year, wp.total_hours, wp.status;


-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
-- Este SELECT debe devolver 5 filas sin errores.
-- Si alguna tabla/vista falta, lanzará una excepción aquí,
-- no en producción con un 500 genérico.

SELECT 'work_plans'              AS objeto, COUNT(*) AS filas FROM work_plans
UNION ALL
SELECT 'work_plan_axes',                    COUNT(*)          FROM work_plan_axes
UNION ALL
SELECT 'axis_activities',                   COUNT(*)          FROM axis_activities
UNION ALL
SELECT 'v_plan_summary (vista)',            COUNT(*)          FROM v_plan_summary
UNION ALL
SELECT 'v_axis_summary (vista)',            COUNT(*)          FROM v_axis_summary;
