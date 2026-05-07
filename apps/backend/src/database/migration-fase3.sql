-- ============================================================
-- NODOSYS · MIGRACIÓN FASE 3 — Plan de Trabajo
-- Basado en el formato real DO-F-002 de IU Digital
-- Ejecutar: psql -U postgres -d nodosys_dev -f migration-fase3.sql
-- ============================================================

-- ── ENUMs ────────────────────────────────────────────────────
CREATE TYPE plan_status_v2 AS ENUM (
  'borrador',    -- El docente lo está armando
  'activo',      -- Semestre en curso
  'completado',  -- Semestre terminado
  'archivado'    -- Histórico
);

-- Los 5 ejes misionales + 3 subcategorías de Adm. Académica
CREATE TYPE axis_type AS ENUM (
  'docencia_directa',
  'trabajos_de_grado',
  'investigacion',
  'extension',
  'gestion_de_programas',
  'representacion_cuerpos_colegiados',
  'otras_administrativas'
);

-- Estado de cada actividad específica
CREATE TYPE activity_status AS ENUM (
  'pendiente',
  'en_proceso',
  'finalizada'
);

-- Tipo de evidencia o entregable
CREATE TYPE evidence_type AS ENUM (
  'documento',
  'informe',
  'presentacion',
  'video',
  'otro'
);

-- Nivel académico del curso (para docencia directa)
CREATE TYPE course_level AS ENUM (
  'pregrado', 'posgrado', 'tecnico', 'tecnologia', 'otro'
);

-- Tipo de curso (para docencia directa)
CREATE TYPE course_type AS ENUM (
  'teorico', 'teorico_practica', 'practica', 'laboratorio'
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: work_plans
-- Un plan de trabajo = un docente × un semestre
-- ══════════════════════════════════════════════════════════════
CREATE TABLE work_plans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Encabezado del documento DO-F-002
  resolution_number VARCHAR(50),          -- Ej: 202502730
  faculty           VARCHAR(200),         -- Ingeniería y Ciencias Agropecuarias
  program           VARCHAR(200),         -- Tecnología en Desarrollo de Software
  semester          VARCHAR(20) NOT NULL, -- "2026-1", "2026-2"
  year              INT  NOT NULL,
  total_hours       DECIMAL(8,2) NOT NULL, -- 900, 1000...
  fill_date         DATE,                 -- Fecha de diligenciamiento
  status            plan_status_v2 NOT NULL DEFAULT 'borrador',
  notes             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workplans_user   ON work_plans(user_id);
CREATE INDEX idx_workplans_status ON work_plans(status);
CREATE UNIQUE INDEX idx_workplans_user_semester
  ON work_plans(user_id, semester)
  WHERE status != 'archivado';  -- Un plan activo por docente por semestre

-- ══════════════════════════════════════════════════════════════
-- TABLA: work_plan_axes
-- Eje misional dentro del plan (docencia directa, investigación...)
-- Agrupa las actividades y las horas planeadas para ese eje
-- ══════════════════════════════════════════════════════════════
CREATE TABLE work_plan_axes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_plan_id   UUID NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  axis_type      axis_type NOT NULL,
  planned_hours  DECIMAL(8,2) NOT NULL DEFAULT 0,
  -- Orden de presentación en la UI
  display_order  INT NOT NULL DEFAULT 0,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(work_plan_id, axis_type)  -- Un eje por tipo por plan
);

CREATE INDEX idx_axes_plan ON work_plan_axes(work_plan_id);

