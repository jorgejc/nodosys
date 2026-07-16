-- Migración: campos de ubicación para inventory_items
-- Ejecutar en producción (dev usa synchronize=true, no requiere esto)

DO $$ BEGIN
  CREATE TYPE location_type_enum AS ENUM ('gabinete', 'mobiliario_suelto');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS location_type   location_type_enum NULL,
  ADD COLUMN IF NOT EXISTS cabinet_number  VARCHAR(100)       NULL,
  ADD COLUMN IF NOT EXISTS shelf_number    VARCHAR(100)       NULL,
  ADD COLUMN IF NOT EXISTS location_note   VARCHAR(300)       NULL;
