/**
 * monitors.service.spec.ts — Permisos y tope semanal del módulo de Monitorías
 *
 * Cubre las dos reglas que sostienen el módulo:
 *   1. Aislamiento: quién puede ver/editar el plan de quién
 *   2. Tope de 12 h/semana: bloqueo para la monitora, autorización del enlace
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { MonitorsService } from './monitors.service';
import { MonitorWorkPlan } from './entities/monitor-work-plan.entity';
import { MonitorWeek } from './entities/monitor-week.entity';
import { MonitorWeekActivity } from './entities/monitor-week-activity.entity';
import { MonitorEvidence } from './entities/monitor-evidence.entity';
import { User, UserRole } from '../users/entities/user.entity';

const NODO_A = 'nodo-aaa';
const NODO_B = 'nodo-bbb';

/** Query builder falso: solo la parte que usa el bloqueo del tope semanal. */
interface LockQbMock {
  setLock: jest.Mock;
  where:   jest.Mock;
  getOne:  jest.Mock;
}

const makeUser = (role: UserRole, opts: { id?: string; nodoId?: string | null } = {}): User =>
  ({
    id:     opts.id     ?? 'uid-1',
    role,
    nodoId: opts.nodoId ?? null,
    name:   'Test',
    email:  'test@test.com',
  } as User);

// Ojo: nodoId usa `in` y no `??` para poder construir planes SIN nodo (null explícito)
const makePlan = (opts: { monitorId?: string; nodoId?: string | null } = {}): MonitorWorkPlan =>
  ({
    id:        'plan-1',
    monitorId: opts.monitorId ?? 'monitora-1',
    nodoId:    'nodoId' in opts ? opts.nodoId : NODO_A,
    vigencia:  '2026-1',
  } as MonitorWorkPlan);

