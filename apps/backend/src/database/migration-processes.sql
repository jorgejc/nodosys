-- ============================================================
-- Migración: Procesos
-- Ejecutar en Supabase SQL Editor (producción)
-- Desarrollo: TypeORM synchronize lo crea automáticamente
-- ============================================================

-- Enums (protegidos contra duplicados)
DO $$ BEGIN
  CREATE TYPE processes_type_enum AS ENUM ('curso', 'club', 'taller', 'proceso');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE processes_status_enum AS ENUM ('activo', 'finalizado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabla principal
CREATE TABLE IF NOT EXISTS processes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(300) NOT NULL,
  description      TEXT,
  type             processes_type_enum  NOT NULL DEFAULT 'proceso',
  status           processes_status_enum NOT NULL DEFAULT 'activo',
  nodo_id          UUID REFERENCES nodos(id) ON DELETE SET NULL,
  work_plan_task_id UUID REFERENCES axis_activities(id) ON DELETE SET NULL,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK opcional en course_sessions (nullable, no rompe datos existentes)
ALTER TABLE course_sessions
  ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id) ON DELETE SET NULL;

-- FK opcional en activity_requests (nullable, no rompe datos existentes)
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id) ON DELETE SET NULL;
