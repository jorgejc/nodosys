-- ============================================================
-- MIGRACIÓN CONSOLIDADA PARA PRODUCCIÓN (Supabase)
-- Cubre: procesos, sesiones, catálogos, tipos de proceso,
--        fase 4 actividades, ubicación de inventario.
-- ============================================================
--
-- TABLAS QUE YA EXISTEN EN PRODUCCIÓN (no se recrean):
--   users, nodos, activity_requests, axis_activities,
--   inventory_items, inventory_categories, inventory_units, work_plans
--
-- TABLAS QUE CREA ESTE SCRIPT:
--   faculties, programs, municipalities, strategies,
--   mission_axes, processes, course_sessions,
--   session_moments, session_attendees, session_evidences
--
-- ORDEN INTERNO (por dependencia):
--   P1 → Enums
--   P2 → Catálogos (faculties → programs, municipalities, strategies)
--   P3 → mission_axes (self-ref)
--   P4 → processes (FK → strategies, mission_axes, nodos, axis_activities, users)
--   P5 → course_sessions (FK → activity_requests, users, processes)
--   P6 → session_moments / session_attendees / session_evidences
--   P7 → ALTER sobre tablas existentes (activity_requests, inventory_items)
--   P8 → Seeds (catálogos + ejes misionales)
--
-- IDEMPOTENCIA:
--   · Enums:   DO $$ BEGIN ... EXCEPTION WHEN duplicate_object
--   · Tablas:  CREATE TABLE IF NOT EXISTS
--   · Índices: CREATE INDEX IF NOT EXISTS
--   · Columnas: ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   · Seeds:   INSERT ... WHERE NOT EXISTS / COUNT() = 0
-- ============================================================


-- ============================================================
-- P1 · ENUMS
-- ============================================================

-- Sesiones: tipo de momento pedagógico
DO $$ BEGIN
  CREATE TYPE session_moments_moment_type_enum AS ENUM ('explorar', 'crear', 'consolidar');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Procesos: tipo y estado
