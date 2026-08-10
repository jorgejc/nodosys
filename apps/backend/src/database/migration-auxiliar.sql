-- ============================================================
-- Módulo: Equipo de Nodo · FASE B — Registro de actividad del AUXILIAR
-- Ejecutar en Supabase SQL Editor (production)
-- En desarrollo TypeORM synchronize:true lo crea automáticamente
--
-- Idempotente: re-ejecutable sin error ni duplicados.
-- Depende de: users (schema.sql), activity_requests (9), processes (9)
--
-- Qué registra el auxiliar de nodo:
--   · un registro DIARIO (qué función desempeñó ese día y qué hizo)
--   · PARTICIPACIONES en actividades, enganchadas a una actividad o
--     proceso del nodo, o sueltas con título propio
-- De ahí sale el reporte mensual de actividades.
--
-- El módulo registra hechos con datos objetivos: fecha, función,
-- descripción, evidencia. No clasifica ni califica el desempeño.
-- ============================================================

-- ── 1. Catálogo: funciones oficiales del auxiliar ─────────
-- Las 10 definidas por la Vicerrectoría de Extensión. Tabla y no enum
-- ni texto libre, por la misma razón que el resto de catálogos: el texto
-- libre produce variantes del mismo valor y hace imposible agrupar.
CREATE TABLE IF NOT EXISTS auxiliary_functions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(300) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_auxiliary_functions_name
  ON auxiliary_functions(name);

-- Seed: solo si la tabla está vacía, para no duplicar al re-ejecutar
-- ni pisar cambios de redacción hechos desde la aplicación.
INSERT INTO auxiliary_functions (name, display_order)
SELECT v.name, v.ord FROM (VALUES
  ('Atención y acompañamiento',                                        1),
  ('Gestión administrativa y documental',                              2),
  ('Herramientas ofimáticas y documentales',                           3),
  ('Planeación, organización y ejecución logística de actividades',    4),
  ('Acompañamiento de procesos formativos',                            5),
  ('Realización de procesos de convocatorias',                         6),
  ('Relacionamiento y articulación con instituciones',                 7),
  ('Funcionamiento operativo de los espacios del nodo',                8),
  ('Recolección de información de actividades',                        9),
  ('Desempeñar actividades que le sean asignadas',                    10)
) AS v(name, ord)
WHERE NOT EXISTS (SELECT 1 FROM auxiliary_functions);

-- ── 2. Catálogo: tipos de participación ───────────────────
-- En qué consistió el aporte del auxiliar en una actividad. Un mismo
-- evento admite varios (de ahí la N a N más abajo).
CREATE TABLE IF NOT EXISTS participation_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(300) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_participation_types_name
  ON participation_types(name);

INSERT INTO participation_types (name, display_order)
SELECT v.name, v.ord FROM (VALUES
  ('Registro de asistencia / firmas de participantes',        1),
  ('Apoyo logístico (montaje, convocatoria, espacio)',        2),
  ('Apoyo pedagógico (acompañamiento al docente en la temática)', 3),
  ('Creación de contenido o material',                        4),
  ('Registro fotográfico / evidencias',                       5),
  ('Relacionamiento institucional',                           6),
  ('Gestión documental o administrativa',                     7),
  ('Otro',                                                    8)
) AS v(name, ord)
WHERE NOT EXISTS (SELECT 1 FROM participation_types);

-- ── 3. Registro diario ────────────────────────────────────
-- `nodo_id` se copia del perfil del auxiliar al escribir y jamás llega
-- del body: es la llave del aislamiento entre nodos.
CREATE TABLE IF NOT EXISTS auxiliary_daily_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auxiliary_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nodo_id      UUID,
  log_date     DATE NOT NULL,
  function_id  UUID NOT NULL REFERENCES auxiliary_functions(id),
  description  TEXT NOT NULL,
  hours        DECIMAL(4,1),          -- opcional: no todo se mide en horas
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un registro por día y función: evita que un doble clic siembre dos
-- filas idénticas y descuadre el conteo de "días con registro" del
-- reporte mensual. Varias funciones distintas el mismo día sí se pueden.
CREATE UNIQUE INDEX IF NOT EXISTS uq_auxiliary_daily_log
  ON auxiliary_daily_logs(auxiliary_id, log_date, function_id);

