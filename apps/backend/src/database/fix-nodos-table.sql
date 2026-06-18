-- ============================================================
-- FIX: Tabla nodos tiene filas con name = NULL
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Ver qué hay en la tabla ahora
SELECT * FROM nodos;

-- 2. Eliminar filas sin nombre (las que quedaron con NULL)
DELETE FROM nodos WHERE name IS NULL;

-- 3. Forzar la columna name como NOT NULL
ALTER TABLE nodos ALTER COLUMN name SET NOT NULL;

-- 4. Agregar restricción UNIQUE si no existe
DO $$ BEGIN
  ALTER TABLE nodos ADD CONSTRAINT nodos_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN others           THEN NULL;
END $$;

-- 5. Insertar los nodos reales (si aún no están)
INSERT INTO nodos (name) VALUES
  ('Arboletes'),
  ('Apartadó'),
  ('Yolombó'),
  ('Cáceres'),
  ('Itagüi'),
  ('Guarne'),
  ('Dabeiba')
ON CONFLICT (name) DO NOTHING;

-- 6. Verificar resultado
SELECT id, name, active FROM nodos ORDER BY name;
