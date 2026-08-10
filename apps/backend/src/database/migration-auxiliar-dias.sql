-- ============================================================
-- Módulo: Equipo de Nodo · FASE B.2 — Un día = un bloque
-- Ejecutar en Supabase SQL Editor (production)
-- En desarrollo TypeORM synchronize:true crea las tablas; el BACKFILL
-- de esta migración hay que ejecutarlo igualmente.
--
-- Idempotente: re-ejecutable sin error ni duplicados.
-- Depende de: migration-auxiliar.sql (16)
--
-- QUÉ CAMBIA
--   Antes: "registro diario" y "participación en actividades" eran dos
--   cosas separadas, y cada una generaba una fila con su propia fecha.
--   Diez tareas del 1 de agosto se veían como diez veces "1 de agosto".
--
--   Ahora: el DÍA es un contenedor único por fecha y dentro cuelgan las
--   ACTIVIDADES. Una actividad enganchada a un proceso del enlace es solo
--   una actividad que además tiene activity_id/process_id: ya no hay dos
--   conceptos, hay uno.
--
-- QUÉ NO SE TOCA
--   Las tablas viejas (auxiliary_daily_logs, auxiliary_activity_
--   participations) se quedan intactas. Aquí se COPIA, no se mueve: si el
--   backfill saliera mal, el dato original sigue donde estaba. Borrarlas
--   es una migración posterior, cuando esto lleve tiempo funcionando.
-- ============================================================

