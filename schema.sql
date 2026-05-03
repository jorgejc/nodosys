-- ============================================================
-- NODOSYS · Esquema de Base de Datos PostgreSQL 16
-- Sistema Integral de Gestión · Nodo Arboletes · IU Digital
-- Normalizado en Tercera Forma Normal (3FN)
-- ============================================================
-- Para ejecutar: psql -U postgres -d nodosys_dev -f schema.sql
-- ============================================================

-- Limpiar si ya existe (útil al reiniciar desarrollo)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Para generar UUIDs automáticamente
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- Para encriptar contraseñas

-- ============================================================
-- ENUMS (tipos de datos fijos, como listas)
-- ============================================================

-- Roles de usuario en el sistema
CREATE TYPE user_role AS ENUM (
  'enlace',       -- Coordinador del nodo (tú, Jorge)
  'monitor',      -- Estudiante de monitoría
  'auxiliar'      -- Auxiliar del nodo
);

-- Estado físico de los ítems de inventario
CREATE TYPE item_condition AS ENUM (
  'excelente',     -- Como nuevo
  'bueno',         -- Funciona perfectamente
  'regular',       -- Funciona con detalles menores
  'malo',          -- Funciona con dificultad o problemas
  'dado_de_baja'   -- Ya no funciona / se deshechó
);

-- Tipos de movimiento del inventario (trazabilidad)
CREATE TYPE movement_type AS ENUM (
  'entrada',       -- Llega un ítem nuevo al nodo
  'salida',        -- Sale del nodo (préstamo, traslado)
  'devolucion',    -- Regresa al nodo después de salir
  'baja',          -- Se da de baja definitivamente
  'actualizacion'  -- Cambio de estado o información
);

-- Categorías del plan de trabajo (definidas por IU Digital)
-- Las 5 grandes + las 3 subcategorías de Administración Académica
CREATE TYPE activity_category AS ENUM (
  'docencia_directa',               -- Clases, talleres, cursos directos
  'trabajos_de_grado',              -- Asesoría de proyectos de grado
  'investigacion',                  -- Proyectos de investigación
  'extension',                      -- Actividades con comunidad, alcaldes, etc.
  'gestion_de_programas',           -- Administración: gestión de programas
  'representacion_cuerpos_colegiados', -- Administración: cuerpos colegiados
  'otras_administrativas'           -- Administración: internacionalización, bienestar, etc.
);

-- Estado de un período / plan de trabajo
CREATE TYPE plan_status AS ENUM (
  'borrador',    -- En construcción
  'activo',      -- Período en curso
  'completado',  -- Período terminado
  'archivado'    -- Histórico
);

-- Estado de una sesión registrada
CREATE TYPE session_status AS ENUM (
  'realizada',   -- La sesión ocurrió como se planeó
  'cancelada',   -- Se canceló
  'reprogramada' -- Se movió a otra fecha
);

-- ============================================================
-- TABLA: nodos
-- Un nodo es la sede física (ej: Nodo Arboletes)
-- ============================================================
CREATE TABLE nodos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) NOT NULL,           -- "Nodo Arboletes"
  city        VARCHAR(100) NOT NULL,           -- "Arboletes"
  department  VARCHAR(100) DEFAULT 'Antioquia',
  address     VARCHAR(255),
  phone       VARCHAR(30),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: users
-- Usuarios del sistema (enlace, monitores, auxiliar)
-- ============================================================
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nodo_id      UUID NOT NULL REFERENCES nodos(id) ON DELETE RESTRICT,
  name         VARCHAR(150) NOT NULL,
  email        VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,          -- Contraseña encriptada con bcrypt
  role         user_role NOT NULL DEFAULT 'monitor',
  phone        VARCHAR(30),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_nodo ON users(nodo_id);

-- ============================================================
-- TABLA: inventory_categories
-- Categorías de inventario: Electrónica, Cómputo, Didáctico...
-- ============================================================
CREATE TABLE inventory_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nodo_id     UUID NOT NULL REFERENCES nodos(id) ON DELETE RESTRICT,
  name        VARCHAR(100) NOT NULL,       -- "Electrónica", "Cómputo"...
  description TEXT,
  icon        VARCHAR(10) DEFAULT '📦',    -- Emoji para la UI
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: inventory_items
-- Cada ítem físico del nodo (computador, silla, fuente, etc.)
-- ============================================================
CREATE TABLE inventory_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nodo_id          UUID NOT NULL REFERENCES nodos(id) ON DELETE RESTRICT,
  category_id      UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE RESTRICT,
  registered_by    UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Identificación del ítem
  name             VARCHAR(200) NOT NULL,      -- "Computador portátil HP"
  brand            VARCHAR(100),               -- "HP", "Lenovo", "Samsung"...
  model            VARCHAR(100),               -- "ProBook 440 G8"
  serial_number    VARCHAR(150),               -- Número de serie único
  internal_code    VARCHAR(100) UNIQUE,        -- Código interno del nodo

  -- Estado y cantidad
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition        item_condition NOT NULL DEFAULT 'bueno',
  location         VARCHAR(200) DEFAULT 'Nodo', -- Dónde está físicamente

  -- Información adicional
  acquisition_date DATE,                       -- Fecha en que llegó al nodo
  acquisition_value DECIMAL(12, 2),            -- Valor en pesos (opcional)
  qr_code          TEXT,                       -- Contenido del QR generado
  image_url        TEXT,                       -- Foto del ítem (Supabase Storage)
  notes            TEXT,                       -- Observaciones

  -- Auditoría
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ                 -- Soft delete: no borrar, solo marcar
);

