-- ============================================================
-- NODOSYS · MIGRACIÓN NODOS Y USUARIOS
-- Archivo: migration-nodo-users.sql
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================
-- Este script hace tres cosas:
--   1. Asegura que la columna nodo_name exista en users
--   2. Crea un segundo nodo de ejemplo (para probar aislamiento)
--   3. Muestra diagnóstico de usuarios sin nodo asignado
-- Es IDEMPOTENTE: puede ejecutarse más de una vez.
-- ============================================================


-- ============================================================
-- PASO 1: Asegurar columnas nodo en users
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS nodo_id   UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nodo_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_users_nodo_id ON users(nodo_id);


-- ============================================================
-- PASO 2: Ver usuarios actuales y su asignación de nodo
-- ============================================================
-- Ejecuta esto para ver el estado actual ANTES de asignar nodos.

SELECT
  id,
  name,
  email,
  role,
  nodo_id,
  nodo_name,
  faculty,
  program,
  is_active
FROM users
ORDER BY role, name;


-- ============================================================
-- PASO 3: Actualizar usuarios al NODO ARBOLETES (existente)
-- ============================================================
-- Reemplaza los UUIDs y nombres de nodo según tu base de datos real.
-- Puedes ejecutar múltiples UPDATE para asignar diferentes nodos.

-- Ejemplo: asignar el enlace principal al nodo Arboletes
-- UPDATE users
--   SET nodo_id = 'UUID-DEL-NODO-ARBOLETES', nodo_name = 'Arboletes'
--   WHERE email = 'enlace.arboletes@iudigital.edu.co';

-- Ejemplo: crear enlace de un segundo nodo (Necoclí)
-- UPDATE users
--   SET nodo_id = 'UUID-DEL-NODO-NECOCLI', nodo_name = 'Necoclí'
--   WHERE email = 'enlace.necocli@iudigital.edu.co';


-- ============================================================
-- PASO 4: Crear un usuario docente-enlace de prueba
--         (segundo nodo, distinto a Arboletes)
-- ============================================================
-- Cambia los UUIDs y datos según lo que necesites.
-- El password_hash de '12345678' usando bcrypt (cost 10) es:
--   $2b$10$YourHashHere
-- Para generar el hash correcto, usa el endpoint POST /api/auth/register
-- o genera el hash en https://bcrypt-generator.com (rounds=10)

-- INSERT INTO users (
--   id, name, email, password_hash, role,
--   nodo_id, nodo_name, faculty, program, is_active, created_at, updated_at
-- ) VALUES (
--   uuid_generate_v4(),
--   'Juan Enlace Necoclí',
--   'juan.necocli@iudigital.edu.co',
--   '$2b$10$REEMPLAZA_ESTE_HASH',
--   'enlace',
--   uuid_generate_v4(),   -- ← genera un UUID para el nuevo nodo
--   'Necoclí',
--   'Facultad de Ingenierías',
--   'Ingeniería de Sistemas',
--   true,
--   NOW(),
--   NOW()
-- )
-- ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- PASO 5: Verificar resultado
-- ============================================================

SELECT
  role,
  COUNT(*)                                          AS total,
  COUNT(nodo_id)                                    AS con_nodo,
  COUNT(*) FILTER (WHERE nodo_id IS NULL)           AS sin_nodo
FROM users
GROUP BY role
ORDER BY role;

-- Usuarios sin nodo asignado (deben ser solo admins y vicerrectores)
SELECT id, name, email, role
FROM users
WHERE nodo_id IS NULL
  AND role NOT IN ('admin', 'vicerrector_extension', 'vicerrector_academico', 'equipo_extension')
ORDER BY role, name;
