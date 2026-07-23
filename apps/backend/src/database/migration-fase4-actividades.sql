-- ============================================================
-- Migración: FASE 4 — Rediseño de Actividades
-- Rama: feature/actividades
-- Ejecutar en producción (desarrollo: TypeORM synchronize aplica automáticamente)
-- ============================================================

-- ── 1. session_id en activity_requests ───────────────────────────────
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES course_sessions(id) ON DELETE SET NULL;

-- ── 2. strategy_id (heredada del proceso o elegida si suelta) ────────
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL;

-- ── 3. municipality_id ────────────────────────────────────────────────
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id) ON DELETE SET NULL;

-- ── 4. resource_detail (detalle textual de la necesidad) ─────────────
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS resource_detail TEXT;

-- ── 5. payment_type enum ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_type_enum AS ENUM ('anticipado', 'reembolso');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS payment_type payment_type_enum;

-- ── 6. has_electronic_invoice_provider ───────────────────────────────
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS has_electronic_invoice_provider BOOLEAN NOT NULL DEFAULT false;

-- ── NOTA: expected_participants ya existe como columna. ───────────────
-- Se reutiliza para "participantes estimados" (no se crea columna nueva).