CREATE INDEX IF NOT EXISTS idx_auxiliary_logs_nodo
  ON auxiliary_daily_logs(nodo_id, log_date);
CREATE INDEX IF NOT EXISTS idx_auxiliary_logs_persona
  ON auxiliary_daily_logs(auxiliary_id, log_date);

-- ── 4. Participación en actividades ───────────────────────
-- ENGANCHADA: cuelga de una actividad (activity_requests) o de un
--             proceso (processes) del nodo.
-- SUELTA:     ninguna de las dos, y entonces el título es obligatorio.
CREATE TABLE IF NOT EXISTS auxiliary_activity_participations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auxiliary_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nodo_id      UUID,
  activity_id  UUID REFERENCES activity_requests(id) ON DELETE SET NULL,
  process_id   UUID REFERENCES processes(id)         ON DELETE SET NULL,
  event_date   DATE NOT NULL,
  title        VARCHAR(300),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Los invariantes viven en la base, no solo en el DTO: un INSERT directo
-- no puede crear filas que la interfaz no sepa representar.
DO $$
BEGIN
  -- No puede estar enganchada a una actividad Y a un proceso a la vez
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_aux_part_un_solo_origen'
  ) THEN
    ALTER TABLE auxiliary_activity_participations
      ADD CONSTRAINT chk_aux_part_un_solo_origen
      CHECK (activity_id IS NULL OR process_id IS NULL);
  END IF;

  -- Si es suelta (sin actividad ni proceso), necesita título propio
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_aux_part_suelta_con_titulo'
  ) THEN
    ALTER TABLE auxiliary_activity_participations
      ADD CONSTRAINT chk_aux_part_suelta_con_titulo
      CHECK (
        activity_id IS NOT NULL
        OR process_id IS NOT NULL
        OR (title IS NOT NULL AND btrim(title) <> '')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aux_part_nodo
  ON auxiliary_activity_participations(nodo_id, event_date);
CREATE INDEX IF NOT EXISTS idx_aux_part_persona
  ON auxiliary_activity_participations(auxiliary_id, event_date);

-- ── 5. Tipos de participación por evento (N a N) ──────────
-- Tabla de enlace pura: CASCADE aquí sí es correcto, porque la fila no
-- guarda información propia — solo une dos filas que sí la guardan.
CREATE TABLE IF NOT EXISTS auxiliary_participation_types (
  participation_id UUID NOT NULL
    REFERENCES auxiliary_activity_participations(id) ON DELETE CASCADE,
  type_id          UUID NOT NULL
    REFERENCES participation_types(id),
  PRIMARY KEY (participation_id, type_id)
);

CREATE INDEX IF NOT EXISTS idx_aux_part_types_tipo
  ON auxiliary_participation_types(type_id);

-- ── 6. Evidencias ─────────────────────────────────────────
-- Cuelgan de un registro diario O de una participación, nunca de ambos.
--
-- SET NULL y borrado lógico, igual que en monitorías: la evidencia es el
-- soporte documental del reporte mensual. Borrar el registro del que
-- cuelga no puede destruirla en silencio; queda suelta y recuperable.
CREATE TABLE IF NOT EXISTS auxiliary_evidences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id     UUID REFERENCES auxiliary_daily_logs(id)              ON DELETE SET NULL,
  participation_id UUID REFERENCES auxiliary_activity_participations(id) ON DELETE SET NULL,
  file_url         VARCHAR(1000) NOT NULL,
  caption          VARCHAR(300),
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

DO $$
BEGIN
  -- Como máximo un padre. Puede quedarse sin ninguno si se borró aquel
  -- del que colgaba: la evidencia sobrevive, huérfana pero conservada.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_aux_evidencia_un_padre'
  ) THEN
    ALTER TABLE auxiliary_evidences
      ADD CONSTRAINT chk_aux_evidencia_un_padre
      CHECK (daily_log_id IS NULL OR participation_id IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aux_evidencias_log
  ON auxiliary_evidences(daily_log_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aux_evidencias_part
  ON auxiliary_evidences(participation_id) WHERE deleted_at IS NULL;
