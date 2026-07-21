-- ============================================================
-- Migración: Catálogos maestros (faculties, programs, municipalities, strategies)
-- ============================================================
-- Crea Y siembra las tablas de catálogo que el resto de migraciones
-- referencian por FK. DEBE ejecutarse ANTES de:
--   · migration-tipos-proceso.sql   (processes.strategy_id → strategies)
--   · migration-fase4-actividades.sql (activity_requests.strategy_id → strategies,
--                                       activity_requests.municipality_id → municipalities)
--
-- En desarrollo TypeORM synchronize:true crea estas tablas automáticamente y
-- CatalogsService.onModuleInit las siembra al arrancar. En producción
-- (synchronize:false) este script es la única fuente que las crea, por eso
-- también incluye los datos (autosuficiente).
--
-- IDEMPOTENTE:
--   · CREATE TABLE IF NOT EXISTS  → re-ejecutar no falla.
--   · Los INSERT solo corren si la tabla está vacía (WHERE NOT EXISTS),
--     así que no duplican datos y son compatibles con el seed idempotente
--     de CatalogsService (que hace skip si count > 0).
-- ============================================================

-- ── 1. Tablas ─────────────────────────────────────────────────────────

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

-- ── 2. Seed de facultades y programas ─────────────────────────────────
-- Solo si la tabla faculties está vacía.
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
      ('Comunicación y Periodismo Digital', fac_id),
      ('Derecho', fac_id),
      ('Publicidad y Mercadeo Digital', fac_id),
      ('Profesional en Ciencias Ambientales', fac_id),
      ('Profesional en Trabajo Social', fac_id);

    INSERT INTO faculties (name, email)
      VALUES ('Facultad de Ciencias Económicas, Administrativas y Contables', 'decanaturaadministracion@iudigital.edu.co')
      RETURNING id INTO fac_id;
    INSERT INTO programs (name, faculty_id) VALUES
      ('Administración de Empresas', fac_id),
      ('Administración de Empresas Turísticas y Hoteleras', fac_id),
      ('Administración de Seguridad y Salud en el Trabajo', fac_id),
      ('Tecnología en Gestión Comercial Agroempresarial', fac_id),
      ('Tecnología en Gestión Logística Portuaria y del Transporte', fac_id),
      ('Tecnología en Gestión Administrativa', fac_id);

    INSERT INTO faculties (name, email)
      VALUES ('Facultad de Ingeniería y Ciencias Agropecuarias', 'decanaturaingenieria@iudigital.edu.co')
      RETURNING id INTO fac_id;
    INSERT INTO programs (name, faculty_id) VALUES
      ('Ingeniería en Desarrollo Territorial', fac_id),
      ('Ingeniería Mecatrónica', fac_id),
      ('Ingeniería de Software y Datos', fac_id),
      ('Tecnología en Desarrollo de Software', fac_id),
      ('Tecnología en Gestión Catastral y Agrimensura', fac_id),
      ('Tecnología en Desarrollo Comunitario', fac_id);

  END IF;
END $$;

-- ── 3. Seed de estrategias ────────────────────────────────────────────
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

