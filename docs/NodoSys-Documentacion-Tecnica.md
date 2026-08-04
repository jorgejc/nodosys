# NodoSys — Documentación Técnica

**Sistema de gestión para nodos territoriales**
Institución Universitaria Digital de Antioquia

Autor: Jorge Armando Julio Cruz — Docente Enlace, Nodo de Proximidad Arboletes
Versión: 1.0
Fecha: Julio de 2026

---

## 1. Descripción general

NodoSys es una aplicación web que centraliza y automatiza la gestión operativa de los nodos de proximidad de la IU Digital. Sustituye procesos que se realizaban manualmente en hojas de cálculo, documentos de texto y carpetas compartidas, unificándolos en una sola plataforma con control de acceso por rol y trazabilidad.

### Problema que resuelve

La red de nodos territoriales opera con información dispersa: los inventarios se llevan en archivos locales, los planes de trabajo en formatos Word individuales, las solicitudes de recursos por correo, y las bitácoras de los procesos formativos en documentos sueltos. Esto genera duplicidad, pérdida de evidencias, dificultad para consolidar reportes institucionales y ausencia de trazabilidad auditables.

### Alcance funcional

El sistema cubre seis dominios:

- Gestión de inventarios por nodo, con ubicación física y control de unidades
- Planes de trabajo docente en formato institucional, organizados por ejes misionales
- Solicitudes de actividad y recursos, con flujo de autorización
- Procesos formativos con bitácoras de sesiones y registro de asistencia
- Reportes institucionales en PDF y Excel para todos los módulos
- Administración de usuarios con control de acceso basado en roles

---

## 2. Arquitectura

### 2.1 Visión general

NodoSys sigue una arquitectura de tres capas desplegada en la nube:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   Backend / API  │────▶│  Base de datos  │
│  React 18+Vite  │     │   NestJS 10 + TS │     │   PostgreSQL    │
│    (Vercel)     │◀────│     (Render)     │◀────│   (Supabase)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

La autenticación se realiza mediante JSON Web Tokens (JWT). El token transporta el identificador del usuario, su rol y su nodo asignado, información que el backend usa para aplicar las reglas de autorización en cada petición.

### 2.2 Stack tecnológico

**Frontend**
- React 18 con Vite como bundler
- TailwindCSS para estilos
- TanStack Query para gestión de estado del servidor y caché
- Zustand para estado global de la aplicación
- React Router para navegación
- jsPDF y ExcelJS para generación de documentos en cliente

**Backend**
- NestJS 10 sobre Node.js
- TypeScript
- TypeORM como ORM
- Passport + JWT para autenticación
- class-validator para validación de DTOs
- pdfmake y ExcelJS para generación de reportes en servidor

