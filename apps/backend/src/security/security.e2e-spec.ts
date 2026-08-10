/**
 * security.e2e-spec.ts — Suite de seguridad
 *
 * Corre contra nodosys_test (nunca la BD de desarrollo).
 * Blinda: escalada de privilegios, aislamiento por nodo,
 * matriz de permisos de inventario y planes de trabajo.
 *
 * Ejecutar: npm run test:security  (desde apps/backend)
 */

// Override DB ANTES de que AppModule cargue el .env
process.env.DB_NAME = 'nodosys_test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { InventoryItem } from '../modules/inventory/entities/inventory-item.entity';
import { InventoryCategory } from '../modules/inventory/entities/inventory-category.entity';
import { InventoryUnit, UnitCondition, UnitStatus } from '../modules/inventory/entities/inventory-unit.entity';
import { WorkPlan, PlanStatus } from '../modules/workplan/entities/work-plan.entity';
import { MonitorWorkPlan } from '../modules/monitors/entities/monitor-work-plan.entity';
import { MonitorWeek } from '../modules/monitors/entities/monitor-week.entity';
import { MonitorWeekActivity } from '../modules/monitors/entities/monitor-week-activity.entity';
import { AuxiliaryDay } from '../modules/auxiliary/entities/auxiliary-day.entity';
import { AuxiliaryActivity } from '../modules/auxiliary/entities/auxiliary-activity.entity';

// UUIDs fijos de los nodos de prueba (no existen en prod, solo en nodosys_test)
const NODO_A = 'aaaaaaaa-0000-4000-a000-000000000001';
const NODO_B = 'bbbbbbbb-0000-4000-b000-000000000001';

jest.setTimeout(90_000);