-- ── 4. Seed de municipios (125 de Antioquia + 4 nodos nacionales) ─────
INSERT INTO municipalities (name, department)
SELECT v.name, v.department FROM (VALUES
  -- Valle de Aburrá (10)
  ('Barbosa','Antioquia'),('Bello','Antioquia'),('Caldas','Antioquia'),('Copacabana','Antioquia'),('Envigado','Antioquia'),
  ('Girardota','Antioquia'),('Itagüí','Antioquia'),('La Estrella','Antioquia'),('Medellín','Antioquia'),('Sabaneta','Antioquia'),
  -- Norte (17)
  ('Angostura','Antioquia'),('Belmira','Antioquia'),('Briceño','Antioquia'),('Campamento','Antioquia'),('Carolina del Príncipe','Antioquia'),
  ('Don Matías','Antioquia'),('Entrerríos','Antioquia'),('Gómez Plata','Antioquia'),('Guadalupe','Antioquia'),('Ituango','Antioquia'),
  ('San Andrés de Cuerquia','Antioquia'),('San José de la Montaña','Antioquia'),('San Pedro de los Milagros','Antioquia'),
  ('Santa Rosa de Osos','Antioquia'),('Toledo','Antioquia'),('Valdivia','Antioquia'),('Yarumal','Antioquia'),
  -- Nordeste (10)
  ('Amalfi','Antioquia'),('Anorí','Antioquia'),('Cisneros','Antioquia'),('Remedios','Antioquia'),('San Roque','Antioquia'),
  ('Santo Domingo','Antioquia'),('Segovia','Antioquia'),('Vegachí','Antioquia'),('Yalí','Antioquia'),('Yolombó','Antioquia'),
  -- Bajo Cauca (6)
  ('Cáceres','Antioquia'),('Caucasia','Antioquia'),('El Bagre','Antioquia'),('Nechí','Antioquia'),('Tarazá','Antioquia'),('Zaragoza','Antioquia'),
  -- Magdalena Medio (6)
  ('Caracolí','Antioquia'),('Maceo','Antioquia'),('Puerto Berrío','Antioquia'),('Puerto Nare','Antioquia'),('Puerto Triunfo','Antioquia'),('Yondó','Antioquia'),
  -- Oriente (23)
  ('Abejorral','Antioquia'),('Alejandría','Antioquia'),('Argelia','Antioquia'),('Cocorná','Antioquia'),('Concepción','Antioquia'),
  ('El Carmen de Viboral','Antioquia'),('El Peñol','Antioquia'),('El Retiro','Antioquia'),('El Santuario','Antioquia'),('Granada','Antioquia'),
  ('Guarne','Antioquia'),('Guatapé','Antioquia'),('La Ceja','Antioquia'),('La Unión','Antioquia'),('Marinilla','Antioquia'),
  ('Nariño','Antioquia'),('Rionegro','Antioquia'),('San Carlos','Antioquia'),('San Francisco','Antioquia'),('San Luis','Antioquia'),
  ('San Rafael','Antioquia'),('San Vicente Ferrer','Antioquia'),('Sonsón','Antioquia'),
  -- Suroeste (23)
  ('Andes','Antioquia'),('Angelópolis','Antioquia'),('Amagá','Antioquia'),('Betania','Antioquia'),('Betulia','Antioquia'),
  ('Caramanta','Antioquia'),('Ciudad Bolívar','Antioquia'),('Concordia','Antioquia'),('Fredonia','Antioquia'),('Hispania','Antioquia'),
  ('Jardín','Antioquia'),('Jericó','Antioquia'),('La Pintada','Antioquia'),('Montebello','Antioquia'),('Pueblorrico','Antioquia'),
  ('Salgar','Antioquia'),('Santa Bárbara','Antioquia'),('Támesis','Antioquia'),('Tarso','Antioquia'),('Titiribí','Antioquia'),
  ('Urrao','Antioquia'),('Valparaíso','Antioquia'),('Venecia','Antioquia'),
  -- Occidente (19)
  ('Abriaquí','Antioquia'),('Anzá','Antioquia'),('Armenia','Antioquia'),('Buriticá','Antioquia'),('Caicedo','Antioquia'),
  ('Cañasgordas','Antioquia'),('Dabeiba','Antioquia'),('Ebéjico','Antioquia'),('Frontino','Antioquia'),('Giraldo','Antioquia'),
  ('Heliconia','Antioquia'),('Liborina','Antioquia'),('Olaya','Antioquia'),('Peque','Antioquia'),('Sabanalarga','Antioquia'),
  ('San Jerónimo','Antioquia'),('Santa Fe de Antioquia','Antioquia'),('Sopetrán','Antioquia'),('Uramita','Antioquia'),
  -- Urabá (11)
  ('Apartadó','Antioquia'),('Arboletes','Antioquia'),('Carepa','Antioquia'),('Chigorodó','Antioquia'),('Mutatá','Antioquia'),
  ('Murindó','Antioquia'),('Necoclí','Antioquia'),('San Juan de Urabá','Antioquia'),('San Pedro de Urabá','Antioquia'),
  ('Turbo','Antioquia'),('Vigía del Fuerte','Antioquia'),
  -- Nodos nacionales fuera de Antioquia (4)
  ('San Andrés','Archipiélago de San Andrés, Providencia y Santa Catalina'),
  ('Cumaribo','Vichada'),
  ('El Tambo','Cauca'),
  ('Argelia','Cauca')
) AS v(name, department)
WHERE NOT EXISTS (SELECT 1 FROM municipalities);
