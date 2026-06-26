-- ============================================================
-- Módulo 6: Bitácoras de Sesiones
-- Ejecutar en Supabase SQL Editor (production)
-- En desarrollo TypeORM synchronize:true lo crea automáticamente
-- ============================================================

-- Enum para tipos de momento pedagógico
DO $$ BEGIN
  CREATE TYPE session_moments_moment_type_enum AS ENUM ('explorar', 'crear', 'consolidar');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Sesiones de una actividad ────────────────────────────
CREATE TABLE IF NOT EXISTS course_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID NOT NULL REFERENCES activity_requests(id) ON DELETE CASCADE,
  session_number  INTEGER NOT NULL DEFAULT 1,
  date            DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  topic           VARCHAR(300),
  location        VARCHAR(300),
  total_registered INTEGER NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_sessions_activity ON course_sessions(activity_id);

-- ── 3 momentos pedagógicos por sesión ───────────────────
CREATE TABLE IF NOT EXISTS session_moments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
  moment_type       session_moments_moment_type_enum NOT NULL,
  objective         TEXT,
  methodology       TEXT,
  materials         TEXT,
  duration_minutes  INTEGER,
  UNIQUE (session_id, moment_type)
);

CREATE INDEX IF NOT EXISTS idx_session_moments_session ON session_moments(session_id);

-- ── Lista de asistentes por sesión ───────────────────────
CREATE TABLE IF NOT EXISTS session_attendees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
  full_name        VARCHAR(200) NOT NULL,
  document_number  VARCHAR(50),
  attended         BOOLEAN NOT NULL DEFAULT true,
  absences_count   INTEGER NOT NULL DEFAULT 0,
  certifiable      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_session_attendees_session ON session_attendees(session_id);