-- ── 1. El día: contenedor único por fecha ─────────────────
-- `nodo_id` vive aquí y no en cada actividad: en una fecha la persona
-- estuvo en un nodo, así que el día es la unidad natural del aislamiento
-- histórico. Sigue sin reescribirse nunca.
CREATE TABLE IF NOT EXISTS auxiliary_days (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auxiliary_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nodo_id      UUID,
  log_date     DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La fecha NO se repite: es lo que sostiene "un día = un bloque"
CREATE UNIQUE INDEX IF NOT EXISTS uq_auxiliary_day
  ON auxiliary_days(auxiliary_id, log_date);

CREATE INDEX IF NOT EXISTS idx_auxiliary_days_nodo
  ON auxiliary_days(nodo_id, log_date);

-- ── 2. La actividad del día ───────────────────────────────
-- Unifica lo que antes eran dos tablas. `legacy_*_id` guarda de dónde
-- salió cada fila migrada: hace el backfill idempotente y deja rastro
-- para poder auditar la migración más adelante.
CREATE TABLE IF NOT EXISTS auxiliary_activities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id                   UUID NOT NULL REFERENCES auxiliary_days(id) ON DELETE CASCADE,
  description              TEXT NOT NULL,
  hours                    DECIMAL(4,1),
  activity_id              UUID REFERENCES activity_requests(id) ON DELETE SET NULL,
  process_id               UUID REFERENCES processes(id)         ON DELETE SET NULL,
  -- Solo para no perder el título propio de las participaciones sueltas
  title                    VARCHAR(300),
  legacy_daily_log_id      UUID,
  legacy_participation_id  UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aux_act_un_solo_origen') THEN
    ALTER TABLE auxiliary_activities
      ADD CONSTRAINT chk_aux_act_un_solo_origen
      CHECK (activity_id IS NULL OR process_id IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aux_activities_day
  ON auxiliary_activities(day_id);

-- Índices únicos parciales: hacen el backfill re-ejecutable sin duplicar
CREATE UNIQUE INDEX IF NOT EXISTS uq_aux_act_legacy_log
  ON auxiliary_activities(legacy_daily_log_id) WHERE legacy_daily_log_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_aux_act_legacy_part
  ON auxiliary_activities(legacy_participation_id) WHERE legacy_participation_id IS NOT NULL;

-- ── 3. Funciones de la actividad (N a N) ──────────────────
-- Antes una fila tenía UNA función; ahora una actividad puede responder a
-- varias de las 10 a la vez, que es como se trabaja de verdad.
CREATE TABLE IF NOT EXISTS auxiliary_activity_functions (
  activity_id UUID NOT NULL REFERENCES auxiliary_activities(id) ON DELETE CASCADE,
  function_id UUID NOT NULL REFERENCES auxiliary_functions(id),
  PRIMARY KEY (activity_id, function_id)
);

CREATE INDEX IF NOT EXISTS idx_aux_act_func_funcion
  ON auxiliary_activity_functions(function_id);

-- ── 4. Tipos de participación de la actividad (N a N) ─────
CREATE TABLE IF NOT EXISTS auxiliary_activity_types (
  activity_id UUID NOT NULL REFERENCES auxiliary_activities(id) ON DELETE CASCADE,
  type_id     UUID NOT NULL REFERENCES participation_types(id),
  PRIMARY KEY (activity_id, type_id)
);

CREATE INDEX IF NOT EXISTS idx_aux_act_types_tipo
  ON auxiliary_activity_types(type_id);

-- ── 5. Evidencias: ahora cuelgan de la actividad ──────────
-- SET NULL y borrado lógico, igual que antes: la evidencia respalda el
-- reporte mensual y no puede desaparecer en silencio.
ALTER TABLE auxiliary_evidences
  ADD COLUMN IF NOT EXISTS activity_id UUID;

DO $$
DECLARE fk_name text;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'auxiliary_evidences'
      AND con.contype = 'f' AND att.attname = 'activity_id'
  LOOP
    EXECUTE format('ALTER TABLE auxiliary_evidences DROP CONSTRAINT %I', fk_name);
  END LOOP;
END $$;

ALTER TABLE auxiliary_evidences
  ADD CONSTRAINT fk_aux_evidencia_actividad
  FOREIGN KEY (activity_id) REFERENCES auxiliary_activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aux_evidencias_actividad
  ON auxiliary_evidences(activity_id) WHERE deleted_at IS NULL;

-- ============================================================
-- BACKFILL · copia el modelo viejo al nuevo, sin perder nada
-- Todo con WHERE NOT EXISTS / ON CONFLICT: re-ejecutable.
-- ============================================================

-- ── 6a. Un día por cada fecha con registros diarios ───────
INSERT INTO auxiliary_days (auxiliary_id, nodo_id, log_date)
SELECT DISTINCT ON (l.auxiliary_id, l.log_date)
       l.auxiliary_id, l.nodo_id, l.log_date
FROM auxiliary_daily_logs l
ORDER BY l.auxiliary_id, l.log_date, l.created_at
ON CONFLICT (auxiliary_id, log_date) DO NOTHING;

-- ── 6b. …y por cada fecha con participaciones ─────────────
-- Puede coincidir con una ya creada arriba: el ON CONFLICT la respeta y
-- conserva el nodo del registro diario, que es el primero que hubo.
INSERT INTO auxiliary_days (auxiliary_id, nodo_id, log_date)
SELECT DISTINCT ON (p.auxiliary_id, p.event_date)
       p.auxiliary_id, p.nodo_id, p.event_date
FROM auxiliary_activity_participations p
ORDER BY p.auxiliary_id, p.event_date, p.created_at
ON CONFLICT (auxiliary_id, log_date) DO NOTHING;

-- ── 7a. Cada registro diario pasa a ser una actividad ─────
INSERT INTO auxiliary_activities (day_id, description, hours, legacy_daily_log_id, created_at)
SELECT d.id, l.description, l.hours, l.id, l.created_at
FROM auxiliary_daily_logs l
JOIN auxiliary_days d
  ON d.auxiliary_id = l.auxiliary_id AND d.log_date = l.log_date
WHERE NOT EXISTS (
  SELECT 1 FROM auxiliary_activities a WHERE a.legacy_daily_log_id = l.id
);

-- Su función (era una sola) entra en el N a N
INSERT INTO auxiliary_activity_functions (activity_id, function_id)
SELECT a.id, l.function_id
FROM auxiliary_activities a
JOIN auxiliary_daily_logs l ON l.id = a.legacy_daily_log_id
ON CONFLICT DO NOTHING;

-- ── 7b. Cada participación pasa a ser una actividad ───────
-- La descripción es lo que identifica la actividad; si la participación
-- no tenía y sí título, se usa el título para no dejarla en blanco.
INSERT INTO auxiliary_activities (
  day_id, description, activity_id, process_id, title, legacy_participation_id, created_at
)
SELECT d.id,
       COALESCE(NULLIF(btrim(p.description), ''), p.title, 'Actividad sin descripción'),
       p.activity_id, p.process_id, p.title, p.id, p.created_at
FROM auxiliary_activity_participations p
JOIN auxiliary_days d
  ON d.auxiliary_id = p.auxiliary_id AND d.log_date = p.event_date
WHERE NOT EXISTS (
  SELECT 1 FROM auxiliary_activities a WHERE a.legacy_participation_id = p.id
);

-- Sus tipos de participación
INSERT INTO auxiliary_activity_types (activity_id, type_id)
SELECT a.id, t.type_id
FROM auxiliary_activities a
JOIN auxiliary_participation_types t ON t.participation_id = a.legacy_participation_id
ON CONFLICT DO NOTHING;

-- ── 8. Las evidencias se reapuntan a su actividad ─────────
-- Las que colgaban de un registro diario…
UPDATE auxiliary_evidences e
SET activity_id = a.id
FROM auxiliary_activities a
WHERE e.activity_id IS NULL
  AND e.daily_log_id IS NOT NULL
  AND a.legacy_daily_log_id = e.daily_log_id;

-- …y las que colgaban de una participación
UPDATE auxiliary_evidences e
SET activity_id = a.id
FROM auxiliary_activities a
WHERE e.activity_id IS NULL
  AND e.participation_id IS NOT NULL
  AND a.legacy_participation_id = e.participation_id;

-- ── 9. Comprobación: nada se quedó por el camino ──────────
-- Falla ruidosamente si el backfill no cubrió todo, en vez de dejar el
-- sistema a medias en silencio.
DO $$
DECLARE
  logs_pendientes  int;
  parts_pendientes int;
  evid_pendientes  int;
BEGIN
  SELECT count(*) INTO logs_pendientes
  FROM auxiliary_daily_logs l
  WHERE NOT EXISTS (SELECT 1 FROM auxiliary_activities a WHERE a.legacy_daily_log_id = l.id);

  SELECT count(*) INTO parts_pendientes
  FROM auxiliary_activity_participations p
  WHERE NOT EXISTS (SELECT 1 FROM auxiliary_activities a WHERE a.legacy_participation_id = p.id);

  SELECT count(*) INTO evid_pendientes
  FROM auxiliary_evidences e
  WHERE e.activity_id IS NULL
    AND (e.daily_log_id IS NOT NULL OR e.participation_id IS NOT NULL);

  IF logs_pendientes > 0 OR parts_pendientes > 0 OR evid_pendientes > 0 THEN
    RAISE EXCEPTION
      'Backfill incompleto: % registros diarios, % participaciones y % evidencias sin migrar',
      logs_pendientes, parts_pendientes, evid_pendientes;
  END IF;

  RAISE NOTICE 'Backfill del auxiliar completo: todo migrado a días y actividades.';
END $$;
