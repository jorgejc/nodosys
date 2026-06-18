-- ============================================================
-- NODOSYS · Migración: Tabla de Nodos
-- Ejecutar en: Supabase → SQL Editor
-- Este script es IDEMPOTENTE (puede ejecutarse más de una vez)
-- ============================================================

-- ── PASO 1: Crear la tabla nodos ─────────────────────────────

CREATE TABLE IF NOT EXISTS nodos (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(200) NOT NULL UNIQUE,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── PASO 2: Insertar los nodos ────────────────────────────────
-- Para Arboletes reutilizamos el UUID que ya existe en users.nodo_id
-- (si hay algún usuario con ese nodo). Para los demás, generamos UUID nuevo.

DO $$
DECLARE
  arboletes_id UUID;
BEGIN
  -- ¿Ya existe algún usuario con nodo Arboletes?
  SELECT DISTINCT nodo_id INTO arboletes_id
  FROM users
  WHERE nodo_name ILIKE 'Arboletes' AND nodo_id IS NOT NULL
  LIMIT 1;

  IF arboletes_id IS NOT NULL THEN
    INSERT INTO nodos (id, name) VALUES (arboletes_id, 'Arboletes')
    ON CONFLICT (name) DO UPDATE SET id = EXCLUDED.id;
  ELSE
    INSERT INTO nodos (name) VALUES ('Arboletes')
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- Resto de nodos (agrega o ignora si ya existen)
INSERT INTO nodos (name) VALUES
  ('Apartadó'),
  ('Yolombó'),
  ('Cáceres'),
  ('Itagüi'),
  ('Guarne'),
  ('Dabeiba')
ON CONFLICT (name) DO NOTHING;

-- ── PASO 3: Sincronizar users.nodo_id con la tabla nodos ─────
-- Asigna el UUID correcto de la tabla nodos a los usuarios
-- que ya tienen nodo_name pero su nodo_id puede ser incorrecto.

UPDATE users u
SET
  nodo_id   = n.id,
  nodo_name = n.name
FROM nodos n
WHERE u.nodo_name ILIKE n.name
  AND u.nodo_id IS DISTINCT FROM n.id;

-- ── PASO 4: Sincronizar inventory_items.nodo_id ──────────────
-- Si los ítems de inventario de Arboletes tienen nodo_id NULL,
-- los asigna al UUID correcto de Arboletes en la tabla nodos.
-- AJUSTA el nombre si es diferente.

UPDATE inventory_items
SET nodo_id = (SELECT id FROM nodos WHERE name = 'Arboletes')
WHERE nodo_id IS NULL;

-- ── VERIFICACIÓN FINAL ────────────────────────────────────────
SELECT id, name, active FROM nodos ORDER BY name;

SELECT
  u.name        AS usuario,
  u.role,
  u.nodo_name,
  u.nodo_id,
  n.name        AS nodo_en_tabla
FROM users u
LEFT JOIN nodos n ON n.id = u.nodo_id
WHERE u.role IN ('enlace', 'monitor', 'auxiliar')
ORDER BY u.name;