-- ══════════════════════════════════════════════════════════════
-- TABLA: axis_activities
-- Actividad específica dentro de un eje misional.
-- Contiene tanto los datos de la Hoja 1 (planificación)
-- como los de la Hoja 2 (seguimiento/evidencias).
-- ══════════════════════════════════════════════════════════════
CREATE TABLE axis_activities (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  axis_id          UUID NOT NULL REFERENCES work_plan_axes(id) ON DELETE CASCADE,
  sequence_number  INT  NOT NULL DEFAULT 1, -- N° de la actividad en la lista
  name             VARCHAR(500) NOT NULL,    -- Nombre de la actividad / asignatura

  -- ── HOJA 1: Planificación ─────────────────────────────────
  -- Campos específicos de DOCENCIA DIRECTA
  course_code    VARCHAR(100),  -- PREICA2502B010017
  group_code     VARCHAR(50),   -- PREICA2502B010017 (código de grupo)
  num_students   INT,
  level          course_level,
  course_type    course_type,
  weeks          INT,
  hours_per_week DECIMAL(5,2),
  -- total_hours_semester = weeks * hours_per_week (calculado)

  -- Campos específicos de TRABAJOS DE GRADO
  thesis_modality VARCHAR(200), -- "Asesoría de prácticas", "Proyecto de grado"
  student_name    VARCHAR(300), -- Nombre del estudiante asesorado

  -- Horas planeadas para esta actividad (base para el porcentaje)
  -- Para docencia directa: = weeks * hours_per_week
  -- Para otros ejes: se ingresa directamente
  planned_hours  DECIMAL(8,2) NOT NULL DEFAULT 0,

  -- ── HOJA 2: Seguimiento y evidencias ─────────────────────
  -- Breve descripción de la relación entre el eje y la actividad
  specific_description TEXT,

  -- Las 3 dimensiones de la Digitalidad Próxima (marcar con X)
  dim_inclusion   BOOLEAN NOT NULL DEFAULT FALSE,
  dim_territorial BOOLEAN NOT NULL DEFAULT FALSE,
  dim_human       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Justificación de las dimensiones marcadas
  dimension_justification TEXT,

  -- Estado: pendiente | en_proceso | finalizada
  activity_status activity_status NOT NULL DEFAULT 'pendiente',

  -- Fechas de la actividad
  start_date DATE,
  end_date   DATE,

  -- Soportes/Evidencias
  evidence_type evidence_type,
  evidence_url  TEXT,  -- URL al Drive con los soportes

  -- Horas realmente ejecutadas de esta actividad
  executed_hours DECIMAL(8,2) NOT NULL DEFAULT 0,

  -- Observaciones (docente y decano)
  teacher_observations TEXT,
  dean_observations    TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_axis   ON axis_activities(axis_id);
CREATE INDEX idx_activities_status ON axis_activities(activity_status);

-- ══════════════════════════════════════════════════════════════
-- TRIGGERS: updated_at automático
-- ══════════════════════════════════════════════════════════════
CREATE TRIGGER update_workplans_v2_updated_at
  BEFORE UPDATE ON work_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_axes_updated_at
  BEFORE UPDATE ON work_plan_axes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON axis_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- VISTA: v_axis_summary
-- Resumen de cada eje: horas planeadas, ejecutadas, % avance
-- Esta vista es la que alimenta los indicadores del dashboard
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_axis_summary AS
SELECT
  ax.id                       AS axis_id,
  ax.work_plan_id,
  ax.axis_type,
  ax.planned_hours,
  wp.total_hours              AS plan_total_hours,
  ROUND((ax.planned_hours / NULLIF(wp.total_hours, 0) * 100)::numeric, 1)
                              AS planned_percentage,
  COALESCE(SUM(a.executed_hours), 0)
                              AS executed_hours,
  ROUND((COALESCE(SUM(a.executed_hours), 0) /
    NULLIF(ax.planned_hours, 0) * 100)::numeric, 1)
                              AS executed_percentage,
  COUNT(a.id)                 AS total_activities,
  COUNT(CASE WHEN a.activity_status = 'finalizada' THEN 1 END)
                              AS finished_activities,
  COUNT(CASE WHEN a.activity_status = 'en_proceso' THEN 1 END)
                              AS in_progress_activities
FROM work_plan_axes ax
JOIN work_plans wp ON wp.id = ax.work_plan_id
LEFT JOIN axis_activities a ON a.axis_id = ax.id
GROUP BY ax.id, ax.work_plan_id, ax.axis_type, ax.planned_hours, wp.total_hours;

-- ══════════════════════════════════════════════════════════════
-- VISTA: v_plan_summary
-- Resumen global del plan de trabajo
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_plan_summary AS
SELECT
  wp.id                       AS plan_id,
  wp.user_id,
  wp.semester,
  wp.year,
  wp.total_hours,
  wp.status,
  COALESCE(SUM(a.executed_hours), 0)
                              AS total_executed_hours,
  ROUND((COALESCE(SUM(a.executed_hours), 0) /
    NULLIF(wp.total_hours, 0) * 100)::numeric, 1)
                              AS overall_completion_percentage,
  COUNT(DISTINCT ax.id)       AS total_axes,
  COUNT(a.id)                 AS total_activities,
  COUNT(CASE WHEN a.activity_status = 'finalizada' THEN 1 END)
                              AS finished_activities
FROM work_plans wp
LEFT JOIN work_plan_axes ax ON ax.work_plan_id = wp.id
LEFT JOIN axis_activities a  ON a.axis_id = ax.id
GROUP BY wp.id, wp.user_id, wp.semester, wp.year, wp.total_hours, wp.status;

SELECT '✅ Migración Fase 3 (Plan de Trabajo) ejecutada correctamente' AS resultado;