CREATE INDEX idx_items_category ON inventory_items(category_id);
CREATE INDEX idx_items_nodo ON inventory_items(nodo_id);
CREATE INDEX idx_items_condition ON inventory_items(condition);
CREATE INDEX idx_items_deleted ON inventory_items(deleted_at);

-- ============================================================
-- TABLA: inventory_movements
-- Historial de cambios en el inventario (trazabilidad completa)
-- ============================================================
CREATE TABLE inventory_movements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id        UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  registered_by  UUID REFERENCES users(id) ON DELETE SET NULL,

  movement_type  movement_type NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  movement_date  DATE NOT NULL DEFAULT CURRENT_DATE,

  -- A quién / a dónde fue
  destination    VARCHAR(200),   -- Institución, persona, lugar
  responsible    VARCHAR(200),   -- Nombre de quien recibe
  expected_return DATE,          -- Si es préstamo, cuándo regresa

  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movements_item ON inventory_movements(item_id);
CREATE INDEX idx_movements_date ON inventory_movements(movement_date);

-- ============================================================
-- TABLA: work_plans
-- Plan de trabajo por período/semestre del enlace
-- ============================================================
CREATE TABLE work_plans (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  nodo_id      UUID NOT NULL REFERENCES nodos(id) ON DELETE RESTRICT,

  name         VARCHAR(200) NOT NULL,      -- "Plan de Trabajo 2026-1"
  semester     VARCHAR(20) NOT NULL,       -- "2026-1", "2026-2"
  total_hours  DECIMAL(8, 2) NOT NULL,     -- 900, 1000 (puede variar)
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       plan_status NOT NULL DEFAULT 'borrador',

  -- Objetivo general del período
  general_objective TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workplans_user ON work_plans(user_id);
CREATE INDEX idx_workplans_status ON work_plans(status);

-- ============================================================
-- TABLA: work_plan_activities
-- Actividades dentro de un plan de trabajo
-- Puede ser planeada desde el inicio o agregada después
-- ============================================================
CREATE TABLE work_plan_activities (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_plan_id   UUID NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,

  name           VARCHAR(250) NOT NULL,     -- "Capacitación Docente IA"
  category       activity_category NOT NULL, -- El tipo según IU Digital

  -- Horas asignadas en el plan original
  scheduled_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,

  -- Descripción y contexto
  description    TEXT,
  target_group   VARCHAR(200),  -- "Docentes de Arboletes", "Estudiantes 10-11 El Caníme"
  location       VARCHAR(200),  -- "Nodo Arboletes", "IER El Caníme"
  frequency      VARCHAR(100),  -- "Cada 8 días", "Una vez por semana"

  -- ¿Fue planeada desde el inicio o surgió después?
  is_planned     BOOLEAN NOT NULL DEFAULT TRUE,
  added_reason   TEXT,          -- Si is_planned=false, explicar por qué se agregó

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vista calculada: horas ejecutadas por actividad
-- Se calcula sumando las sesiones registradas
CREATE INDEX idx_activities_workplan ON work_plan_activities(work_plan_id);
CREATE INDEX idx_activities_category ON work_plan_activities(category);

-- ============================================================
-- TABLA: activity_sessions
-- Cada vez que realizas una sesión de una actividad,
-- la registras aquí. Aquí se acumulan las horas reales.
-- ============================================================
CREATE TABLE activity_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id     UUID NOT NULL REFERENCES work_plan_activities(id) ON DELETE CASCADE,
  registered_by   UUID REFERENCES users(id) ON DELETE SET NULL,

  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_hours  DECIMAL(5, 2) NOT NULL,   -- Cuántas horas duró esta sesión

  -- Detalles de la sesión
  title           VARCHAR(250),             -- "Sesión 1: Introducción a IA"
  location        VARCHAR(200),
  participants_count INTEGER DEFAULT 0,

  -- Descripción de lo que se hizo
  description     TEXT NOT NULL,            -- Obligatorio: qué se hizo en la sesión

  status          session_status NOT NULL DEFAULT 'realizada',

  -- Si se canceló o reprogramó, ¿por qué?
  status_reason   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_activity ON activity_sessions(activity_id);
CREATE INDEX idx_sessions_date ON activity_sessions(session_date);

-- ============================================================
-- TABLA: session_photos
-- Evidencias fotográficas de cada sesión
-- La foto se guarda en Supabase Storage, aquí guardamos la URL
-- ============================================================
CREATE TABLE session_photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
  uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,

  storage_url  TEXT NOT NULL,        -- URL en Supabase Storage
  file_name    VARCHAR(255),
  caption      VARCHAR(300),         -- Descripción de la foto
  file_size_kb INTEGER,

  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photos_session ON session_photos(session_id);

-- ============================================================
-- TABLA: reports
-- Historial de reportes generados (PDF)
-- ============================================================
CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  nodo_id       UUID NOT NULL REFERENCES nodos(id) ON DELETE RESTRICT,

  title         VARCHAR(300) NOT NULL,
  report_type   VARCHAR(50) NOT NULL,   -- 'inventory', 'activity', 'period_summary'
  parameters    JSONB,                  -- Filtros usados para generar el reporte
  file_url      TEXT,                  -- URL del PDF generado en Storage

  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_nodo ON reports(nodo_id);
CREATE INDEX idx_reports_type ON reports(report_type);

-- ============================================================
-- VISTA: v_activity_hours_summary
-- Cuántas horas tiene cada actividad vs cuántas se han ejecutado
-- Muy útil para el dashboard y los reportes
-- ============================================================
CREATE OR REPLACE VIEW v_activity_hours_summary AS
SELECT
  a.id                    AS activity_id,
  a.work_plan_id,
  a.name                  AS activity_name,
  a.category,
  a.scheduled_hours,
  a.is_planned,
  COALESCE(SUM(s.duration_hours), 0) AS executed_hours,
  a.scheduled_hours - COALESCE(SUM(s.duration_hours), 0) AS remaining_hours,
  COUNT(s.id)             AS sessions_count,
  CASE
    WHEN a.scheduled_hours = 0 THEN 0
    ELSE ROUND((COALESCE(SUM(s.duration_hours), 0) / a.scheduled_hours * 100)::numeric, 1)
  END                     AS completion_percentage
FROM work_plan_activities a
LEFT JOIN activity_sessions s ON s.activity_id = a.id AND s.status = 'realizada'
GROUP BY a.id, a.work_plan_id, a.name, a.category, a.scheduled_hours, a.is_planned;

-- ============================================================
-- VISTA: v_work_plan_summary
-- Resumen total del plan de trabajo por período
-- ============================================================
CREATE OR REPLACE VIEW v_work_plan_summary AS
SELECT
  wp.id                   AS work_plan_id,
  wp.name                 AS plan_name,
  wp.semester,
  wp.total_hours          AS total_scheduled_hours,
  COALESCE(SUM(ahs.executed_hours), 0)   AS total_executed_hours,
  wp.total_hours - COALESCE(SUM(ahs.executed_hours), 0) AS total_remaining_hours,
  CASE
    WHEN wp.total_hours = 0 THEN 0
    ELSE ROUND((COALESCE(SUM(ahs.executed_hours), 0) / wp.total_hours * 100)::numeric, 1)
  END                     AS overall_completion_percentage,
  COUNT(DISTINCT ahs.activity_id) AS total_activities
FROM work_plans wp
LEFT JOIN v_activity_hours_summary ahs ON ahs.work_plan_id = wp.id
GROUP BY wp.id, wp.name, wp.semester, wp.total_hours;

-- ============================================================
-- DATOS INICIALES (Seed)
-- Nodo y categorías base para empezar a trabajar
-- ============================================================

-- Nodo Arboletes
INSERT INTO nodos (id, name, city, department, address) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Nodo Arboletes', 'Arboletes', 'Antioquia', 'Nodo IU Digital Arboletes');

-- Categorías de inventario predefinidas
INSERT INTO inventory_categories (nodo_id, name, description, icon) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cómputo', 'Computadores, laptops, tablets, periféricos', '💻'),
  ('00000000-0000-0000-0000-000000000001', 'Electrónica', 'Fuentes, cables, multitomas, extensiones, pantallas', '🔌'),
  ('00000000-0000-0000-0000-000000000001', 'Material Didáctico', 'Juegos, herramientas pedagógicas, libros', '📚'),
  ('00000000-0000-0000-0000-000000000001', 'Física y Química', 'Implementos de laboratorio, materiales de ciencias', '🔬'),
  ('00000000-0000-0000-0000-000000000001', 'Robótica', 'Kits de robótica, Arduino, sensores, motores', '🤖'),
  ('00000000-0000-0000-0000-000000000001', 'Mobiliario', 'Mesas, sillas, estantes, escritorios', '🪑'),
  ('00000000-0000-0000-0000-000000000001', 'Infraestructura AV', 'Pantallas gigantes, proyectores, audio', '📺'),
  ('00000000-0000-0000-0000-000000000001', 'Otros', 'Ítems que no encajan en otras categorías', '📦');

-- ============================================================
-- TRIGGERS: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workplans_updated_at BEFORE UPDATE ON work_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON work_plan_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON activity_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================
SELECT 'NodoSys schema creado exitosamente 🚀' AS resultado;