describe('MonitorsService', () => {
  let service: MonitorsService;
  let planRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock; createQueryBuilder: jest.Mock };
  let weekRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let activityRepo: { find: jest.Mock; findOne: jest.Mock; count: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let evidenceRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock; softDelete: jest.Mock };
  let userRepo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    planRepo = {
      findOne: jest.fn(),
      save:    jest.fn((e) => Promise.resolve({ id: 'plan-nuevo', ...e })),
      create:  jest.fn((e) => e),
      update:  jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    weekRepo = {
      find:    jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save:    jest.fn((e) => Promise.resolve({ id: 'week-nueva', ...e })),
      create:  jest.fn((e) => e),
      delete:  jest.fn().mockResolvedValue({ affected: 1 }),
      // El bloqueo del tope hace SELECT ... FOR UPDATE por query builder;
      // el fake devuelve lo mismo que findOne para no duplicar mocks.
      createQueryBuilder: jest.fn((): LockQbMock => {
        let lockedId = '';
        const qb: LockQbMock = {
          setLock: jest.fn(() => qb),
          where:   jest.fn((_sql: string, params: { id: string }) => {
            lockedId = params.id;
            return qb;
          }),
          getOne:  jest.fn(() => weekRepo.findOne({ where: { id: lockedId } })),
        };
        return qb;
      }),
    };
    activityRepo = {
      find:    jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count:   jest.fn().mockResolvedValue(0),
      save:    jest.fn((e) => Promise.resolve({ id: 'act-1', ...e })),
      create:  jest.fn((e) => e),
      update:  jest.fn().mockResolvedValue({ affected: 1 }),
      delete:  jest.fn().mockResolvedValue({ affected: 1 }),
    };
    evidenceRepo = {
      find:       jest.fn().mockResolvedValue([]),
      findOne:    jest.fn(),
      save:       jest.fn((e) => Promise.resolve({ id: 'ev-1', ...e })),
      create:     jest.fn((e) => e),
      delete:     jest.fn().mockResolvedValue({ affected: 1 }),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepo = {
      find:    jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update:  jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // La transacción del tope se ejecuta contra un EntityManager falso que
    // reparte los mismos mocks de repositorio: así los tests siguen midiendo
    // la lógica del tope y no la transacción.
    const fakeManager = {
      getRepository: (entity: unknown) => {
        if (entity === MonitorWeekActivity) return activityRepo;
        if (entity === MonitorWeek)         return weekRepo;
        if (entity === MonitorEvidence)     return evidenceRepo;
        if (entity === MonitorWorkPlan)     return planRepo;
        return userRepo;
      },
    };
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorsService,
        { provide: getRepositoryToken(MonitorWorkPlan),     useValue: planRepo },
        { provide: getRepositoryToken(MonitorWeek),         useValue: weekRepo },
        { provide: getRepositoryToken(MonitorWeekActivity), useValue: activityRepo },
        { provide: getRepositoryToken(MonitorEvidence),     useValue: evidenceRepo },
        { provide: getRepositoryToken(User),                useValue: userRepo },
        { provide: getDataSourceToken(),                    useValue: dataSource },
      ],
    }).compile();

    service = module.get(MonitorsService);
  });

  // ══════════════════════════════════════════════════════════
  // 1. Puerta del módulo: solo monitor, enlace y admin
  // ══════════════════════════════════════════════════════════
  describe('assertModuleAccess — roles con acceso', () => {
    it.each([UserRole.MONITOR, UserRole.ENLACE, UserRole.ADMIN])(
      '%s entra al módulo', (role) => {
        expect(() => service.assertModuleAccess(makeUser(role))).not.toThrow();
      },
    );

    it.each([
      UserRole.DOCENTE, UserRole.AUXILIAR, UserRole.DECANO, UserRole.COORDINADOR,
      UserRole.VICERRECTOR_EXTENSION, UserRole.VICERRECTOR_ACADEMICO, UserRole.EQUIPO_EXTENSION,
    ])('%s recibe 403', (role) => {
      expect(() => service.assertModuleAccess(makeUser(role))).toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 2. Aislamiento por monitora y por nodo
  // ══════════════════════════════════════════════════════════
  describe('getPlanForRead — aislamiento', () => {
    it('la monitora ve su propio plan', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1' }));
      const user = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      await expect(service.getPlanForRead('plan-1', user)).resolves.toBeDefined();
    });

    it('la monitora NO ve el plan de otra monitora (aunque sea del mismo nodo)', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-2', nodoId: NODO_A }));
      const user = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      await expect(service.getPlanForRead('plan-1', user)).rejects.toThrow(ForbiddenException);
    });

    it('el enlace ve los planes de su nodo', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ nodoId: NODO_A }));
      const user = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.getPlanForRead('plan-1', user)).resolves.toBeDefined();
    });

    it('el enlace NO ve planes de otro nodo', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ nodoId: NODO_B }));
      const user = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.getPlanForRead('plan-1', user)).rejects.toThrow(ForbiddenException);
    });

    it('el enlace SIN nodo asignado no ve ningún plan', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ nodoId: NODO_A }));
      const user = makeUser(UserRole.ENLACE, { id: 'enlace-x', nodoId: null });
      await expect(service.getPlanForRead('plan-1', user)).rejects.toThrow(ForbiddenException);
    });

    it('un plan sin nodo tampoco se abre a un enlace cualquiera', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ nodoId: null }));
      const user = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.getPlanForRead('plan-1', user)).rejects.toThrow(ForbiddenException);
    });

    it('el admin ve cualquier plan', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ nodoId: NODO_B }));
      const user = makeUser(UserRole.ADMIN, { id: 'admin-1', nodoId: null });
      await expect(service.getPlanForRead('plan-1', user)).resolves.toBeDefined();
    });

    it('plan inexistente → 404', async () => {
      planRepo.findOne.mockResolvedValue(null);
      const user = makeUser(UserRole.ADMIN);
      await expect(service.getPlanForRead('plan-x', user)).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 3. Listado de monitoras
  // ══════════════════════════════════════════════════════════
  describe('listMonitors', () => {
    it('el enlace filtra por SU nodo', async () => {
      const user = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await service.listMonitors(user);
      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: UserRole.MONITOR, nodoId: NODO_A } }),
      );
    });

    it('el enlace sin nodo recibe lista vacía y no consulta usuarios', async () => {
      const user = makeUser(UserRole.ENLACE, { id: 'enlace-x', nodoId: null });
      await expect(service.listMonitors(user)).resolves.toEqual([]);
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    it('el admin no filtra por nodo', async () => {
      await service.listMonitors(makeUser(UserRole.ADMIN));
      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: UserRole.MONITOR } }),
      );
    });

    it('la monitora no puede listar a sus compañeras', async () => {
      const user = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      await expect(service.listMonitors(user)).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 4. Tope de 12 horas por semana
  // ══════════════════════════════════════════════════════════
  describe('addActivity — tope semanal de 12 h', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
    const enlace   = makeUser(UserRole.ENLACE,  { id: 'enlace-a',   nodoId: NODO_A });

    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
      // La semana elegida existe y pertenece al plan (flujo nuevo por weekId)
      weekRepo.findOne.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id, workPlanId: 'plan-1', weekNumber: 3 }));
    });

    it('la monitora puede llegar justo al tope (10 + 2 = 12)', async () => {
      activityRepo.find.mockResolvedValue([{ id: 'a1', hours: 10 }]);
      await expect(service.addActivity(
        'plan-1', { weekId: 'week-3', description: 'Taller', hours: 2 }, monitora,
      )).resolves.toBeDefined();
    });

    it('la monitora NO puede pasarse del tope (10 + 2.5 = 12.5) → 400', async () => {
      activityRepo.find.mockResolvedValue([{ id: 'a1', hours: 10 }]);
      await expect(service.addActivity(
        'plan-1', { weekId: 'week-3', description: 'Taller', hours: 2.5 }, monitora,
      )).rejects.toThrow(BadRequestException);
    });

    it('la monitora no se salta el tope mandando overrideNote', async () => {
      activityRepo.find.mockResolvedValue([{ id: 'a1', hours: 12 }]);
      await expect(service.addActivity(
        'plan-1',
        { weekId: 'week-3', description: 'Extra', hours: 3, overrideNote: 'me autorizo yo' },
        monitora,
      )).rejects.toThrow(BadRequestException);
    });

    it('el enlace tampoco puede pasarse SIN justificación → 400', async () => {
      activityRepo.find.mockResolvedValue([{ id: 'a1', hours: 12 }]);
      await expect(service.addActivity(
        'plan-1', { weekId: 'week-3', description: 'Extra', hours: 2 }, enlace,
      )).rejects.toThrow(BadRequestException);
    });

    it('el enlace SÍ puede pasarse dejando la justificación', async () => {
      activityRepo.find.mockResolvedValue([{ id: 'a1', hours: 12 }]);
      const saved = await service.addActivity(
        'plan-1',
        { weekId: 'week-3', description: 'Extra', hours: 2, overrideNote: 'Jornada especial del nodo' },
        enlace,
      );
      expect(saved).toMatchObject({ overrideNote: 'Jornada especial del nodo' });
    });

    it('la nota de la monitora nunca se persiste', async () => {
      activityRepo.find.mockResolvedValue([]);
      const saved = await service.addActivity(
        'plan-1',
        { weekId: 'week-1', description: 'Apoyo', hours: 2, overrideNote: 'nota mía' },
        monitora,
      );
      expect(saved).toMatchObject({ overrideNote: null });
    });

    it('las horas de otras semanas no cuentan para el tope', async () => {
      activityRepo.find.mockResolvedValue([]);   // el servicio filtra por weekNumber
      await expect(service.addActivity(
        'plan-1', { weekId: 'week-4', description: 'Otra semana', hours: 12 }, monitora,
      )).resolves.toBeDefined();
    });

    it('rechaza una semana que no pertenece al plan → 400', async () => {
      weekRepo.findOne.mockResolvedValue({ id: 'week-x', workPlanId: 'otro-plan', weekNumber: 2 });
      await expect(service.addActivity(
        'plan-1', { weekId: 'week-x', description: 'Ajena', hours: 1 }, monitora,
      )).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 4b. Semanas: creación, aislamiento y borrado
  // ══════════════════════════════════════════════════════════
  describe('createWeek / deleteWeek', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });

    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
    });

    it('la monitora crea una semana con su rango de fechas', async () => {
      weekRepo.findOne.mockResolvedValue(null);
      const week = await service.createWeek(
        'plan-1', { weekNumber: 5, startDate: '2026-02-01', endDate: '2026-02-05' }, monitora,
      );
      expect(week).toMatchObject({ workPlanId: 'plan-1', weekNumber: 5, startDate: '2026-02-01' });
    });

    it('rechaza fin anterior al inicio → 400', async () => {
      await expect(service.createWeek(
        'plan-1', { weekNumber: 5, startDate: '2026-02-05', endDate: '2026-02-01' }, monitora,
      )).rejects.toThrow(BadRequestException);
    });

    it('rechaza un número de semana duplicado → 400', async () => {
      weekRepo.findOne.mockResolvedValue({ id: 'week-5', workPlanId: 'plan-1', weekNumber: 5 });
      await expect(service.createWeek(
        'plan-1', { weekNumber: 5, startDate: '2026-02-01', endDate: '2026-02-05' }, monitora,
      )).rejects.toThrow(BadRequestException);
    });

    it('un enlace de otro nodo NO puede crear semanas en un plan ajeno', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ nodoId: NODO_B }));
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.createWeek(
        'plan-1', { weekNumber: 1, startDate: '2026-02-01', endDate: '2026-02-05' }, enlace,
      )).rejects.toThrow(ForbiddenException);
    });

    it('bloquea borrar una semana que todavía tiene tareas → 400', async () => {
      weekRepo.findOne.mockResolvedValue({ id: 'week-5', workPlanId: 'plan-1', weekNumber: 5 });
      activityRepo.count.mockResolvedValue(3);
      await expect(service.deleteWeek('week-5', monitora)).rejects.toThrow(BadRequestException);
      expect(weekRepo.delete).not.toHaveBeenCalled();
    });

    it('borra una semana vacía', async () => {
      weekRepo.findOne.mockResolvedValue({ id: 'week-5', workPlanId: 'plan-1', weekNumber: 5 });
      activityRepo.count.mockResolvedValue(0);
      await service.deleteWeek('week-5', monitora);
      expect(weekRepo.delete).toHaveBeenCalledWith('week-5');
    });
  });

  // ══════════════════════════════════════════════════════════
  // 4c. Evidencias: cuelgan de una tarea
  // ══════════════════════════════════════════════════════════
  describe('addEvidence — por tarea', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });

    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
    });

    it('asocia la evidencia a la tarea indicada', async () => {
      activityRepo.findOne.mockResolvedValue({ id: 'act-9', workPlanId: 'plan-1', weekNumber: 2 });
      const ev = await service.addEvidence(
        'plan-1', { activityId: 'act-9', fileUrl: 'https://drive/x' }, monitora,
      );
      expect(ev).toMatchObject({ activityId: 'act-9', workPlanId: 'plan-1', weekNumber: 2 });
    });

    it('rechaza una tarea que no pertenece al plan → 400', async () => {
      activityRepo.findOne.mockResolvedValue({ id: 'act-x', workPlanId: 'otro-plan', weekNumber: 2 });
      await expect(service.addEvidence(
        'plan-1', { activityId: 'act-x', fileUrl: 'https://drive/x' }, monitora,
      )).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 5. Creación de planes: nodo e identidad no vienen del body
  // ══════════════════════════════════════════════════════════
  describe('createPlan', () => {
    it('la monitora crea su plan con el nodo de SU perfil', async () => {
      const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      userRepo.findOne.mockResolvedValue({ ...monitora, role: UserRole.MONITOR, nodoId: NODO_A });
      planRepo.findOne.mockResolvedValue(null);

      const plan = await service.createPlan({ vigencia: '2026-1' }, monitora);
      expect(plan).toMatchObject({ monitorId: 'monitora-1', nodoId: NODO_A });
    });

    it('la monitora NO puede crear un plan a nombre de otra', async () => {
      const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      await expect(service.createPlan(
        { vigencia: '2026-1', monitorId: 'monitora-2' }, monitora,
      )).rejects.toThrow(ForbiddenException);
    });

    it('el enlace no tiene plan propio de monitoría', async () => {
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.createPlan({ vigencia: '2026-1' }, enlace))
        .rejects.toThrow(ForbiddenException);
    });

    it('no se duplica el plan de una misma vigencia', async () => {
      const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      userRepo.findOne.mockResolvedValue({ ...monitora, role: UserRole.MONITOR });
      planRepo.findOne.mockResolvedValue(makePlan());
      await expect(service.createPlan({ vigencia: '2026-1' }, monitora))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 6. Firma del enlace
  // ══════════════════════════════════════════════════════════
  describe('updateMySignature', () => {
    it('el enlace registra su firma sobre su propio usuario', async () => {
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await service.updateMySignature('https://cdn/firma.png', enlace);
      expect(userRepo.update).toHaveBeenCalledWith(
        { id: 'enlace-a' }, { signatureUrl: 'https://cdn/firma.png' },
      );
    });

    it('la monitora NO puede registrar firma', async () => {
      const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      await expect(service.updateMySignature('https://cdn/firma.png', monitora))
        .rejects.toThrow(ForbiddenException);
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('un docente ni siquiera entra al módulo', async () => {
      const docente = makeUser(UserRole.DOCENTE, { id: 'doc-1' });
      await expect(service.updateMySignature('https://cdn/firma.png', docente))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 7. Suma de horas del rango (base del certificado)
  // ══════════════════════════════════════════════════════════
  describe('getHoursRange', () => {
    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
    });

    it('suma solo las semanas del rango pedido', async () => {
      activityRepo.find.mockResolvedValue([
        { id: 'a1', weekNumber: 1, hours: 4,   weekLabel: null },
        { id: 'a2', weekNumber: 2, hours: 3.5, weekLabel: null },
        { id: 'a3', weekNumber: 5, hours: 8,   weekLabel: null },  // fuera del rango
      ]);
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });

      const result = await service.getHoursRange('plan-1', 1, 2, enlace);
      expect(result.totalHours).toBe(7.5);
      expect(result.weeks).toHaveLength(2);
    });

    it('rango invertido → 400', async () => {
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.getHoursRange('plan-1', 8, 2, enlace))
        .rejects.toThrow(BadRequestException);
    });

    it('un enlace de otro nodo no puede calcular horas ajenas', async () => {
      planRepo.findOne.mockResolvedValue(makePlan({ nodoId: NODO_B }));
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.getHoursRange('plan-1', 1, 8, enlace))
        .rejects.toThrow(ForbiddenException);
    });
  });
  // ══════════════════════════════════════════════════════════
  // 8. El nodo del plan sigue al perfil de la monitora
  // ══════════════════════════════════════════════════════════
  describe('nodoId del plan — no se congela', () => {
    it('sin nodo asignado NO se crea el plan (quedaría invisible al enlace)', async () => {
      const sinNodo = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: null });
      planRepo.findOne.mockResolvedValue(null);

      await expect(service.findOrCreateMyPlan(sinNodo, '2026-1'))
        .rejects.toThrow(BadRequestException);
      expect(planRepo.save).not.toHaveBeenCalled();
    });

    it('el admin tampoco crea un plan a una monitora sin nodo', async () => {
      const admin = makeUser(UserRole.ADMIN, { id: 'admin-1', nodoId: NODO_A });
      userRepo.findOne.mockResolvedValue(
        makeUser(UserRole.MONITOR, { id: 'monitora-9', nodoId: null }),
      );

      await expect(service.createPlan({ vigencia: '2026-1', monitorId: 'monitora-9' }, admin))
        .rejects.toThrow(BadRequestException);
      expect(planRepo.save).not.toHaveBeenCalled();
    });

    it('si la monitora cambió de nodo, el plan se resincroniza al leerlo', async () => {
      // Plan viejo con nodo A; la monitora ya está en el nodo B
      planRepo.findOne.mockResolvedValue({
        ...makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }),
        monitor: makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_B }),
      });

      const enlaceB = makeUser(UserRole.ENLACE, { id: 'enlace-b', nodoId: NODO_B });
      const plan = await service.getPlanForRead('plan-1', enlaceB);

      expect(plan.nodoId).toBe(NODO_B);
      expect(planRepo.update).toHaveBeenCalledWith({ id: 'plan-1' }, { nodoId: NODO_B });
    });

    it('si a la monitora le RETIRAN el nodo, su plan se bloquea al leerlo', async () => {
      // Plan creado cuando tenía nodo; ahora el perfil ya no tiene ninguno.
      planRepo.findOne.mockResolvedValue({
        ...makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }),
        monitor: makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: null }),
      });
      const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: null });

      await expect(service.getPlanForRead('plan-1', monitora))
        .rejects.toThrow(BadRequestException);
    });

    it('con el nodo retirado tampoco puede seguir escribiendo horas', async () => {
      planRepo.findOne.mockResolvedValue({
        ...makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }),
        monitor: makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: null }),
      });
      weekRepo.findOne.mockResolvedValue(null);
      const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: null });

      await expect(service.createWeek(
        'plan-1', { weekNumber: 2, startDate: '2026-03-02', endDate: '2026-03-06' }, monitora,
      )).rejects.toThrow(BadRequestException);
      expect(weekRepo.save).not.toHaveBeenCalled();
    });

    it('la monitora sin nodo no entra ni a su propio plan ya existente', async () => {
      // findOrCreateMyPlan no debe colarse por el camino de "el plan ya existe"
      const sinNodo = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: null });
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1' }));

      await expect(service.findOrCreateMyPlan(sinNodo, '2026-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('el admin SÍ puede abrir un plan sin nodo (es quien lo arregla)', async () => {
      planRepo.findOne.mockResolvedValue({
        ...makePlan({ monitorId: 'monitora-1', nodoId: null }),
        monitor: makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: null }),
      });
      const admin = makeUser(UserRole.ADMIN, { id: 'admin-1' });

      await expect(service.getPlanForRead('plan-1', admin)).resolves.toBeDefined();
    });

    it('tras el cambio de nodo, el enlace ANTERIOR pierde el acceso', async () => {
      planRepo.findOne.mockResolvedValue({
        ...makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }),
        monitor: makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_B }),
      });

      const enlaceA = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.getPlanForRead('plan-1', enlaceA))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 9. Semana ya autorizada por encima del tope
  // ══════════════════════════════════════════════════════════
  describe('updateActivity en una semana autorizada', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });

    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
      // Semana 3 autorizada en 20 h: 6 h de la monitora + 14 h del enlace
      activityRepo.findOne.mockResolvedValue({
        id: 'act-1', workPlanId: 'plan-1', weekId: 'week-3', weekNumber: 3,
        hours: 6, description: 'Apoyo', overrideNote: null,
      });
      activityRepo.find.mockResolvedValue([
        { id: 'act-1', hours: 6 },
        { id: 'act-2', hours: 14, overrideNote: 'Autorizado por el enlace' },
      ]);
    });

    it('la monitora PUEDE bajarse las horas aunque la semana siga sobre el tope', async () => {
      const saved = await service.updateActivity('act-1', { hours: 3 }, monitora);
      expect(saved).toMatchObject({ hours: 3 });
    });

    it('la monitora PUEDE corregir la descripción sin tocar las horas', async () => {
      const saved = await service.updateActivity('act-1', { description: 'Apoyo en sala' }, monitora);
      expect(saved).toMatchObject({ description: 'Apoyo en sala' });
    });

    it('pero NO puede subirse las horas → 400', async () => {
      await expect(service.updateActivity('act-1', { hours: 9 }, monitora))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 10. El tope se valida con la semana bloqueada
  // ══════════════════════════════════════════════════════════
  describe('serialización del tope', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });

    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
      weekRepo.findOne.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id, workPlanId: 'plan-1', weekNumber: 3 }));
      activityRepo.find.mockResolvedValue([]);
    });

    it('addActivity corre en transacción y bloquea la fila de la semana', async () => {
      await service.addActivity(
        'plan-1', { weekId: 'week-3', description: 'Taller', hours: 2 }, monitora,
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      const qb = weekRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  // ══════════════════════════════════════════════════════════
  // 10b. Tarea sin semana: no se escribe sin candado
  // ══════════════════════════════════════════════════════════
  describe('updateActivity sobre una tarea sin semana', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });

    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
      // Dato viejo: la tarea no está enlazada a ninguna semana
      activityRepo.findOne.mockResolvedValue({
        id: 'act-legacy', workPlanId: 'plan-1', weekId: null, weekNumber: 4,
        hours: 3, description: 'Tarea migrada', overrideNote: null,
      });
      activityRepo.find.mockResolvedValue([{ id: 'act-legacy', hours: 3 }]);
    });

    it('falla de forma controlada en vez de escribir sin bloquear la semana', async () => {
      await expect(service.updateActivity('act-legacy', { hours: 5 }, monitora))
        .rejects.toThrow(BadRequestException);
    });

    it('no guarda nada al fallar', async () => {
      await expect(service.updateActivity('act-legacy', { hours: 5 }, monitora))
        .rejects.toThrow(BadRequestException);
      expect(activityRepo.save).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // 10c. La vigencia del query no siembra planes basura
  // ══════════════════════════════════════════════════════════
  describe('validación de vigencia', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });

    beforeEach(() => planRepo.findOne.mockResolvedValue(null));

    it.each([
      ['texto libre',        'primer-semestre'],
      ['semestre inventado', '2026-3'],
      ['año incompleto',     '26-1'],
      ['cadena vacía',       ''],
      ['muy larga (rompe el VARCHAR 20)', '2026-1'.padEnd(300, 'x')],
      ['con inyección',      "2026-1'; DROP TABLE monitor_work_plans;--"],
    ])('rechaza %s y NO crea plan', async (_label, vigencia) => {
      await expect(service.findOrCreateMyPlan(monitora, vigencia))
        .rejects.toThrow(BadRequestException);
      expect(planRepo.save).not.toHaveBeenCalled();
    });

    it('acepta una vigencia con el formato correcto', async () => {
      // 1ª llamada: no existe plan para esa vigencia → se crea.
      // 2ª: findPlanDetail lo relee por id, ya creado.
      planRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));

      await expect(service.findOrCreateMyPlan(monitora, '2026-2')).resolves.toBeDefined();
      expect(planRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ vigencia: '2026-2', monitorId: 'monitora-1' }),
      );
    });

    it('findMonitorPlan también la valida', async () => {
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.findMonitorPlan('monitora-1', 'basura', enlace))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 10d. Renumerar una semana no puede saltarse el tope
  // ══════════════════════════════════════════════════════════
  describe('updateWeek — renumerar', () => {
    const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });

    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
      weekRepo.findOne.mockImplementation(({ where }: { where: { id?: string } }) =>
        where.id === 'week-5'
          ? Promise.resolve({ id: 'week-5', workPlanId: 'plan-1', weekNumber: 5,
                              startDate: '2026-02-02', endDate: '2026-02-06' })
          : Promise.resolve(null));   // el número destino está libre en monitor_weeks
    });

    it('bloquea la fusión con tareas huérfanas que rompería el tope', async () => {
      activityRepo.find.mockImplementation(({ where }: { where: { weekId?: string } }) =>
        where.weekId === 'week-5'
          // 8 h que se mueven...
          ? Promise.resolve([{ id: 'a1', hours: 8 }])
          // ...sobre 7 h que ya tenían el número 7 sin colgar de ninguna semana
          : Promise.resolve([{ id: 'huerfana', hours: 7 }]));

      await expect(service.updateWeek('week-5', { weekNumber: 7 }, monitora))
        .rejects.toThrow(BadRequestException);
      expect(activityRepo.update).not.toHaveBeenCalled();
      expect(weekRepo.save).not.toHaveBeenCalled();
    });

    it('permite renumerar una semana ya autorizada si el destino está vacío', async () => {
      // 20 h autorizadas por el enlace; mover 5 → 7 no empeora nada
      activityRepo.find.mockImplementation(({ where }: { where: { weekId?: string } }) =>
        where.weekId === 'week-5'
          ? Promise.resolve([{ id: 'a1', hours: 20 }])
          : Promise.resolve([]));

      await expect(service.updateWeek('week-5', { weekNumber: 7 }, monitora))
        .resolves.toBeDefined();
      expect(activityRepo.update).toHaveBeenCalledWith({ weekId: 'week-5' }, { weekNumber: 7 });
    });

    it('permite la fusión si el total resultante cabe en el tope', async () => {
      activityRepo.find.mockImplementation(({ where }: { where: { weekId?: string } }) =>
        where.weekId === 'week-5'
          ? Promise.resolve([{ id: 'a1', hours: 5 }])
          : Promise.resolve([{ id: 'huerfana', hours: 4 }]));

      await expect(service.updateWeek('week-5', { weekNumber: 7 }, monitora))
        .resolves.toBeDefined();
    });

    it('corre en transacción y bloquea la fila de la semana', async () => {
      activityRepo.find.mockResolvedValue([]);
      await service.updateWeek('week-5', { startDate: '2026-02-03' }, monitora);

      expect(dataSource.transaction).toHaveBeenCalled();
      const qb = weekRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  // ══════════════════════════════════════════════════════════
  // 11. Las evidencias no se destruyen
  // ══════════════════════════════════════════════════════════
  describe('deleteEvidence — borrado lógico', () => {
    it('marca la evidencia en vez de borrarla', async () => {
      const monitora = makeUser(UserRole.MONITOR, { id: 'monitora-1', nodoId: NODO_A });
      planRepo.findOne.mockResolvedValue(makePlan({ monitorId: 'monitora-1', nodoId: NODO_A }));
      evidenceRepo.findOne.mockResolvedValue({ id: 'ev-7', workPlanId: 'plan-1' });

      await service.deleteEvidence('ev-7', monitora);

      expect(evidenceRepo.softDelete).toHaveBeenCalledWith('ev-7');
      expect(evidenceRepo.delete).not.toHaveBeenCalled();
    });
  });
});