DO $$ BEGIN
  CREATE TYPE processes_type_enum AS ENUM ('curso', 'club', 'taller', 'proceso');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE processes_status_enum AS ENUM ('activo', 'finalizado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Procesos: plantilla de sesión (tipos-proceso)
DO $$ BEGIN
  CREATE TYPE session_template_enum AS ENUM (
    'tres_momentos',
    'descripcion_libre',
    'investigacion'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Actividades: tipo de pago (fase4)
DO $$ BEGIN
  CREATE TYPE payment_type_enum AS ENUM ('anticipado', 'reembolso');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Inventario: tipo de ubicación
DO $$ BEGIN
  CREATE TYPE location_type_enum AS ENUM ('gabinete', 'mobiliario_suelto');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- P2 · CATÁLOGOS MAESTROS
-- ============================================================
-- Deben existir antes de processes (strategy_id) y
-- activity_requests (strategy_id, municipality_id).

CREATE TABLE IF NOT EXISTS faculties (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  VARCHAR(200) NOT NULL,
  email VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS programs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(200) NOT NULL,
  faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS municipalities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(200) NOT NULL,
  department VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS strategies (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL
);


-- ============================================================
-- P3 · EJES MISIONALES
-- ============================================================
-- Self-referential (parent_id → mission_axes.id).
-- Debe existir antes de processes (mission_axis_id).

CREATE TABLE IF NOT EXISTS mission_axes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(300) NOT NULL,
  parent_id  UUID REFERENCES mission_axes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- P4 · PROCESSES
-- ============================================================
-- Consolida migration-processes.sql + columnas de tipos-proceso.
-- Requiere: nodos, axis_activities, users (ya existen),
--           strategies y mission_axes (creados en P2/P3).
-- NO referencia course_sessions → no hay dependencia circular.

CREATE TABLE IF NOT EXISTS processes (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(300) NOT NULL,
  description       TEXT,
  type              processes_type_enum   NOT NULL DEFAULT 'proceso',
  status            processes_status_enum NOT NULL DEFAULT 'activo',
  nodo_id           UUID REFERENCES nodos(id)           ON DELETE SET NULL,
  work_plan_task_id UUID REFERENCES axis_activities(id) ON DELETE SET NULL,
  strategy_id       UUID REFERENCES strategies(id)      ON DELETE SET NULL,
  mission_axis_id   UUID REFERENCES mission_axes(id)    ON DELETE SET NULL,
  session_template  session_template_enum NOT NULL DEFAULT 'tres_momentos',
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- P5 · COURSE_SESSIONS
-- ============================================================
-- Consolida migration-sessions.sql + columnas de tipos-proceso.
-- Requiere: activity_requests, users (ya existen),
--           processes (creado en P4).
--
-- DIFERENCIAS respecto al script original:
--   · activity_id ya se crea NULLABLE (el original la hacía NOT NULL y
--     luego la alteraba; aquí lo hacemos directo para evitar el ALTER).
--   · process_id, experience y columnas de investigación se incluyen
--     directamente en la definición en vez de agregarse con ALTER.

CREATE TABLE IF NOT EXISTS course_sessions (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable: sesiones pueden pertenecer a un proceso sin actividad
  activity_id           UUID REFERENCES activity_requests(id) ON DELETE CASCADE,
  process_id            UUID REFERENCES processes(id)         ON DELETE SET NULL,
  session_number        INTEGER     NOT NULL DEFAULT 1,
  date                  DATE        NOT NULL,
  start_time            TIME,
  end_time              TIME,
  topic                 VARCHAR(300),
  location              VARCHAR(300),
  total_registered      INTEGER     NOT NULL DEFAULT 0,
  experience            TEXT,
  -- Columnas para plantilla "investigacion" (tipos-proceso)
  tema_tecnico          VARCHAR(500),
  herramienta_simulador VARCHAR(300),
  desarrollo            TEXT,
  resultados            TEXT,
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_sessions_activity ON course_sessions(activity_id);
CREATE INDEX IF NOT EXISTS idx_course_sessions_process  ON course_sessions(process_id);


-- ============================================================
-- P6 · HIJOS DE COURSE_SESSIONS
-- ============================================================

-- Tres momentos pedagógicos por sesión
CREATE TABLE IF NOT EXISTS session_moments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
  moment_type      session_moments_moment_type_enum NOT NULL,
  objective        TEXT,
  methodology      TEXT,
  materials        TEXT,
  duration_minutes INTEGER,
  UNIQUE (session_id, moment_type)
);

CREATE INDEX IF NOT EXISTS idx_session_moments_session ON session_moments(session_id);

-- Lista de asistentes
CREATE TABLE IF NOT EXISTS session_attendees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
  full_name       VARCHAR(200) NOT NULL,
  document_number VARCHAR(50),
  attended        BOOLEAN NOT NULL DEFAULT true,
  absences_count  INTEGER NOT NULL DEFAULT 0,
  certifiable     BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_session_attendees_session ON session_attendees(session_id);

-- Evidencias (URL + caption)
CREATE TABLE IF NOT EXISTS session_evidences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
  file_url    VARCHAR(1000) NOT NULL,
  caption     VARCHAR(300),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_evidences_session ON session_evidences(session_id);


-- ============================================================
-- P7 · ALTER SOBRE TABLAS EXISTENTES EN PRODUCCIÓN
-- ============================================================

-- ── activity_requests ────────────────────────────────────────
-- process_id (migration-processes.sql)
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id) ON DELETE SET NULL;

-- session_id, strategy_id, municipality_id, resource_detail,
-- payment_type, has_electronic_invoice_provider (migration-fase4-actividades.sql)
ALTER TABLE activity_requests
  ADD COLUMN IF NOT EXISTS session_id      UUID REFERENCES course_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS strategy_id     UUID REFERENCES strategies(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resource_detail TEXT,
  ADD COLUMN IF NOT EXISTS payment_type    payment_type_enum,
  ADD COLUMN IF NOT EXISTS has_electronic_invoice_provider BOOLEAN NOT NULL DEFAULT false;

-- ── inventory_items ──────────────────────────────────────────
-- Ubicación de ítems (migration-inventario-ubicacion.sql)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS location_type   location_type_enum NULL,
  ADD COLUMN IF NOT EXISTS cabinet_number  VARCHAR(100)       NULL,
  ADD COLUMN IF NOT EXISTS shelf_number    VARCHAR(100)       NULL,
  ADD COLUMN IF NOT EXISTS location_note   VARCHAR(300)       NULL;


-- ============================================================
-- P8 · SEEDS DE CATÁLOGOS
-- ============================================================
-- Todos idempotentes: solo insertan si la tabla está vacía.

-- ── Facultades y programas ───────────────────────────────────
DO $$
DECLARE
  fac_id UUID;
BEGIN
  IF (SELECT COUNT(*) FROM faculties) = 0 THEN

    INSERT INTO faculties (name, email)
      VALUES ('Facultad de Educación', 'decanaturaeducacion@iudigital.edu.co')
      RETURNING id INTO fac_id;
    INSERT INTO programs (name, faculty_id) VALUES
      ('Licenciatura en Educación Básica Primaria', fac_id);

    INSERT INTO faculties (name, email)
      VALUES ('Facultad de Ciencias y Humanidades', 'decanaturacienciasyhumanidades@iudigital.edu.co')
      RETURNING id INTO fac_id;
    INSERT INTO programs (name, faculty_id) VALUES
      ('Comunicación y Periodismo Digital',  fac_id),
      ('Derecho',                            fac_id),
      ('Publicidad y Mercadeo Digital',      fac_id),
      ('Profesional en Ciencias Ambientales',fac_id),
      ('Profesional en Trabajo Social',      fac_id);

    INSERT INTO faculties (name, email)
      VALUES ('Facultad de Ciencias Económicas, Administrativas y Contables', 'decanaturaadministracion@iudigital.edu.co')
      RETURNING id INTO fac_id;
    INSERT INTO programs (name, faculty_id) VALUES
      ('Administración de Empresas',                              fac_id),
      ('Administración de Empresas Turísticas y Hoteleras',      fac_id),
      ('Administración de Seguridad y Salud en el Trabajo',      fac_id),
      ('Tecnología en Gestión Comercial Agroempresarial',        fac_id),
      ('Tecnología en Gestión Logística Portuaria y del Transporte', fac_id),
      ('Tecnología en Gestión Administrativa',                   fac_id);

    INSERT INTO faculties (name, email)
      VALUES ('Facultad de Ingeniería y Ciencias Agropecuarias', 'decanaturaingenieria@iudigital.edu.co')
      RETURNING id INTO fac_id;
    INSERT INTO programs (name, faculty_id) VALUES
      ('Ingeniería en Desarrollo Territorial',       fac_id),
      ('Ingeniería Mecatrónica',                     fac_id),
      ('Ingeniería de Software y Datos',             fac_id),
      ('Tecnología en Desarrollo de Software',       fac_id),
      ('Tecnología en Gestión Catastral y Agrimensura', fac_id),
      ('Tecnología en Desarrollo Comunitario',       fac_id);

  END IF;
END $$;

-- ── Estrategias ──────────────────────────────────────────────
INSERT INTO strategies (name)
SELECT v.name FROM (VALUES
  ('Educación Precedente'),
  ('Comunidad Docente'),
  ('Ambientes Abiertos para el Aprendizaje'),
  ('Acompañamiento Comunitario en Territorio'),
  ('Investigación'),
  ('Relacionamiento y Gestión'),
  ('Juguemos ConCiencia, Robótica y Festivales Científicos'),
  ('Otro')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM strategies);

-- ── Municipios (125 de Antioquia + 4 nodos nacionales) ───────
INSERT INTO municipalities (name, department)
SELECT v.name, v.department FROM (VALUES
  -- Valle de Aburrá (10)
  ('Barbosa','Antioquia'),('Bello','Antioquia'),('Caldas','Antioquia'),
  ('Copacabana','Antioquia'),('Envigado','Antioquia'),('Girardota','Antioquia'),
  ('Itagüí','Antioquia'),('La Estrella','Antioquia'),('Medellín','Antioquia'),
  ('Sabaneta','Antioquia'),
  -- Norte (17)
  ('Angostura','Antioquia'),('Belmira','Antioquia'),('Briceño','Antioquia'),
  ('Campamento','Antioquia'),('Carolina del Príncipe','Antioquia'),
  ('Don Matías','Antioquia'),('Entrerríos','Antioquia'),('Gómez Plata','Antioquia'),
  ('Guadalupe','Antioquia'),('Ituango','Antioquia'),
  ('San Andrés de Cuerquia','Antioquia'),('San José de la Montaña','Antioquia'),
  ('San Pedro de los Milagros','Antioquia'),('Santa Rosa de Osos','Antioquia'),
  ('Toledo','Antioquia'),('Valdivia','Antioquia'),('Yarumal','Antioquia'),
  -- Nordeste (10)
  ('Amalfi','Antioquia'),('Anorí','Antioquia'),('Cisneros','Antioquia'),
  ('Remedios','Antioquia'),('San Roque','Antioquia'),('Santo Domingo','Antioquia'),
  ('Segovia','Antioquia'),('Vegachí','Antioquia'),('Yalí','Antioquia'),
  ('Yolombó','Antioquia'),
  -- Bajo Cauca (6)
  ('Cáceres','Antioquia'),('Caucasia','Antioquia'),('El Bagre','Antioquia'),
  ('Nechí','Antioquia'),('Tarazá','Antioquia'),('Zaragoza','Antioquia'),
  -- Magdalena Medio (6)
  ('Caracolí','Antioquia'),('Maceo','Antioquia'),('Puerto Berrío','Antioquia'),
  ('Puerto Nare','Antioquia'),('Puerto Triunfo','Antioquia'),('Yondó','Antioquia'),
  -- Oriente (23)
  ('Abejorral','Antioquia'),('Alejandría','Antioquia'),('Argelia','Antioquia'),
  ('Cocorná','Antioquia'),('Concepción','Antioquia'),
  ('El Carmen de Viboral','Antioquia'),('El Peñol','Antioquia'),
  ('El Retiro','Antioquia'),('El Santuario','Antioquia'),('Granada','Antioquia'),
  ('Guarne','Antioquia'),('Guatapé','Antioquia'),('La Ceja','Antioquia'),
  ('La Unión','Antioquia'),('Marinilla','Antioquia'),('Nariño','Antioquia'),
  ('Rionegro','Antioquia'),('San Carlos','Antioquia'),('San Francisco','Antioquia'),
  ('San Luis','Antioquia'),('San Rafael','Antioquia'),
  ('San Vicente Ferrer','Antioquia'),('Sonsón','Antioquia'),
  -- Suroeste (23)
  ('Andes','Antioquia'),('Angelópolis','Antioquia'),('Amagá','Antioquia'),
  ('Betania','Antioquia'),('Betulia','Antioquia'),('Caramanta','Antioquia'),
  ('Ciudad Bolívar','Antioquia'),('Concordia','Antioquia'),('Fredonia','Antioquia'),
  ('Hispania','Antioquia'),('Jardín','Antioquia'),('Jericó','Antioquia'),
  ('La Pintada','Antioquia'),('Montebello','Antioquia'),('Pueblorrico','Antioquia'),
  ('Salgar','Antioquia'),('Santa Bárbara','Antioquia'),('Támesis','Antioquia'),
  ('Tarso','Antioquia'),('Titiribí','Antioquia'),('Urrao','Antioquia'),
  ('Valparaíso','Antioquia'),('Venecia','Antioquia'),
  -- Occidente (19)
  ('Abriaquí','Antioquia'),('Anzá','Antioquia'),('Armenia','Antioquia'),
  ('Buriticá','Antioquia'),('Caicedo','Antioquia'),('Cañasgordas','Antioquia'),
  ('Dabeiba','Antioquia'),('Ebéjico','Antioquia'),('Frontino','Antioquia'),
  ('Giraldo','Antioquia'),('Heliconia','Antioquia'),('Liborina','Antioquia'),
  ('Olaya','Antioquia'),('Peque','Antioquia'),('Sabanalarga','Antioquia'),
  ('San Jerónimo','Antioquia'),('Santa Fe de Antioquia','Antioquia'),
  ('Sopetrán','Antioquia'),('Uramita','Antioquia'),
  -- Urabá (11)
  ('Apartadó','Antioquia'),('Arboletes','Antioquia'),('Carepa','Antioquia'),
  ('Chigorodó','Antioquia'),('Mutatá','Antioquia'),('Murindó','Antioquia'),
  ('Necoclí','Antioquia'),('San Juan de Urabá','Antioquia'),
  ('San Pedro de Urabá','Antioquia'),('Turbo','Antioquia'),
  ('Vigía del Fuerte','Antioquia'),
  -- Nodos nacionales fuera de Antioquia (4)
  ('San Andrés','Archipiélago de San Andrés, Providencia y Santa Catalina'),
  ('Cumaribo','Vichada'),
  ('El Tambo','Cauca'),
  ('Argelia','Cauca')
) AS v(name, department)
WHERE NOT EXISTS (SELECT 1 FROM municipalities);

-- ── Ejes misionales ──────────────────────────────────────────
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF (SELECT COUNT(*) FROM mission_axes) = 0 THEN
    INSERT INTO mission_axes (name) VALUES
      ('Docencia directa'),
      ('Asesorías de trabajo de grado'),
      ('Investigación'),
      ('Extensión');

    INSERT INTO mission_axes (name) VALUES ('Administración académica')
      RETURNING id INTO v_admin_id;

    INSERT INTO mission_axes (name, parent_id) VALUES
      ('Gestión de programas', v_admin_id),
      ('Representatividad en cuerpos colegiados u otros', v_admin_id),
      ('Otras actividades administrativas (Internacionalización, Bienestar, entre otras)', v_admin_id);
  END IF;
END $$;


-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
-- Verificación rápida (opcional — comenta si no la necesitas):
--
-- SELECT 'faculties',          COUNT(*) FROM faculties      UNION ALL
-- SELECT 'programs',           COUNT(*) FROM programs       UNION ALL
-- SELECT 'municipalities',     COUNT(*) FROM municipalities UNION ALL
-- SELECT 'strategies',         COUNT(*) FROM strategies     UNION ALL
-- SELECT 'mission_axes',       COUNT(*) FROM mission_axes   UNION ALL
-- SELECT 'processes',          COUNT(*) FROM processes      UNION ALL
-- SELECT 'course_sessions',    COUNT(*) FROM course_sessions UNION ALL
-- SELECT 'session_moments',    COUNT(*) FROM session_moments UNION ALL
-- SELECT 'session_attendees',  COUNT(*) FROM session_attendees UNION ALL
-- SELECT 'session_evidences',  COUNT(*) FROM session_evidences;