describe('Security Suite — Escalada de Privilegios e Aislamiento por Nodo', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let itemRepo: Repository<InventoryItem>;
  let categoryRepo: Repository<InventoryCategory>;
  let unitRepo: Repository<InventoryUnit>;
  let planRepo: Repository<WorkPlan>;
  let monitorPlanRepo: Repository<MonitorWorkPlan>;
  let monitorWeekRepo: Repository<MonitorWeek>;
  let monitorActivityRepo: Repository<MonitorWeekActivity>;
  let auxDayRepo: Repository<AuxiliaryDay>;
  let auxActRepo: Repository<AuxiliaryActivity>;

  let users: Record<string, User> = {};
  let tokens: Record<string, string> = {};
  let catA: InventoryCategory;
  let catB: InventoryCategory;
  let itemA: InventoryItem;
  let itemB: InventoryItem;
  let unitB: InventoryUnit;
  let planA: WorkPlan;
  let planB: WorkPlan;
  let planDocente: WorkPlan;
  let monPlanA1: MonitorWorkPlan;   // monitora 1 del nodo A
  let monPlanA2: MonitorWorkPlan;   // monitora 2 del nodo A
  let monPlanB:  MonitorWorkPlan;   // monitora del nodo B
  let monWeekA1: MonitorWeek;       // semana 1 del plan de la monitora A1
  let monPlanExnodo: MonitorWorkPlan;  // monitora a la que se le retira el nodo

  async function loginAs(email: string, pass = 'SecTest123!'): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: pass });
    if (!res.body.accessToken) {
      throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
    }
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    userRepo     = mod.get(getRepositoryToken(User));
    itemRepo     = mod.get(getRepositoryToken(InventoryItem));
    categoryRepo = mod.get(getRepositoryToken(InventoryCategory));
    unitRepo     = mod.get(getRepositoryToken(InventoryUnit));
    planRepo     = mod.get(getRepositoryToken(WorkPlan));
    monitorPlanRepo     = mod.get(getRepositoryToken(MonitorWorkPlan));
    monitorWeekRepo     = mod.get(getRepositoryToken(MonitorWeek));
    monitorActivityRepo = mod.get(getRepositoryToken(MonitorWeekActivity));
    auxDayRepo          = mod.get(getRepositoryToken(AuxiliaryDay));
    auxActRepo          = mod.get(getRepositoryToken(AuxiliaryActivity));

    // Vistas SQL usadas por WorkPlanService.findOne — synchronize:true no las crea
    const ds = mod.get(DataSource);
    await ds.query(`
      CREATE OR REPLACE VIEW v_axis_summary AS
      SELECT ax.id AS axis_id, ax.work_plan_id, ax.axis_type, ax.planned_hours,
        wp.total_hours AS plan_total_hours,
        ROUND((ax.planned_hours / NULLIF(wp.total_hours,0)*100)::numeric,1) AS planned_percentage,
        COALESCE(SUM(a.executed_hours),0) AS executed_hours,
        ROUND((COALESCE(SUM(a.executed_hours),0)/NULLIF(ax.planned_hours,0)*100)::numeric,1) AS executed_percentage,
        COUNT(a.id) AS total_activities,
        COUNT(CASE WHEN a.activity_status='finalizada' THEN 1 END) AS finished_activities,
        COUNT(CASE WHEN a.activity_status='en_proceso' THEN 1 END) AS in_progress_activities
      FROM work_plan_axes ax
      JOIN work_plans wp ON wp.id = ax.work_plan_id
      LEFT JOIN axis_activities a ON a.axis_id = ax.id
      GROUP BY ax.id, ax.work_plan_id, ax.axis_type, ax.planned_hours, wp.total_hours
    `);
    await ds.query(`
      CREATE OR REPLACE VIEW v_plan_summary AS
      SELECT wp.id AS plan_id, wp.user_id, wp.semester, wp.year, wp.total_hours, wp.status,
        COALESCE(SUM(a.executed_hours),0) AS total_executed_hours,
        ROUND((COALESCE(SUM(a.executed_hours),0)/NULLIF(wp.total_hours,0)*100)::numeric,1) AS overall_completion_percentage,
        COUNT(DISTINCT ax.id) AS total_axes,
        COUNT(a.id) AS total_activities,
        COUNT(CASE WHEN a.activity_status='finalizada' THEN 1 END) AS finished_activities
      FROM work_plans wp
      LEFT JOIN work_plan_axes ax ON ax.work_plan_id = wp.id
      LEFT JOIN axis_activities a ON a.axis_id = ax.id
      GROUP BY wp.id, wp.user_id, wp.semester, wp.year, wp.total_hours, wp.status
    `);

    // ── Sembrar usuarios ───────────────────────────────────────────
    const pw = 'SecTest123!';

    const mkUser = (role: UserRole, overrides: Partial<User> = {}) =>
      userRepo.create({
        name:         `Sec ${role}`,
        email:        `${role.replace(/_/g, '-')}@sec.test`,
        passwordHash: pw,
        role,
        isActive:     true,
        ...overrides,
      } as Partial<User>);

    const saved = await userRepo.save([
      mkUser(UserRole.ADMIN),
      mkUser(UserRole.DOCENTE),
      mkUser(UserRole.ENLACE, {
        name: 'Enlace A', email: 'enlace-a@sec.test',
        nodoId: NODO_A, nodoName: 'Nodo A', faculty: 'Facultad A',
      }),
      mkUser(UserRole.ENLACE, {
        name: 'Enlace B', email: 'enlace-b@sec.test',
        nodoId: NODO_B, nodoName: 'Nodo B', faculty: 'Facultad B',
      }),
      mkUser(UserRole.ENLACE, {
        name: 'Enlace Null', email: 'enlace-null@sec.test',
        nodoId: null, nodoName: null,
      }),
      mkUser(UserRole.DECANO, {
        name: 'Decano A', email: 'decano-a@sec.test',
        faculty: 'Facultad A',
      }),
      mkUser(UserRole.DECANO, {
        name: 'Decano B', email: 'decano-b@sec.test',
        faculty: 'Facultad B',
      }),
      mkUser(UserRole.VICERRECTOR_EXTENSION),
      mkUser(UserRole.VICERRECTOR_ACADEMICO),
      // ── Monitoras (módulo Equipo de Nodo) ──
      mkUser(UserRole.MONITOR, {
        name: 'Monitora A1', email: 'monitora-a1@sec.test',
        nodoId: NODO_A, nodoName: 'Nodo A',
        documentNumber: '1111', program: 'Ingeniería de Software',
      }),
      mkUser(UserRole.MONITOR, {
        name: 'Monitora A2', email: 'monitora-a2@sec.test',
        nodoId: NODO_A, nodoName: 'Nodo A', documentNumber: '2222',
      }),
      mkUser(UserRole.MONITOR, {
        name: 'Monitora B', email: 'monitora-b@sec.test',
        nodoId: NODO_B, nodoName: 'Nodo B', documentNumber: '3333',
      }),
      // ── Auxiliares de nodo (Equipo de Nodo · Fase B) ──
      mkUser(UserRole.AUXILIAR, {
        name: 'Auxiliar A', email: 'auxiliar-a@sec.test',
        nodoId: NODO_A, nodoName: 'Nodo A', documentNumber: '7777',
      }),
      mkUser(UserRole.AUXILIAR, {
        name: 'Auxiliar B', email: 'auxiliar-b@sec.test',
        nodoId: NODO_B, nodoName: 'Nodo B', documentNumber: '8888',
      }),
      // Dedicada al caso "le retiran el nodo": se le quita dentro del test,
      // así que no puede ser ninguna de las que usan los demás casos.
      mkUser(UserRole.MONITOR, {
        name: 'Monitora Exnodo', email: 'monitora-exnodo@sec.test',
        nodoId: NODO_A, nodoName: 'Nodo A', documentNumber: '4444',
      }),
    ]);

    const byEmail = (e: string) => saved.find(u => u.email === e)!;
    users = {
      admin:     byEmail('admin@sec.test'),
      docente:   byEmail('docente@sec.test'),
      enlaceA:   byEmail('enlace-a@sec.test'),
      enlaceB:   byEmail('enlace-b@sec.test'),
      enlaceNull: byEmail('enlace-null@sec.test'),
      decanoA:   byEmail('decano-a@sec.test'),
      decanoB:   byEmail('decano-b@sec.test'),
      viceExt:   byEmail('vicerrector-extension@sec.test'),
      viceAcad:  byEmail('vicerrector-academico@sec.test'),
      monitoraA1: byEmail('monitora-a1@sec.test'),
      monitoraA2: byEmail('monitora-a2@sec.test'),
      monitoraB:  byEmail('monitora-b@sec.test'),
      monitoraExnodo: byEmail('monitora-exnodo@sec.test'),
      auxiliarA:  byEmail('auxiliar-a@sec.test'),
      auxiliarB:  byEmail('auxiliar-b@sec.test'),
    };

    // ── Sembrar inventario ─────────────────────────────────────────
    catA = await categoryRepo.save(
      categoryRepo.create({ name: 'Cat Sec A', icon: '🔒', nodoId: NODO_A }),
    );
    catB = await categoryRepo.save(
      categoryRepo.create({ name: 'Cat Sec B', icon: '🔒', nodoId: NODO_B }),
    );

    itemA = await itemRepo.save(
      itemRepo.create({ name: 'Item Sec A', categoryId: catA.id, nodoId: NODO_A, trackByUnit: true }),
    );
    itemB = await itemRepo.save(
      itemRepo.create({ name: 'Item Sec B', categoryId: catB.id, nodoId: NODO_B, trackByUnit: true }),
    );

    unitB = await unitRepo.save(
      unitRepo.create({
        itemId:    itemB.id,
        condition: UnitCondition.BUENO,
        status:    UnitStatus.DISPONIBLE,
        location:  'Bodega Sec',
      }),
    );

    // ── Sembrar planes de trabajo ──────────────────────────────────
    const planBase = { semester: '2026-1', year: 2026, totalHours: 10, status: PlanStatus.BORRADOR };
    planA       = await planRepo.save(planRepo.create({ ...planBase, userId: users.enlaceA.id,  faculty: 'Facultad A' }));
    planB       = await planRepo.save(planRepo.create({ ...planBase, userId: users.enlaceB.id,  faculty: 'Facultad B' }));
    planDocente = await planRepo.save(planRepo.create({ ...planBase, userId: users.docente.id,  faculty: '' }));

    // ── Sembrar planes de monitoría ───────────────────────────────
    monPlanA1 = await monitorPlanRepo.save(monitorPlanRepo.create({
      monitorId: users.monitoraA1.id, nodoId: NODO_A, vigencia: '2026-1',
    }));
    monPlanA2 = await monitorPlanRepo.save(monitorPlanRepo.create({
      monitorId: users.monitoraA2.id, nodoId: NODO_A, vigencia: '2026-1',
    }));
    monPlanB = await monitorPlanRepo.save(monitorPlanRepo.create({
      monitorId: users.monitoraB.id, nodoId: NODO_B, vigencia: '2026-1',
    }));
    // Plan creado CON nodo; el test le retirará el nodo al perfil después.
    monPlanExnodo = await monitorPlanRepo.save(monitorPlanRepo.create({
      monitorId: users.monitoraExnodo.id, nodoId: NODO_A, vigencia: '2026-1',
    }));

    // Semana 1 de la monitora A1 con 10 h: deja 2 h antes del tope.
    // La semana debe existir como entidad: el DTO exige weekId, no weekNumber.
    monWeekA1 = await monitorWeekRepo.save(monitorWeekRepo.create({
      workPlanId: monPlanA1.id, weekNumber: 1,
      startDate: '2026-02-02', endDate: '2026-02-06',
    }));
    await monitorActivityRepo.save(monitorActivityRepo.create({
      workPlanId: monPlanA1.id, weekId: monWeekA1.id, weekNumber: 1,
      description: 'Acompañamiento en sala', hours: 10,
    }));

    // ── Obtener tokens JWT ─────────────────────────────────────────
    for (const [key, u] of Object.entries(users)) {
      tokens[key] = await loginAs(u.email);
    }
  });

  afterAll(async () => {
    try {
      // Las actividades caen en cascada al borrar el plan de monitoría
      const monPlanIds = [monPlanA1, monPlanA2, monPlanB, monPlanExnodo].filter(Boolean).map(p => p.id);
      if (monPlanIds.length) await monitorPlanRepo.delete(monPlanIds);

      const planIds = [planA, planB, planDocente].filter(Boolean).map(p => p.id);
      if (planIds.length) await planRepo.delete(planIds);

      if (unitB) await unitRepo.delete(unitB.id);

      const itemIds = [itemA, itemB].filter(Boolean).map(i => i.id);
      if (itemIds.length) await itemRepo.delete(itemIds);

      const catIds = [catA, catB].filter(Boolean).map(c => c.id);
      if (catIds.length) await categoryRepo.delete(catIds);

      const userIds = Object.values(users).map(u => u.id);
      if (userIds.length) await userRepo.delete(userIds);
    } finally {
      await app.close();
    }
  });

  // ══════════════════════════════════════════════════════════
  // ESCALADA DE PRIVILEGIOS
  // ══════════════════════════════════════════════════════════

  it('1. POST /auth/register con role:admin NO crea admin', async () => {
    const email = `hacker.${Date.now()}@sec.test`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Hacker', email, password: 'HackPass123!', role: 'admin' });

    // Con forbidNonWhitelisted:true → 400 (campo extra rechazado)
    // Con whitelist:true → 201 (campo ignorado, role='docente')
    // En ambos casos el usuario NO queda como admin
    expect([400, 201]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.user.role).toBe('docente');
      await userRepo.delete(res.body.user.id).catch(() => {});
    }
  });

  it('2. Docente: PATCH /users/:id con role:admin → rol no cambia en BD', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${users.docente.id}`)
      .set('Authorization', `Bearer ${tokens.docente}`)
      .send({ role: 'admin' });

    // Independientemente del status HTTP, el rol en BD no debe haber cambiado
    const fresh = await userRepo.findOneBy({ id: users.docente.id });
    expect(fresh!.role).toBe(UserRole.DOCENTE);
  });

  it('3. Docente: PATCH /users/:id con nodoId ajeno → nodoId no cambia en BD', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${users.docente.id}`)
      .set('Authorization', `Bearer ${tokens.docente}`)
      .send({ nodoId: NODO_A });

    const fresh = await userRepo.findOneBy({ id: users.docente.id });
    expect(fresh!.nodoId).toBeNull();
  });

  it('4. Enlace: POST /users → 403 (solo admin puede crear usuarios)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .send({ name: 'Nuevo', email: 'nuevo@sec.test', password: 'Pass123!', role: 'docente' });

    expect(res.status).toBe(403);
  });

  // ══════════════════════════════════════════════════════════
  // AISLAMIENTO POR NODO — INVENTARIO
  // ══════════════════════════════════════════════════════════

  it('5. Enlace A: GET /inventory/items → ve itemA, NO ve itemB (nodo ajeno)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${tokens.enlaceA}`);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.map((i: any) => i.id);
    expect(ids).toContain(itemA.id);
    expect(ids).not.toContain(itemB.id);
  });

  it('6. Enlace A: GET /inventory/items/:itemB → 403 (ítem de otro nodo)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/inventory/items/${itemB.id}`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`);

    expect(res.status).toBe(403);
  });

  it('7a. Enlace sin nodo: GET /inventory/summary → zeros (no expone todo el inventario)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/summary')
      .set('Authorization', `Bearer ${tokens.enlaceNull}`);

    expect(res.status).toBe(200);
    expect(res.body.total_items).toBe(0);
    expect(res.body.total_units).toBe(0);
  });

  it('7b. Enlace sin nodo: GET /inventory/categories → [] (no expone categorías ajenas)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/categories')
      .set('Authorization', `Bearer ${tokens.enlaceNull}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('7c. Enlace sin nodo: GET /inventory/loans → [] (no expone préstamos ajenos)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/loans')
      .set('Authorization', `Bearer ${tokens.enlaceNull}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('8. Enlace A: POST /inventory/units/:unitB/movements → 403 (unidad de otro nodo)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/inventory/units/${unitB.id}/movements`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .send({ movementType: 'cambio_estado', movementDate: '2026-01-15' });

    expect(res.status).toBe(403);
  });

  // ══════════════════════════════════════════════════════════
  // MATRIZ DE PERMISOS — INVENTARIO
  // ══════════════════════════════════════════════════════════

  it('9. Docente: GET /inventory/items → 403 (sin acceso al módulo)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${tokens.docente}`);

    expect(res.status).toBe(403);
  });

  it('10. Vicerrector académico: GET /inventory/items → 403 (sin acceso al módulo)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${tokens.viceAcad}`);

    expect(res.status).toBe(403);
  });

  // ══════════════════════════════════════════════════════════
  // VISIBILIDAD DE PLANES DE TRABAJO
  // ══════════════════════════════════════════════════════════

  it('11a. Docente: GET /workplan/:planA → 403 (plan de otro usuario)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/workplan/${planA.id}`)
      .set('Authorization', `Bearer ${tokens.docente}`);

    expect(res.status).toBe(403);
  });

  it('11b. Docente: GET /workplan/:planDocente → 200 (su propio plan)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/workplan/${planDocente.id}`)
      .set('Authorization', `Bearer ${tokens.docente}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(planDocente.id);
  });

  it('12. Decano A: GET /workplan → ve planA (Facultad A), NO ve planB (Facultad B)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workplan')
      .set('Authorization', `Bearer ${tokens.decanoA}`);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.map((p: any) => p.id);
    expect(ids).toContain(planA.id);
    expect(ids).not.toContain(planB.id);
  });

  it('13. ViceExt: GET /workplan → ve planes de enlace, NO ve planDocente', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workplan')
      .set('Authorization', `Bearer ${tokens.viceExt}`);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.map((p: any) => p.id);
    expect(ids).toContain(planA.id);
    expect(ids).toContain(planB.id);
    expect(ids).not.toContain(planDocente.id);
  });

  // ══════════════════════════════════════════════════════════
  // ACCESOS INTENCIONALES
  // ══════════════════════════════════════════════════════════

  it('14. ViceExt: GET /activities → 200 (acceso intencional al módulo)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/activities')
      .set('Authorization', `Bearer ${tokens.viceExt}`);

    expect(res.status).toBe(200);
  });

  it('15a. Docente: GET /users → 403 (solo admin lista usuarios)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${tokens.docente}`);

    expect(res.status).toBe(403);
  });

  it('15b. Admin: GET /users → 200 (acceso correcto)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${tokens.admin}`);

    expect(res.status).toBe(200);
  });

  // ══════════════════════════════════════════════════════════
  // MONITORÍAS — aislamiento por monitora y por nodo
  // ══════════════════════════════════════════════════════════

  it('16. Monitora A1: GET /monitors/me/plan → 200 y es SU plan', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/monitors/me/plan?vigencia=2026-1')
      .set('Authorization', `Bearer ${tokens.monitoraA1}`);

    expect(res.status).toBe(200);
    expect(res.body.monitorId).toBe(users.monitoraA1.id);
    expect(res.body.id).toBe(monPlanA1.id);
  });

  it('17. Monitora A1: GET plan de la monitora A2 → 403 (mismo nodo, otra persona)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/monitors/plans/${monPlanA2.id}`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`);

    expect(res.status).toBe(403);
  });

  it('18. Monitora A1: GET /monitors → 403 (no lista a sus compañeras)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/monitors')
      .set('Authorization', `Bearer ${tokens.monitoraA1}`);

    expect(res.status).toBe(403);
  });

  it('19a. Enlace A: GET plan de monitora de SU nodo → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/monitors/plans/${monPlanA1.id}`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`);

    expect(res.status).toBe(200);
  });

  it('19b. Enlace B: GET plan de monitora del nodo A → 403 (aislamiento por nodo)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/monitors/plans/${monPlanA1.id}`)
      .set('Authorization', `Bearer ${tokens.enlaceB}`);

    expect(res.status).toBe(403);
  });

  it('19c. Enlace sin nodo: GET /monitors → [] (no expone monitoras ajenas)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/monitors')
      .set('Authorization', `Bearer ${tokens.enlaceNull}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('20. Enlace A: GET /monitors → solo monitoras del nodo A', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/monitors')
      .set('Authorization', `Bearer ${tokens.enlaceA}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(users.monitoraA1.id);
    expect(ids).toContain(users.monitoraA2.id);
    expect(ids).not.toContain(users.monitoraB.id);
  });

  it.each([
    ['docente',                'docente'],
    ['vicerrector_extension',  'viceExt'],
    ['vicerrector_academico',  'viceAcad'],
    ['decano',                 'decanoA'],
  ])('21. %s: GET /monitors → 403 (módulo cerrado a supervisión académica)',
    async (_role, tokenKey) => {
      const res = await request(app.getHttpServer())
        .get('/api/monitors')
        .set('Authorization', `Bearer ${tokens[tokenKey]}`);

      expect(res.status).toBe(403);
    });

  // ══════════════════════════════════════════════════════════
  // MONITORÍAS — tope semanal y firma
  // ══════════════════════════════════════════════════════════

  // Ojo: estos tests mandan weekId (lo que exige el DTO). Si mandaran
  // weekNumber morirían en el ValidationPipe y los 400 pasarían por la razón
  // equivocada, sin llegar nunca a tocar la lógica del tope.

  it('22z. La petición del tope llega al servicio (no muere en validación)', async () => {
    // Control: mismo payload, 1 h → debe pasar. Si esto diera 400, los tests
    // de abajo estarían midiendo el ValidationPipe y no el tope.
    const res = await request(app.getHttpServer())
      .post(`/api/monitors/plans/${monPlanA1.id}/activities`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`)
      .send({ weekId: monWeekA1.id, description: 'Tarea normal', hours: 1 });

    expect(res.status).toBe(201);
    // Limpieza: deja la semana otra vez en 10 h para los tests siguientes
    await monitorActivityRepo.delete(res.body.id);
  });

  it('22a. Monitora A1: actividad que rompe el tope de 12 h → 400', async () => {
    // La semana 1 ya tiene 10 h sembradas: 10 + 2.5 = 12.5 > 12
    const res = await request(app.getHttpServer())
      .post(`/api/monitors/plans/${monPlanA1.id}/activities`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`)
      .send({ weekId: monWeekA1.id, description: 'Horas extra', hours: 2.5 });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('tope');
  });

  it('22b. Monitora A1: no se salta el tope mandando overrideNote → 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/monitors/plans/${monPlanA1.id}/activities`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`)
      .send({
        weekId: monWeekA1.id, description: 'Horas extra', hours: 2.5,
        overrideNote: 'me autorizo yo misma',
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('tope');
  });

  it('22c. Enlace A: SÍ autoriza la semana con justificación → 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/monitors/plans/${monPlanA1.id}/activities`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .send({
        weekId: monWeekA1.id, description: 'Jornada especial del nodo', hours: 2.5,
        overrideNote: 'Autorizado por cierre de semestre',
      });

    expect(res.status).toBe(201);
    expect(res.body.overrideNote).toBe('Autorizado por cierre de semestre');
    expect(res.body.weekId).toBe(monWeekA1.id);

    // Limpieza: la semana vuelve a 10 h
    await monitorActivityRepo.delete(res.body.id);
  });

  it('22d. Enlace A: sin justificación tampoco pasa del tope → 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/monitors/plans/${monPlanA1.id}/activities`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .send({ weekId: monWeekA1.id, description: 'Sin nota', hours: 2.5 });

    expect(res.status).toBe(400);
  });

  it('22e. Monitora A1: no puede colgar tareas de la semana de otro plan → 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/monitors/plans/${monPlanA2.id}/activities`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`)
      .send({ weekId: monWeekA1.id, description: 'Plan ajeno', hours: 1 });

    expect(res.status).toBe(403);   // ni siquiera llega a mirar la semana
  });

  // ── Vigencia: el query de un GET que CREA filas ───────────

  it.each([
    ['texto libre',      'primer-semestre'],
    ['semestre inválido', '2026-3'],
    ['muy larga',        'x'.repeat(300)],
  ])('22i. Monitora A1: vigencia %s → 400 y no siembra plan', async (_label, vigencia) => {
    const antes = await monitorPlanRepo.count({ where: { monitorId: users.monitoraA1.id } });

    const res = await request(app.getHttpServer())
      .get(`/api/monitors/me/plan?vigencia=${encodeURIComponent(vigencia)}`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`);

    expect(res.status).toBe(400);

    // Lo que de verdad importa: no quedó un plan basura en la base
    const despues = await monitorPlanRepo.count({ where: { monitorId: users.monitoraA1.id } });
    expect(despues).toBe(antes);
  });

  it('22j. Enlace A: vigencia inválida en el plan de una monitora → 400', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/monitors/${users.monitoraA1.id}/plan?vigencia=basura`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`);

    expect(res.status).toBe(400);
  });

  // ── Retirada del nodo (no solo cambio) ────────────────────
  // Antes de tener plan, assertHasNodo ya cortaba. El flanco es la monitora
  // que YA tenía plan y a la que luego le quitan el nodo: sin este corte
  // seguiría registrando horas que ningún enlace puede ver ni certificar.

  it('22f. Monitora Exnodo: con nodo asignado ve su plan → 200 (línea base)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/monitors/me/plan?vigencia=2026-1')
      .set('Authorization', `Bearer ${tokens.monitoraExnodo}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(monPlanExnodo.id);
  });

  it('22g. Le RETIRAN el nodo: su plan se bloquea con 400 y deja de acumular horas', async () => {
    await userRepo.update({ id: users.monitoraExnodo.id }, { nodoId: null, nodoName: null });
    try {
      // Lectura de su propio plan
      const mine = await request(app.getHttpServer())
        .get('/api/monitors/me/plan?vigencia=2026-1')
        .set('Authorization', `Bearer ${tokens.monitoraExnodo}`);
      expect(mine.status).toBe(400);
      expect(JSON.stringify(mine.body.message)).toContain('nodo');

      // Lectura del plan por id
      const byId = await request(app.getHttpServer())
        .get(`/api/monitors/plans/${monPlanExnodo.id}`)
        .set('Authorization', `Bearer ${tokens.monitoraExnodo}`);
      expect(byId.status).toBe(400);

      // Escritura: no puede seguir creando semanas ni horas
      const write = await request(app.getHttpServer())
        .post(`/api/monitors/plans/${monPlanExnodo.id}/weeks`)
        .set('Authorization', `Bearer ${tokens.monitoraExnodo}`)
        .send({ weekNumber: 3, startDate: '2026-03-02', endDate: '2026-03-06' });
      expect(write.status).toBe(400);

      // El plan quedó efectivamente huérfano: por eso se bloquea
      const fresh = await monitorPlanRepo.findOne({ where: { id: monPlanExnodo.id } });
      expect(fresh?.nodoId ?? null).toBeNull();
    } finally {
      await userRepo.update(
        { id: users.monitoraExnodo.id }, { nodoId: NODO_A, nodoName: 'Nodo A' },
      );
    }
  });

  it('22h. Al devolverle el nodo, el plan vuelve a funcionar → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/monitors/me/plan?vigencia=2026-1')
      .set('Authorization', `Bearer ${tokens.monitoraExnodo}`);

    expect(res.status).toBe(200);
    expect(res.body.nodoId).toBe(NODO_A);   // resincronizado desde el perfil
  });

  it('23a. Monitora A1: PATCH /monitors/me/signature → 403 (no firma certificados)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/monitors/me/signature')
      .set('Authorization', `Bearer ${tokens.monitoraA1}`)
      .send({ signatureUrl: 'https://cdn.sec.test/firma-falsa.png' });

    expect(res.status).toBe(403);

    const fresh = await userRepo.findOne({ where: { id: users.monitoraA1.id } });
    expect(fresh?.signatureUrl ?? null).toBeNull();
  });

  it('23b. Monitora A1: no puede colar signatureUrl por PATCH /users/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${users.monitoraA1.id}`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`)
      .send({ signatureUrl: 'https://cdn.sec.test/firma-falsa.png' });

    expect(res.status).toBeGreaterThanOrEqual(400);

    const fresh = await userRepo.findOne({ where: { id: users.monitoraA1.id } });
    expect(fresh?.signatureUrl ?? null).toBeNull();
  });

  // ══════════════════════════════════════════════════════════
  // MONITORÍAS — documentos
  // ══════════════════════════════════════════════════════════

  it('24a. Enlace B: Excel del plan de una monitora del nodo A → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/monitors/${monPlanA1.id}/excel`)
      .set('Authorization', `Bearer ${tokens.enlaceB}`);

    expect(res.status).toBe(403);
  });

  it('24b. Enlace B: certificado de una monitora del nodo A → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/monitors/${monPlanA1.id}/certificado/pdf?from=1&to=8`)
      .set('Authorization', `Bearer ${tokens.enlaceB}`);

    expect(res.status).toBe(403);
  });

  it('24e. Monitora A1: certificado de SU PROPIO plan → 403', async () => {
    // Puede leer su plan, pero el certificado lo firma el enlace: si la
    // monitora pudiera generarlo, se autoexpediría un documento de pago con
    // la firma escaneada de su enlace.
    const res = await request(app.getHttpServer())
      .get(`/api/reports/monitors/${monPlanA1.id}/certificado/pdf?from=1&to=8`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`);

    expect(res.status).toBe(403);
    expect(res.headers['content-type']).not.toContain('application/pdf');
  });

  it('24f. Monitora A1: el Excel de SU plan sí lo puede descargar → 200', async () => {
    // Contraste con el 24e: el plan de trabajo no es un documento firmado.
    const res = await request(app.getHttpServer())
      .get(`/api/reports/monitors/${monPlanA1.id}/excel`)
      .set('Authorization', `Bearer ${tokens.monitoraA1}`)
      .buffer(true);

    expect(res.status).toBe(200);
  });

  it('24c. Docente: certificado de cualquier monitora → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/monitors/${monPlanA1.id}/certificado/pdf?from=1&to=8`)
      .set('Authorization', `Bearer ${tokens.docente}`);

    expect(res.status).toBe(403);
  });

  it('24d. Enlace A: certificado de SU nodo → 200 y devuelve un PDF', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/monitors/${monPlanA1.id}/certificado/pdf?from=1&to=8`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  // ══════════════════════════════════════════════════════════
  // REGISTRO DE ACTIVIDADES — activa la ESCRITURA del rol auxiliar
  // Modelo: un DÍA contiene varias ACTIVIDADES.
  // ══════════════════════════════════════════════════════════

  /** Ids del catálogo y del día de trabajo, sembrados por los tests 25. */
  let functionId = '';
  let functionId2 = '';
  let typeId = '';
  let dayIdA = '';

  it('25a. Auxiliar A: lee el catálogo de funciones (10 oficiales)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auxiliary/functions')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    functionId  = res.body[0].id;
    functionId2 = res.body[1].id;

    const tipos = await request(app.getHttpServer())
      .get('/api/auxiliary/participation-types')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`);
    expect(tipos.body).toHaveLength(8);
    typeId = tipos.body[0].id;
  });

  it('25b. Auxiliar A: abre un día y el nodo sale de SU perfil', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({ logDate: '2026-08-03' });

    expect(res.status).toBe(201);
    expect(res.body.auxiliaryId).toBe(users.auxiliarA.id);
    expect(res.body.nodoId).toBe(NODO_A);
    dayIdA = res.body.id;
  });

  it('25c. La fecha NO se duplica: reabrir el día devuelve el mismo', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({ logDate: '2026-08-03' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(dayIdA);
  });

  it('25d. Auxiliar A: agrega una actividad con VARIAS funciones', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/auxiliary/days/${dayIdA}/activities`)
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({
        description: 'Acompañamiento en sala y registro de asistencia',
        hours: 4,
        functionIds: [functionId, functionId2],
        typeIds: [typeId],
      });

    expect(res.status).toBe(201);
    expect(res.body.dayId).toBe(dayIdA);
    expect(res.body.functions).toHaveLength(2);
    expect(res.body.types).toHaveLength(1);
  });

  it('25e. Auxiliar A: no puede colar auxiliaryId ni nodoId por el body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({
        logDate: '2026-08-09',
        auxiliaryId: users.auxiliarB.id, nodoId: NODO_B,
      });

    // El ValidationPipe los rechaza por no estar en el DTO
    expect(res.status).toBe(400);
  });

  it('25f. Auxiliar A: rechaza funciones inventadas → 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/auxiliary/days/${dayIdA}/activities`)
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({
        description: 'Con función falsa', functionIds: [NODO_B],   // uuid válido, no del catálogo
      });

    expect(res.status).toBe(400);
  });

  it.each([
    ['docente',                'docente'],
    ['monitor',                'monitoraA1'],
    ['vicerrector_extension',  'viceExt'],
    ['decano',                 'decanoA'],
  ])('25g. %s: GET /auxiliary/functions → 403 (módulo cerrado)',
    async (_role, tokenKey) => {
      const res = await request(app.getHttpServer())
        .get('/api/auxiliary/functions')
        .set('Authorization', `Bearer ${tokens[tokenKey]}`);

      expect(res.status).toBe(403);
    });

  it('26a. Enlace A: ve los días del auxiliar de SU nodo → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/auxiliary/${users.auxiliarA.id}/days?year=2026&month=8`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`);

    expect(res.status).toBe(200);
    expect(res.body.days.length).toBeGreaterThan(0);
    // Un día = un bloque: la fecha no se repite por actividad
    expect(res.body.days[0].activities.length).toBeGreaterThan(0);
  });

  it('26b. Enlace B: NO ve los días del auxiliar del nodo A → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/auxiliary/${users.auxiliarA.id}/days?year=2026&month=8`)
      .set('Authorization', `Bearer ${tokens.enlaceB}`);

    expect(res.status).toBe(403);
  });

  it('26c. Auxiliar B: NO ve los días del auxiliar A → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/auxiliary/${users.auxiliarA.id}/days?year=2026&month=8`)
      .set('Authorization', `Bearer ${tokens.auxiliarB}`);

    expect(res.status).toBe(403);
  });

  it('26d. Auxiliar A: NO lista a sus pares → 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auxiliary')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`);

    expect(res.status).toBe(403);
  });

  it('26e. Enlace A: lista solo auxiliares de su nodo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auxiliary')
      .set('Authorization', `Bearer ${tokens.enlaceA}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((a: { id: string }) => a.id);
    expect(ids).toContain(users.auxiliarA.id);
    expect(ids).not.toContain(users.auxiliarB.id);
  });

  it('26f. Enlace sin nodo: lista vacía, no expone auxiliares ajenos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auxiliary')
      .set('Authorization', `Bearer ${tokens.enlaceNull}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('27a. Enlace A: NO abre días ni escribe actividades de su auxiliar → 403', async () => {
    // El registro debe reflejar lo que el auxiliar declara
    const dia = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .send({ logDate: '2026-08-05' });
    expect(dia.status).toBe(403);

    const act = await request(app.getHttpServer())
      .post(`/api/auxiliary/days/${dayIdA}/activities`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .send({ description: 'Escrito por el enlace', functionIds: [functionId] });
    expect(act.status).toBe(403);
  });

  it('27b. Admin: tampoco escribe registros de auxiliar → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ logDate: '2026-08-05' });

    expect(res.status).toBe(403);
  });

  it('27c. Auxiliar A: solo ve enganchables de SU nodo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auxiliary/linkable')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('activities');
    expect(res.body).toHaveProperty('processes');
  });

  it('28a. Auxiliar A: reporte mensual propio → 200 y es un PDF', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/auxiliary/${users.auxiliarA.id}/mensual/pdf?year=2026&month=8`)
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('28b. Enlace A: reporte del auxiliar de su nodo → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/auxiliary/${users.auxiliarA.id}/mensual/pdf?year=2026&month=8`)
      .set('Authorization', `Bearer ${tokens.enlaceA}`)
      .buffer(true);

    expect(res.status).toBe(200);
  });

  it('28c. Enlace B: reporte de un auxiliar de OTRO nodo → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/auxiliary/${users.auxiliarA.id}/mensual/pdf?year=2026&month=8`)
      .set('Authorization', `Bearer ${tokens.enlaceB}`);

    expect(res.status).toBe(403);
    expect(res.headers['content-type']).not.toContain('application/pdf');
  });

  it('28d. Docente: reporte de cualquier auxiliar → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/auxiliary/${users.auxiliarA.id}/mensual/pdf?year=2026&month=8`)
      .set('Authorization', `Bearer ${tokens.docente}`);

    expect(res.status).toBe(403);
  });

  it('29. Al auxiliar A le RETIRAN el nodo: deja de poder registrar → 400', async () => {
    await userRepo.update({ id: users.auxiliarA.id }, { nodoId: null, nodoName: null });
    try {
      const escritura = await request(app.getHttpServer())
        .post('/api/auxiliary/days')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ logDate: '2026-08-20' });
      expect(escritura.status).toBe(400);
      expect(JSON.stringify(escritura.body.message)).toContain('nodo');

      const lectura = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=8')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(lectura.status).toBe(400);
    } finally {
      await userRepo.update(
        { id: users.auxiliarA.id }, { nodoId: NODO_A, nodoName: 'Nodo A' },
      );
    }
  });

  it('30. Mes A CABALLO entre dos nodos: cada enlace ve solo lo suyo', async () => {
    // Escenario real: traslado a mitad de período. El auxiliar registra
    // unos días en el nodo A, lo trasladan al B y sigue registrando allí.
    const creados: string[] = [];
    try {
      // ── Trabajo hecho mientras estaba en el nodo A ──
      const diaA = await request(app.getHttpServer())
        .post('/api/auxiliary/days')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ logDate: '2026-09-03' });
      expect(diaA.status).toBe(201);
      expect(diaA.body.nodoId).toBe(NODO_A);
      creados.push(diaA.body.id);

      await request(app.getHttpServer())
        .post(`/api/auxiliary/days/${diaA.body.id}/activities`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ description: 'Trabajo en A', hours: 5, functionIds: [functionId] });

      // ── Traslado al nodo B ──
      await userRepo.update(
        { id: users.auxiliarA.id }, { nodoId: NODO_B, nodoName: 'Nodo B' },
      );

      const diaB = await request(app.getHttpServer())
        .post('/api/auxiliary/days')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ logDate: '2026-09-20' });
      expect(diaB.status).toBe(201);
      expect(diaB.body.nodoId).toBe(NODO_B);   // el día nuevo es del nodo nuevo
      creados.push(diaB.body.id);

      await request(app.getHttpServer())
        .post(`/api/auxiliary/days/${diaB.body.id}/activities`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ description: 'Trabajo en B', hours: 6, functionIds: [functionId] });

      // ── El enlace del nodo A conserva SU histórico ──
      const vistaA = await request(app.getHttpServer())
        .get(`/api/auxiliary/${users.auxiliarA.id}/days?year=2026&month=9`)
        .set('Authorization', `Bearer ${tokens.enlaceA}`);

      expect(vistaA.status).toBe(200);
      expect(vistaA.body.days).toHaveLength(1);
      expect(vistaA.body.days[0].activities[0].description).toBe('Trabajo en A');
      expect(vistaA.body.nodos.map((n: { id: string }) => n.id)).toEqual([NODO_A]);

      // ── El enlace del nodo B ve solo lo hecho con él ──
      const vistaB = await request(app.getHttpServer())
        .get(`/api/auxiliary/${users.auxiliarA.id}/days?year=2026&month=9`)
        .set('Authorization', `Bearer ${tokens.enlaceB}`);

      expect(vistaB.status).toBe(200);
      expect(vistaB.body.days).toHaveLength(1);
      expect(vistaB.body.days[0].activities[0].description).toBe('Trabajo en B');
      expect(vistaB.body.nodos.map((n: { id: string }) => n.id)).toEqual([NODO_B]);

      // ── El auxiliar ve su mes entero, de los dos nodos ──
      const propio = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=9')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);

      expect(propio.status).toBe(200);
      expect(propio.body.days).toHaveLength(2);
      expect(propio.body.nodos).toHaveLength(2);   // el PDF no afirmará uno solo

      // ── El trasladado sigue en la lista del enlace de A ──
      const listaA = await request(app.getHttpServer())
        .get('/api/auxiliary')
        .set('Authorization', `Bearer ${tokens.enlaceA}`);
      expect(listaA.body.map((a: { id: string }) => a.id)).toContain(users.auxiliarA.id);

      // ── Y el reporte de cada enlace sale con SU parte ──
      for (const token of [tokens.enlaceA, tokens.enlaceB]) {
        const pdf = await request(app.getHttpServer())
          .get(`/api/reports/auxiliary/${users.auxiliarA.id}/mensual/pdf?year=2026&month=9`)
          .set('Authorization', `Bearer ${token}`)
          .buffer(true);
        expect(pdf.status).toBe(200);
        expect(pdf.headers['content-type']).toContain('application/pdf');
      }
    } finally {
      await userRepo.update(
        { id: users.auxiliarA.id }, { nodoId: NODO_A, nodoName: 'Nodo A' },
      );
      for (const id of creados) {
        await auxDayRepo.delete(id);
      }
    }
  });

  it('31. Auxiliar A: no puede registrar más de 24 h en un mismo día → 400', async () => {
    const dia = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({ logDate: '2026-08-15' });
    const dayId = dia.body.id;

    try {
      for (const horas of [12, 10]) {
        const r = await request(app.getHttpServer())
          .post(`/api/auxiliary/days/${dayId}/activities`)
          .set('Authorization', `Bearer ${tokens.auxiliarA}`)
          .send({ description: `Jornada de ${horas}h`, hours: horas, functionIds: [functionId] });
        expect(r.status).toBe(201);
      }

      // 12 + 10 = 22 h; pedir 3 más dejaría el día en 25 h
      const excede = await request(app.getHttpServer())
        .post(`/api/auxiliary/days/${dayId}/activities`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ description: 'Extra', hours: 3, functionIds: [functionId] });

      expect(excede.status).toBe(400);
      expect(JSON.stringify(excede.body.message)).toContain('24');
    } finally {
      await auxDayRepo.delete(dayId);
    }
  });

  it('32. Filtro y paginación sobre los días', async () => {
    const dias: string[] = [];
    try {
      // Tres días con actividades distinguibles
      for (const [fecha, texto] of [
        ['2026-10-05', 'Taller de robotica'],
        ['2026-10-12', 'Gestion documental'],
        ['2026-10-19', 'Taller de lectura'],
      ] as const) {
        const d = await request(app.getHttpServer())
          .post('/api/auxiliary/days')
          .set('Authorization', `Bearer ${tokens.auxiliarA}`)
          .send({ logDate: fecha });
        dias.push(d.body.id);

        await request(app.getHttpServer())
          .post(`/api/auxiliary/days/${d.body.id}/activities`)
          .set('Authorization', `Bearer ${tokens.auxiliarA}`)
          .send({ description: texto, functionIds: [functionId] });
      }

      // Sin filtro: los tres
      const todos = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=10')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(todos.body.pagination.total).toBe(3);

      // Búsqueda por lo que se hizo
      const buscados = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=10&search=taller')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(buscados.body.pagination.total).toBe(2);

      // Paginación: 2 por página
      const p1 = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=10&page=1&pageSize=2')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(p1.body.days).toHaveLength(2);
      expect(p1.body.pagination.totalPages).toBe(2);
      // El resumen es del MES completo, no de la página
      expect(p1.body.summary.daysWithLog).toBe(3);

      const p2 = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=10&page=2&pageSize=2')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(p2.body.days).toHaveLength(1);

      // Rango de fechas
      const rango = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=10&from=2026-10-10&to=2026-10-15')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(rango.body.pagination.total).toBe(1);
    } finally {
      for (const id of dias) await auxDayRepo.delete(id);
    }
  });

  it('33. Borrar un día con actividades está bloqueado → 400', async () => {
    const dia = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({ logDate: '2026-11-04' });
    const dayId = dia.body.id;

    try {
      await request(app.getHttpServer())
        .post(`/api/auxiliary/days/${dayId}/activities`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ description: 'Algo que no se puede perder', functionIds: [functionId] });

      const bloqueado = await request(app.getHttpServer())
        .delete(`/api/auxiliary/days/${dayId}`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(bloqueado.status).toBe(400);
    } finally {
      await auxDayRepo.delete(dayId);
    }
  });
  it('34. RÁFAGA concurrente: el tope de 24 h aguanta peticiones simultáneas', async () => {
    // Sin candado sobre la fila del día, ocho peticiones a la vez leen las
    // mismas horas "ya registradas", todas se creen por debajo del tope y
    // entre todas meten 32 h en una jornada. Eso acaba impreso en el PDF
    // que firma el enlace.
    const dia = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({ logDate: '2026-12-07' });
    const dayId = dia.body.id;

    try {
      const RAFAGA = 8;
      const HORAS = 4;   // 8 × 4 = 32 h si no hay serialización

      const respuestas = await Promise.all(
        Array.from({ length: RAFAGA }, (_, i) =>
          request(app.getHttpServer())
            .post(`/api/auxiliary/days/${dayId}/activities`)
            .set('Authorization', `Bearer ${tokens.auxiliarA}`)
            .send({
              description: `Simultánea ${i}`, hours: HORAS, functionIds: [functionId],
            }),
        ),
      );

      const creadas    = respuestas.filter((r) => r.status === 201).length;
      const rechazadas = respuestas.filter((r) => r.status === 400).length;

      // Lo que de verdad importa: lo que quedó GRABADO en la base
      const vista = await request(app.getHttpServer())
        .get('/api/auxiliary/me/days?year=2026&month=12')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      const elDia = vista.body.days.find((d: { id: string }) => d.id === dayId);

      expect(elDia.totalHours).toBeLessThanOrEqual(24);
      expect(creadas).toBe(24 / HORAS);            // exactamente 6 caben
      expect(creadas + rechazadas).toBe(RAFAGA);   // ninguna dio 500
    } finally {
      const acts = await auxActRepo.find({ where: { dayId } });
      for (const a of acts) await auxActRepo.delete(a.id);
      await auxDayRepo.delete(dayId);
    }
  });

  it('35. TRASLADO: no se puede escribir hacia el nodo anterior', async () => {
    // Día registrado mientras estaba en el nodo A
    const dia = await request(app.getHttpServer())
      .post('/api/auxiliary/days')
      .set('Authorization', `Bearer ${tokens.auxiliarA}`)
      .send({ logDate: '2026-12-15' });
    const dayId = dia.body.id;
    expect(dia.body.nodoId).toBe(NODO_A);

    try {
      // Lo trasladan al nodo B
      await userRepo.update(
        { id: users.auxiliarA.id }, { nodoId: NODO_B, nodoName: 'Nodo B' },
      );

      const haciaAtras = await request(app.getHttpServer())
        .post(`/api/auxiliary/days/${dayId}/activities`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ description: 'Escrito tras el traslado', functionIds: [functionId] });

      expect(haciaAtras.status).toBe(403);
      expect(JSON.stringify(haciaAtras.body.message)).toMatch(/nodo actual/i);

      // Y borrar el día viejo tampoco
      const borrar = await request(app.getHttpServer())
        .delete(`/api/auxiliary/days/${dayId}`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`);
      expect(borrar.status).toBe(403);

      // En su nodo NUEVO sí puede registrar con normalidad
      const enElNuevo = await request(app.getHttpServer())
        .post('/api/auxiliary/days')
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ logDate: '2026-12-16' });
      expect(enElNuevo.status).toBe(201);
      expect(enElNuevo.body.nodoId).toBe(NODO_B);

      const act = await request(app.getHttpServer())
        .post(`/api/auxiliary/days/${enElNuevo.body.id}/activities`)
        .set('Authorization', `Bearer ${tokens.auxiliarA}`)
        .send({ description: 'En mi nodo actual', functionIds: [functionId] });
      expect(act.status).toBe(201);

      await auxActRepo.delete(act.body.id);
      await auxDayRepo.delete(enElNuevo.body.id);
    } finally {
      await userRepo.update(
        { id: users.auxiliarA.id }, { nodoId: NODO_A, nodoName: 'Nodo A' },
      );
      await auxDayRepo.delete(dayId);
    }
  });
});
