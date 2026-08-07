-- ============================================================
-- Módulo: Equipo de Nodo · Monitorías (FASE A)
-- Ejecutar en Supabase SQL Editor (production)
-- En desarrollo TypeORM synchronize:true lo crea automáticamente
--
-- Idempotente: re-ejecutable sin error ni duplicados.
-- Depende de: users (schema.sql)
-- ============================================================

-- ── Firma del enlace ─────────────────────────────────────
-- El enlace sube su firma una sola vez y se reutiliza en todos
-- los certificados de horas que genere.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url VARCHAR(1000);

-- ── Plan de trabajo de una monitora ──────────────────────
CREATE TABLE IF NOT EXISTS monitor_work_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nodo_id     UUID,                        -- nodo al que pertenece (aislamiento)
  vigencia    VARCHAR(20) NOT NULL,        -- ej. '2026-1'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una monitora tiene un solo plan por vigencia
CREATE UNIQUE INDEX IF NOT EXISTS uq_monitor_plan_vigencia
  ON monitor_work_plans(monitor_id, vigencia);

CREATE INDEX IF NOT EXISTS idx_monitor_plans_nodo
  ON monitor_work_plans(nodo_id);

-- ── Actividades por semana ───────────────────────────────
CREATE TABLE IF NOT EXISTS monitor_week_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_plan_id  UUID NOT NULL REFERENCES monitor_work_plans(id) ON DELETE CASCADE,
  week_number   INTEGER NOT NULL,
  week_label    VARCHAR(120),              -- ej. 'Semana 5\n19-22 Mayo'
  description   TEXT NOT NULL,
  hours         DECIMAL(4,1) NOT NULL DEFAULT 0,  -- permite 2.5, 3.5, ...
  override_note TEXT,                      -- autorización del enlace si la semana supera 12 h
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_week_plan
  ON monitor_week_activities(work_plan_id, week_number);

-- ── Evidencias (opcionales, por semana) ──────────────────
CREATE TABLE IF NOT EXISTS monitor_evidences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_plan_id  UUID NOT NULL REFERENCES monitor_work_plans(id) ON DELETE CASCADE,
  week_number   INTEGER,                   -- a qué semana corresponde
  file_url      VARCHAR(1000) NOT NULL,    -- URL de la evidencia (se pega el enlace)
  caption       VARCHAR(300),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_evidences_plan
  ON monitor_evidences(work_plan_id, week_number);

-- ============================================================
-- FASE B · Semanas como entidad + evidencias por tarea
-- ============================================================
-- Objetivo:
--   · La semana pasa a ser una entidad propia (número + rango de fechas),
--     así no hay que reescribir el "nombre de la semana" en cada tarea.
--   · Las evidencias cuelgan de una TAREA concreta (activity_id), no de la
--     semana en general.
-- Todo aditivo y nullable → no rompe datos existentes. Idempotente.

-- ── Semana como entidad (número + rango de fechas) ───────
CREATE TABLE IF NOT EXISTS monitor_weeks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_plan_id UUID NOT NULL REFERENCES monitor_work_plans(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL,
  start_date   DATE,
  end_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una sola semana por número dentro de cada plan
CREATE UNIQUE INDEX IF NOT EXISTS uq_monitor_week_plan_number
  ON monitor_weeks(work_plan_id, week_number);

-- La actividad apunta a su semana (nullable = compat con filas viejas)
ALTER TABLE monitor_week_activities
  ADD COLUMN IF NOT EXISTS week_id UUID REFERENCES monitor_weeks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_monitor_activity_week
  ON monitor_week_activities(week_id);

-- La evidencia apunta a la tarea que documenta (nullable = compat)
ALTER TABLE monitor_evidences
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES monitor_week_activities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_monitor_evidences_activity
  ON monitor_evidences(activity_id);

-- ── Backfill de datos existentes (idempotente, sin pérdida) ──
-- 1) Crea una semana por cada (plan, week_number) que ya tenga actividades.
INSERT INTO monitor_weeks (work_plan_id, week_number)
SELECT DISTINCT a.work_plan_id, a.week_number
FROM monitor_week_activities a
WHERE NOT EXISTS (
  SELECT 1 FROM monitor_weeks w
  WHERE w.work_plan_id = a.work_plan_id
    AND w.week_number  = a.week_number
);

-- 2) Enlaza cada actividad sin semana a la semana correspondiente.
UPDATE monitor_week_activities a
SET week_id = w.id
FROM monitor_weeks w
WHERE a.week_id IS NULL
  AND w.work_plan_id = a.work_plan_id
  AND w.week_number  = a.week_number;

-- Nota: las evidencias viejas conservan week_number y quedan con
-- activity_id = NULL (no se puede saber a qué tarea exacta pertenecían).
-- El flujo nuevo siempre las asocia a una tarea.

-- ============================================================
-- FASE C · Que las horas y las evidencias no se puedan destruir
-- ============================================================
-- Las horas certificadas y sus evidencias son el soporte del pago de una
-- monitora. Tal como estaban, un solo DELETE en la tabla equivocada las
-- borraba en silencio:
--   · monitor_week_activities.week_id tenía ON DELETE CASCADE, así que
--     borrar una semana se llevaba por delante sus tareas. El servicio lo
--     bloqueaba con un count(), pero esa protección vivía SOLO en el código:
--     cualquier DELETE por SQL, script o panel de Supabase la saltaba.
--   · monitor_evidences.activity_id tenía ON DELETE CASCADE: borrar una
--     tarea destruía su rastro probatorio.
-- Idempotente: se recrean las FK por nombre.

-- ── 1. week_id: la base bloquea borrar una semana con tareas ──
-- NO ACTION (no RESTRICT) a propósito: se comprueba al FINAL de la
-- sentencia, así que borrar un plan completo sigue funcionando en cascada
-- (se borran semanas y tareas a la vez). RESTRICT se evalúa fila a fila y
-- haría imposible borrar un plan.
DO $$
DECLARE fk_name text;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'monitor_week_activities'
      AND con.contype = 'f' AND att.attname = 'week_id'
  LOOP
    EXECUTE format('ALTER TABLE monitor_week_activities DROP CONSTRAINT %I', fk_name);
  END LOOP;
END $$;

ALTER TABLE monitor_week_activities
  ADD CONSTRAINT fk_monitor_activity_week
  FOREIGN KEY (week_id) REFERENCES monitor_weeks(id) ON DELETE NO ACTION;

-- ── 2. activity_id: borrar una tarea NO borra su evidencia ──
-- SET NULL en vez de CASCADE: la evidencia sobrevive y queda "suelta"
-- (el modelo ya contempla las evidencias sin tarea, looseEvidences).
DO $$
DECLARE fk_name text;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'monitor_evidences'
      AND con.contype = 'f' AND att.attname = 'activity_id'
  LOOP
    EXECUTE format('ALTER TABLE monitor_evidences DROP CONSTRAINT %I', fk_name);
  END LOOP;
END $$;

ALTER TABLE monitor_evidences
  ADD CONSTRAINT fk_monitor_evidence_activity
  FOREIGN KEY (activity_id) REFERENCES monitor_week_activities(id) ON DELETE SET NULL;

-- ── 3. Borrado lógico de evidencias ──
-- "Eliminar" una evidencia desde la app ya no la borra: la marca. El rastro
-- del soporte de pago se conserva aunque alguien se equivoque de botón.
ALTER TABLE monitor_evidences ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_monitor_evidences_vivas
  ON monitor_evidences(work_plan_id) WHERE deleted_at IS NULL;
