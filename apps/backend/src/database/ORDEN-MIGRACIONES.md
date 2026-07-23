# Orden de ejecución de migraciones SQL (producción)

En **desarrollo** TypeORM corre con `synchronize: true` y crea/ajusta el
esquema automáticamente, por lo que estos scripts no hacen falta.

En **producción** `synchronize: false` (ver `src/config/database.config.ts`),
así que el esquema se aplica ejecutando estos scripts **en orden**. El orden
importa porque hay claves foráneas (FK): una tabla debe existir antes de que
otra la referencie.

> ⚠️ **Regla nueva:** `migration-catalogos.sql` crea las tablas de catálogo
> (`faculties`, `programs`, `municipalities`, `strategies`) y **debe correr
> ANTES** de `migration-tipos-proceso.sql` y `migration-fase4-actividades.sql`,
> que las referencian por FK. Sin esto, esas dos migraciones fallan en
> producción con *"relation strategies does not exist"*.

---

## Orden completo (instalación desde cero)

| # | Script | Crea / hace | Depende de |
|---|--------|-------------|------------|
| 1 | `schema.sql` | `nodos`, `users`, `inventory_categories`, `inventory_items`, esquema base | — |
| 2 | `migration-nodos.sql` | `nodos` (IF NOT EXISTS) y ajustes | 1 |
| 3 | `fix-nodos-table.sql` | correcciones de `nodos` | 2 |
| 4 | `migration-nodo-users.sql` | columnas de nodo en `users` | 1, 2 |
| 5 | `migration-fase2.sql` | `inventory_units`, `inventory_movements` | `inventory_items` (1) |
| 6 | `migration-fase3.sql` | `work_plans`, `work_plan_axes`, `axis_activities` | `users` (1) |
| 7 | `fix-produccion.sql` | correcciones de work plans (IF NOT EXISTS) | 6 |
| 8 | `migration-fase5.sql` | `activity_requests`, `activity_expenses`, `activity_participants`, `activity_evidence` | `users`, `axis_activities` (6) |
| 9 | `migration-processes.sql` | `processes`; añade `process_id` a `activity_requests` | `nodos`, `axis_activities`, `activity_requests` (8) |
| 10 | `migration-sessions.sql` | `course_sessions`, `session_moments`, `session_attendees`, `session_evidences`; añade `process_id` a `course_sessions` | `activity_requests`, `processes` (9) |
| **11** | **`migration-catalogos.sql`** ⬅️ **NUEVA** | **crea y siembra `faculties`, `programs`, `municipalities`, `strategies`** | — (independiente) |
| 12 | `migration-tipos-proceso.sql` | `mission_axes`; añade `strategy_id` / `mission_axis_id` / `session_template` a `processes`; columnas de investigación en `course_sessions` | **`strategies` (11)**, `processes` (9), `course_sessions` (10) |
| 13 | `migration-fase4-actividades.sql` | añade `session_id`, `strategy_id`, `municipality_id`, `resource_detail`, `payment_type`, `has_electronic_invoice_provider` a `activity_requests` | **`strategies` + `municipalities` (11)**, `course_sessions` (10) |
| 14 | `migration-inventario-ubicacion.sql` | añade `location_type`, `cabinet_number`, `shelf_number`, `location_note` a `inventory_items` | `inventory_items` (1) |

`migration-catalogos.sql` no depende de nada, así que su única restricción es
correr **antes** de las migraciones 12 y 13. Se coloca en el puesto 11 por
claridad.

---

## Pendientes para ESTE despliegue

La BD de producción ya tiene aplicados los scripts base (1–10). Lo que falta
correr, **en este orden**, es:

```
1. migration-catalogos.sql          ← PRIMERO (crea faculties/programs/municipalities/strategies)
2. migration-tipos-proceso.sql
3. migration-fase4-actividades.sql
4. migration-inventario-ubicacion.sql
```

> Si `migration-processes.sql` o `migration-sessions.sql` aún no se aplicaron
> en producción, córrelos antes del paso 2 (ver tabla completa arriba).

---

## Notas

- **Idempotencia:** los scripts usan `CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS` y (en catálogos) `INSERT ... WHERE NOT EXISTS`,
  por lo que re-ejecutarlos no falla ni duplica datos.
- **Seed de catálogos:** `migration-catalogos.sql` ya inserta los datos
  (4 facultades + 18 programas, 8 estrategias, 129 municipios). Es la misma
  data que `CatalogsService.onModuleInit`, que además siembra al arrancar la
  app si las tablas están vacías (hace *skip* si ya tienen filas). Las dos vías
  son compatibles: la que corra primero siembra, la otra no duplica.
- **`mission_axes`** NO está en `migration-catalogos.sql`: la crea y siembra
  `migration-tipos-proceso.sql`.
- Cómo ejecutar un script:
  `psql "$DATABASE_URL" -f src/database/<archivo>.sql`