**Infraestructura**
- Monorepo gestionado con pnpm
- PostgreSQL como motor de base de datos
- Supabase como proveedor de base de datos en producción
- Render para el despliegue del backend
- Vercel para el despliegue del frontend
- Git con flujo de ramas (main, develop, feature/*)

### 2.3 Estructura del repositorio

```
nodosys/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           Autenticación y JWT
│   │   │   │   ├── users/          Gestión de usuarios
│   │   │   │   ├── inventory/      Inventarios por nodo
│   │   │   │   ├── workplan/       Planes de trabajo
│   │   │   │   ├── activities/     Solicitudes de actividad
│   │   │   │   ├── processes/      Procesos formativos
│   │   │   │   ├── sessions/       Sesiones y bitácoras
│   │   │   │   ├── catalogs/       Catálogos maestros
│   │   │   │   └── reports/        Generación de reportes
│   │   │   ├── database/           Scripts SQL de migración
│   │   │   ├── security/           Suite de pruebas de seguridad
│   │   │   └── config/             Configuración
│   └── frontend/
│       └── src/
│           ├── pages/              Vistas por módulo
│           ├── components/         Componentes reutilizables
│           ├── services/           Clientes HTTP por módulo
│           ├── hooks/              Hooks personalizados (useAuth)
│           ├── layouts/            Estructura de la aplicación
│           └── types/              Definiciones TypeScript
```

---

## 3. Modelo de datos

### 3.1 Entidades principales

**nodos** — Nodos territoriales de la institución. Cada nodo tiene nombre, ciudad, departamento y un ámbito (`scope`) que distingue entre nodos departamentales (recursos gestionados por la IU Digital) y nacionales (recursos del gobierno nacional). Actualmente hay 19 nodos registrados.

**users** — Usuarios del sistema. Cada usuario tiene un rol que determina sus permisos, y opcionalmente un nodo asignado (`nodo_id`), una facultad (`faculty_id`) y un programa (`program_id`). Los roles administrativos no requieren nodo, ya que su alcance lo define el rol.

**inventory_items / inventory_units / inventory_movements** — Inventario por nodo. Un ítem representa un tipo de bien; las unidades son ejemplares individuales con seguimiento propio; los movimientos registran préstamos y devoluciones. Los ítems incluyen ubicación física opcional (tipo de ubicación, gabinete, entrepaño o nota libre).

**work_plans / work_plan_axes / axis_activities** — Planes de trabajo docente. Un plan pertenece a un docente y se organiza en ejes; cada eje contiene tareas (`axis_activities`).

**activity_requests** — Solicitudes de actividad y recursos. Pueden estar vinculadas a una sesión de un proceso (`session_id`) o existir de forma independiente. Incluyen estrategia, municipio, detalle de recursos, tipo de pago, participantes estimados y disponibilidad de proveedor con factura electrónica.

**processes** — Procesos formativos (cursos, clubes, talleres). Actúa como contenedor de sesiones y, opcionalmente, de actividades. Se clasifica por estrategia institucional y eje misional, y define la plantilla de sesión que usarán sus bitácoras.

**course_sessions / session_moments / session_attendees / session_evidences** — Bitácoras de sesión. Una sesión documenta un encuentro con su fecha, tema, asistentes y evidencias. Según la plantilla del proceso padre, puede incluir los tres momentos pedagógicos, una descripción libre, o campos técnicos de investigación.

### 3.2 Catálogos maestros

Para evitar redundancia y garantizar consistencia, cuatro conjuntos de datos se gestionan como tablas de catálogo en lugar de texto libre:

| Catálogo | Registros | Contenido |
|---|---|---|
| `faculties` | 4 | Facultades de la institución con su correo de decanatura |
| `programs` | 18 | Programas académicos, vinculados a su facultad |
| `strategies` | 8 | Estrategias institucionales |
| `municipalities` | 129 | 125 municipios de Antioquia más 4 sedes nacionales |
| `mission_axes` | 8 | Ejes misionales, con estructura jerárquica de dos niveles |

Los catálogos se siembran de forma idempotente al arrancar la aplicación y también mediante script SQL, para que la migración sea autosuficiente.

### 3.3 Aislamiento por nodo

El aislamiento de datos por nodo es la característica más crítica del sistema. Los inventarios, actividades y procesos de cada nodo son visibles únicamente para el personal de ese nodo y para los roles con alcance institucional. Esta separación se aplica en el backend mediante el `nodo_id` que viaja en el JWT, no en la interfaz.

---

## 4. Módulos funcionales

### 4.1 Inventario

Gestiona los bienes de cada nodo. Cada ítem pertenece a una categoría y a un nodo, y puede desglosarse en unidades individuales con seguimiento de préstamos.

La ubicación física es opcional y admite dos modalidades: ubicación en gabinete (con número de gabinete y entrepaño, con sugerencias basadas en los gabinetes ya usados en ese nodo) o mobiliario suelto (con una nota de ubicación libre). El diseño es deliberadamente permisivo: un ítem puede guardarse sin ubicación y completarse después.

### 4.2 Planes de trabajo

Implementa el formato institucional de plan de trabajo docente. Un plan se organiza en ejes misionales, y cada eje contiene las tareas comprometidas por el docente. Los planes se listan agrupados por facultad, con filtros por nombre, documento, facultad y programa.

Las tareas del plan pueden vincularse con procesos formativos, de modo que la bitácora de un proceso queda accesible desde la tarea del plan que lo respalda.

### 4.3 Actividades y recursos

Registra las solicitudes de actividad que requieren autorización de recursos (viáticos, transporte, alimentación). Una actividad puede vincularse a una sesión específica de un proceso, o existir de forma independiente para salidas puntuales.

Para procesos recurrentes, el sistema permite precargar los datos de la última actividad del proceso mediante un botón explícito, evitando reescribir información que se repite entre sesiones.

### 4.4 Procesos formativos y bitácoras

Un proceso agrupa las sesiones de una iniciativa formativa. Se clasifica por estrategia institucional y eje misional, y define qué plantilla usarán sus sesiones:

- **Tres momentos** — Metodología pedagógica de explorar, crear y consolidar, con objetivo, metodología, materiales y duración por momento.
- **Descripción libre** — Para reuniones, visitas y actividades de relacionamiento. Registra qué se hizo sin estructura pedagógica.
- **Investigación** — Para procesos técnicos. Incluye tema técnico, herramienta o simulador utilizado, desarrollo y resultados.

Todas las plantillas comparten los campos comunes: fecha, horario, tema, lugar, lista de asistentes, descripción de la experiencia y evidencias.

El sistema calcula automáticamente la certificabilidad de cada asistente según su número de ausencias.

### 4.5 Reportes

Genera informes en PDF y Excel para inventarios, planes de trabajo, actividades y usuarios. Los PDF incorporan el encabezado y pie de página institucional de la IU Digital.

Los reportes están disponibles tanto desde un módulo central como desde botones de exportación dentro de cada módulo, y respetan los permisos del usuario: cada rol solo puede generar reportes de los datos a los que tiene acceso.

Para procesos, existe además una bitácora consolidada que reúne todas las sesiones de un proceso en un único documento, incluyendo el resumen de asistencia y certificabilidad.

---

## 5. Control de acceso

### 5.1 Matriz de permisos

| Rol | Usuarios | Inventarios | Planes de trabajo | Actividades | Procesos |
|---|---|---|---|---|---|
| Administrador | Total | Todos los nodos | Todos | Todas | Todos |
| Vicerrector de Extensión | — | Todos los nodos | Solo de enlaces, por nodo | Todas (autoriza) | — |
| Vicerrector Académico | — | — | Todas las facultades | — | — |
| Decano / Coordinador | — | — | Solo su facultad | — | — |
| Enlace (docente de nodo) | — | Solo su nodo | Solo el suyo | Solo las suyas | Solo los suyos |
| Docente | — | — | Solo el suyo | Solo las suyas | Solo los suyos |
| Monitor / Auxiliar | — | Su nodo, solo lectura | — | — | — |

Los decanos y coordinadores no tienen plan de trabajo propio; su función es revisar los de los docentes de su facultad.

El sistema aplica el principio de denegación por defecto: cualquier rol no contemplado explícitamente en la matriz recibe respuesta 403 en los módulos correspondientes.

### 5.2 Aplicación de la autorización

La autorización se implementa en dos capas con responsabilidades distintas:

**Backend (seguridad efectiva).** Guards de NestJS y filtrado en los servicios verifican el rol y el nodo del usuario en cada petición. Esta es la protección real: aunque un usuario construya la petición manualmente, el backend la rechaza.

**Frontend (experiencia de usuario).** El menú lateral, el panel principal y los formularios muestran únicamente las opciones que corresponden al rol. Esto no constituye seguridad —es claridad de interfaz.

---

## 6. Estrategia de calidad y seguridad

### 6.1 Revisión adversarial

El sistema se desarrolló con asistencia de agentes de IA, lo que multiplica el volumen de código producido y desplaza el desafío de la escritura hacia la verificación. Para gestionarlo se adoptó un esquema de revisión heterogénea, con revisores independientes que evalúan el código desde ángulos distintos.

Antes del despliegue a producción se ejecutó una revisión crítica sobre el conjunto de cambios acumulados. Esta revisión identificó cinco problemas bloqueantes que no habían sido detectados durante el desarrollo:

1. **Escalada de privilegios en el registro público.** El endpoint de registro aceptaba el campo `role`, permitiendo que cualquier persona se registrara como administrador.
2. **Auto-promoción vía actualización de perfil.** Un usuario autenticado podía modificar su propio rol enviando `role: admin` al endpoint de actualización.
3. **Fuga de aislamiento por nodo.** Un usuario con rol de nodo pero sin nodo asignado recibía datos agregados de todos los nodos en varios endpoints de inventario.
4. **Acceso horizontal entre nodos.** Los endpoints de detalle de ítem y de registro de movimientos no verificaban la pertenencia al nodo, permitiendo lectura y escritura sobre inventario ajeno conociendo el identificador.
5. **Migraciones con dependencias no satisfechas.** Los scripts de migración referenciaban tablas de catálogo que ninguna migración creaba, lo que habría hecho fallar el despliegue.

Los cinco se corrigieron y se verificaron adversarialmente antes de desplegar.

### 6.2 Suite de pruebas de seguridad

Se implementó una suite automatizada de 19 pruebas de integración que ejercitan el ciclo completo (autenticación, obtención de token, petición) contra una base de datos de prueba independiente.

Las pruebas cubren tres áreas:

**Escalada de privilegios** — Verifican que el registro público no permita elegir rol, que un usuario no pueda auto-promoverse ni auto-asignarse un nodo, y que solo el administrador cree usuarios.

**Aislamiento por nodo** — Verifican que un enlace solo vea el inventario de su nodo, que reciba 403 al solicitar ítems de otro nodo por identificador directo, que un usuario sin nodo asignado no reciba datos globales, y que no pueda registrar movimientos sobre unidades ajenas.

**Matriz de permisos** — Verifican que cada rol acceda únicamente a los módulos que le corresponden y que los filtros por facultad y por tipo de docente funcionen correctamente.

La suite se ejecuta con `npm run test:security` y actúa como red de seguridad ante regresiones: cualquier cambio futuro que reabra uno de estos huecos hace fallar una prueba.

Durante la escritura de las pruebas se detectó un defecto adicional en la corrección del punto 3 —una comparación con `null` que nunca se cumplía porque la función devolvía `undefined`—, lo que confirma el valor de verificar mediante pruebas en lugar de confiar en la inspección del código.

---

## 7. Despliegue

### 7.1 Flujo de trabajo con Git

El repositorio sigue un flujo de ramas:

- `main` — Versión estable desplegada en producción
- `develop` — Rama de integración donde convergen las funcionalidades
- `feature/*` — Una rama por funcionalidad o corrección

Cada fase de desarrollo se trabaja en su propia rama, se prueba en local, se fusiona a `develop`, y solo se lleva a `main` cuando el conjunto está verificado.

### 7.2 Procedimiento de despliegue

El orden es crítico: **la base de datos se migra antes que el código**. El código nuevo espera un esquema que debe existir previamente; el orden inverso provoca fallos.

1. Coordinar una ventana de mantenimiento con los usuarios activos
2. Desactivar el despliegue automático en Render y Vercel
3. Crear copias de respaldo de las tablas que serán modificadas
4. Ejecutar el script de migración consolidado en la base de datos de producción
5. Verificar los conteos de las tablas creadas y sembradas
6. Fusionar la rama a `main`
7. Reactivar o disparar el despliegue en Render y Vercel
8. Verificar en producción: autenticación, integridad de los datos existentes, carga de catálogos y aplicación de las restricciones de acceso

### 7.3 Migraciones

En desarrollo, TypeORM opera con `synchronize: true` y ajusta el esquema automáticamente. En producción `synchronize` está desactivado, por lo que el esquema se aplica ejecutando scripts SQL.

Todos los scripts son idempotentes: usan `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, bloques `DO $$` para tipos enumerados, e inserciones condicionadas para los datos semilla. Reejecutarlos no produce errores ni duplica información.

El archivo `ORDEN-MIGRACIONES.md` documenta la secuencia de ejecución y las dependencias entre scripts.

---

## 8. Lecciones y decisiones de diseño

**Los catálogos son tablas, no texto libre.** El diseño inicial almacenaba facultades, programas y municipios como cadenas de texto, lo que producía variantes del mismo valor y hacía imposible filtrar de forma confiable. Migrarlos a tablas de catálogo con claves foráneas fue una corrección arquitectónica necesaria.

**Los procesos y las actividades son dominios distintos.** Inicialmente las bitácoras colgaban de las solicitudes de actividad, lo que impedía documentar procesos que no requieren recursos y fragmentaba la trazabilidad de un curso en múltiples actividades independientes. Separarlos —introduciendo el proceso como contenedor y vinculando las actividades a sesiones específicas— resolvió ambos problemas.

**La mayoría de los defectos de filtrado eran defectos de datos.** Varios problemas persistentes de visibilidad por nodo tenían su origen en registros con `nodo_id` nulo, no en la lógica de filtrado. Diagnosticar los datos antes de modificar el código ahorra tiempo considerable.

**El token debe regenerarse tras cambios de asignación.** Como el nodo y el rol viajan en el JWT, modificar esos valores en la base de datos no surte efecto hasta que el usuario inicia sesión nuevamente.

**La revisión propia no detecta escaladas de privilegios.** Los dos defectos más graves del sistema sobrevivieron a múltiples revisiones durante el desarrollo y solo aparecieron cuando un revisor independiente examinó el conjunto de cambios con la instrucción explícita de buscar fallos.

---

## 9. Trabajo futuro

- Incorporación de componentes de inteligencia artificial para la generación asistida de reportes y bitácoras, el seguimiento de procesos formativos y la consolidación de planes de trabajo
- Ampliación de la cobertura de pruebas más allá del perímetro de seguridad
- Almacenamiento gestionado de evidencias fotográficas, actualmente registradas mediante enlace externo
- Depuración de tablas residuales de versiones anteriores del esquema
- Documentación de usuario final diferenciada por rol
