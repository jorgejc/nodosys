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

    // ── Obtener tokens JWT ─────────────────────────────────────────
    for (const [key, u] of Object.entries(users)) {
      tokens[key] = await loginAs(u.email);
    }
  });

  afterAll(async () => {
    try {
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
});
