/**
 * auxiliary.service.spec.ts — Registro de actividades del nodo
 *
 * Este módulo activa la ESCRITURA del rol auxiliar, así que lo primero que
 * hay que blindar es quién puede escribir qué y en qué nodo.
 *
 * Las ocho propiedades que sostienen el módulo, y que se verifican
 * rompiéndolas una a una:
 *   1. Solo el auxiliar escribe (ni enlace ni admin)
 *   2. El nodo sale del perfil, nunca del body
 *   3. El enlace ve solo los días de SU nodo
 *   4. El enlace conserva su histórico tras un traslado
 *   5. Sin nodo no se registra ni se lee
 *   6. Tope de 24 h por día
 *   7. Las evidencias no se destruyen
 *   8. Los catálogos rechazan ids inventados
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuxiliaryService } from './auxiliary.service';
import { AuxiliaryFunction } from './entities/auxiliary-function.entity';
import { ParticipationType } from './entities/participation-type.entity';
import { AuxiliaryDay } from './entities/auxiliary-day.entity';
import { AuxiliaryActivity } from './entities/auxiliary-activity.entity';
import { AuxiliaryEvidence } from './entities/auxiliary-evidence.entity';
import { ActivityRequest } from '../activities/entities/activity-request.entity';
import { Process } from '../processes/entities/process.entity';
import { Nodo } from '../nodos/entities/nodo.entity';
import { User, UserRole } from '../users/entities/user.entity';

const NODO_A = 'nodo-aaa';
const NODO_B = 'nodo-bbb';

const makeUser = (role: UserRole, opts: { id?: string; nodoId?: string | null } = {}): User =>
  ({
    id:     opts.id     ?? 'uid-1',
    role,
    nodoId: 'nodoId' in opts ? opts.nodoId : NODO_A,
    name:   'Test',
    email:  'test@test.com',
  } as User);

/** Query builder falso: solo lo que encadena el bloqueo del día. */
interface LockQbMock {
  setLock: jest.Mock;
  where:   jest.Mock;
  getOne:  jest.Mock;
}

const FN = { id: 'fn-1', name: 'Atención y acompañamiento' };
const TP = { id: 't-1',  name: 'Apoyo logístico' };

describe('AuxiliaryService', () => {
  let service: AuxiliaryService;
  let functionRepo: { find: jest.Mock; findOne: jest.Mock; count: jest.Mock; save: jest.Mock; create: jest.Mock };
  let typeRepo: { find: jest.Mock; findOne: jest.Mock; count: jest.Mock; save: jest.Mock; create: jest.Mock };
  let dayRepo: { find: jest.Mock; findOne: jest.Mock; count: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let actRepo: { find: jest.Mock; findOne: jest.Mock; count: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let evidenceRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; softDelete: jest.Mock; delete: jest.Mock };
  let activityRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let processRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let userRepo: { find: jest.Mock; findOne: jest.Mock };
  let nodoRepo: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const AUX = makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: NODO_A });
  const DIA = { id: 'day-1', auxiliaryId: 'aux-1', nodoId: NODO_A, logDate: '2026-08-06' };

  beforeEach(async () => {
    functionRepo = {
      find: jest.fn().mockResolvedValue([FN]), findOne: jest.fn().mockResolvedValue(FN),
      count: jest.fn().mockResolvedValue(1), save: jest.fn(), create: jest.fn((e) => e),
    };
    typeRepo = {
      find: jest.fn().mockResolvedValue([TP]), findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(1), save: jest.fn(), create: jest.fn((e) => e),
    };
    dayRepo = {
      find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), count: jest.fn().mockResolvedValue(0),
      save: jest.fn((e) => Promise.resolve({ id: 'day-nuevo', ...e })),
      create: jest.fn((e) => e), delete: jest.fn().mockResolvedValue({ affected: 1 }),
      // El candado del tope hace SELECT ... FOR UPDATE por query builder
      createQueryBuilder: jest.fn((): LockQbMock => {
        const b: LockQbMock = {
          setLock: jest.fn(() => b),
          where:   jest.fn(() => b),
          getOne:  jest.fn(() => dayRepo.findOne({ where: {} })),
        };
        return b;
      }),
    };
    actRepo = {
      find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), count: jest.fn().mockResolvedValue(0),
      save: jest.fn((e) => Promise.resolve({ id: 'act-1', ...e })),
      create: jest.fn((e) => e), delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    evidenceRepo = {
      find: jest.fn().mockResolvedValue([]), findOne: jest.fn(),
      save: jest.fn((e) => Promise.resolve({ id: 'ev-1', ...e })), create: jest.fn((e) => e),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }), delete: jest.fn(),
    };
    const qb = () => {
      const b: Record<string, jest.Mock> = {};
      for (const m of ['innerJoin', 'select', 'orderBy', 'limit', 'where']) b[m] = jest.fn(() => b);
      b.getMany = jest.fn().mockResolvedValue([]);
      return b;
    };
    activityRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn(qb) };
    processRepo  = { findOne: jest.fn(), createQueryBuilder: jest.fn(qb) };
    userRepo     = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    nodoRepo     = { find: jest.fn().mockResolvedValue([]) };

    // La transacción se ejecuta contra un EntityManager falso que reparte
    // los mismos mocks: así los tests siguen midiendo la lógica del tope.
    const fakeManager = {
      getRepository: (entity: unknown) => {
        if (entity === AuxiliaryActivity) return actRepo;
        if (entity === AuxiliaryDay)      return dayRepo;
        if (entity === AuxiliaryEvidence) return evidenceRepo;
        return userRepo;
      },
    };
    dataSource = { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuxiliaryService,
        { provide: getRepositoryToken(AuxiliaryFunction),  useValue: functionRepo },
        { provide: getRepositoryToken(ParticipationType),  useValue: typeRepo },
        { provide: getRepositoryToken(AuxiliaryDay),       useValue: dayRepo },
        { provide: getRepositoryToken(AuxiliaryActivity),  useValue: actRepo },
        { provide: getRepositoryToken(AuxiliaryEvidence),  useValue: evidenceRepo },
        { provide: getRepositoryToken(ActivityRequest),    useValue: activityRepo },
        { provide: getRepositoryToken(Process),            useValue: processRepo },
        { provide: getRepositoryToken(User),               useValue: userRepo },
        { provide: getRepositoryToken(Nodo),               useValue: nodoRepo },
        { provide: getDataSourceToken(),                   useValue: dataSource },
      ],
    }).compile();

    service = module.get(AuxiliaryService);
  });

  const queryMes = { year: 2026, month: 8 };

  // ══════════════════════════════════════════════════════════
  // 1. Puerta del módulo
  // ══════════════════════════════════════════════════════════
  describe('assertModuleAccess', () => {
    it.each([UserRole.AUXILIAR, UserRole.ENLACE, UserRole.ADMIN])(
      '%s entra al módulo', (role) => {
        expect(() => service.assertModuleAccess(makeUser(role))).not.toThrow();
      });

    it.each([
      UserRole.DOCENTE, UserRole.MONITOR, UserRole.DECANO, UserRole.COORDINADOR,
      UserRole.VICERRECTOR_EXTENSION, UserRole.VICERRECTOR_ACADEMICO, UserRole.EQUIPO_EXTENSION,
    ])('%s recibe 403', (role) => {
      expect(() => service.assertModuleAccess(makeUser(role))).toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 2. Solo el auxiliar escribe · el nodo sale del perfil
  // ══════════════════════════════════════════════════════════
  describe('createDay — quién abre un día y con qué nodo', () => {
    beforeEach(() => dayRepo.findOne.mockResolvedValue(null));

    it('el auxiliar abre su día, con el nodo de SU perfil', async () => {
      const day = await service.createDay({ logDate: '2026-08-06' }, AUX);
      expect(day).toMatchObject({ auxiliaryId: 'aux-1', nodoId: NODO_A });
    });

    it('el nodo NO se puede colar por el body', async () => {
      const day = await service.createDay(
        { logDate: '2026-08-06', nodoId: NODO_B, auxiliaryId: 'otro' } as never, AUX,
      );
      expect(day).toMatchObject({ auxiliaryId: 'aux-1', nodoId: NODO_A });
    });

    it('si el día ya existe lo devuelve, no lo duplica', async () => {
      dayRepo.findOne.mockResolvedValue(DIA);
      const day = await service.createDay({ logDate: '2026-08-06' }, AUX);
      expect(day).toBe(DIA);
      expect(dayRepo.save).not.toHaveBeenCalled();
    });

    it('el enlace NO abre días del auxiliar', async () => {
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      await expect(service.createDay({ logDate: '2026-08-06' }, enlace))
        .rejects.toThrow(ForbiddenException);
      expect(dayRepo.save).not.toHaveBeenCalled();
    });

    it('el admin tampoco (serían filas a su nombre, ilegibles)', async () => {
      const admin = makeUser(UserRole.ADMIN, { id: 'admin-1', nodoId: null });
      await expect(service.createDay({ logDate: '2026-08-06' }, admin))
        .rejects.toThrow(ForbiddenException);
      expect(dayRepo.save).not.toHaveBeenCalled();
    });

    it('sin nodo asignado no se abre nada', async () => {
      const sinNodo = makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: null });
      await expect(service.createDay({ logDate: '2026-08-06' }, sinNodo))
        .rejects.toThrow(BadRequestException);
      expect(dayRepo.save).not.toHaveBeenCalled();
    });

    it('una carrera de doble clic no devuelve 500: relee el día', async () => {
      // El primero no lo ve, el índice único corta la segunda escritura
      dayRepo.findOne.mockResolvedValueOnce(null).mockResolvedValue(DIA);
      dayRepo.save.mockRejectedValue(
        Object.assign(new Error('duplicate key'), { driverError: { code: '23505' } }),
      );

      await expect(service.createDay({ logDate: '2026-08-06' }, AUX)).resolves.toBe(DIA);
    });

    it('un error que NO es de unicidad se propaga tal cual', async () => {
      dayRepo.save.mockRejectedValue(
        Object.assign(new Error('conexion perdida'), { driverError: { code: '08006' } }),
      );
      await expect(service.createDay({ logDate: '2026-08-06' }, AUX))
        .rejects.toThrow('conexion perdida');
    });
  });

  // ══════════════════════════════════════════════════════════
  // 3. Actividades del día
  // ══════════════════════════════════════════════════════════
  describe('addActivity', () => {
    beforeEach(() => dayRepo.findOne.mockResolvedValue(DIA));

    const dto = { description: 'Apoyo en sala', functionIds: ['fn-1'] };

    it('cuelga la actividad del día indicado', async () => {
      const act = await service.addActivity('day-1', dto, AUX);
      expect(act).toMatchObject({ dayId: 'day-1', description: 'Apoyo en sala' });
    });

    it('admite VARIAS funciones en una misma actividad', async () => {
      functionRepo.find.mockResolvedValue([FN, { id: 'fn-2', name: 'Gestión' }]);
      const act = await service.addActivity(
        'day-1', { ...dto, functionIds: ['fn-1', 'fn-2'] }, AUX,
      );
      expect(act.functions).toHaveLength(2);
    });

    it('exige al menos una función', async () => {
      await expect(service.addActivity('day-1', { ...dto, functionIds: [] }, AUX))
        .rejects.toThrow(BadRequestException);
    });

    it('rechaza funciones inventadas', async () => {
      functionRepo.find.mockResolvedValue([]);
      await expect(service.addActivity('day-1', { ...dto, functionIds: ['fn-x'] }, AUX))
        .rejects.toThrow(BadRequestException);
    });

    it('rechaza tipos de participación inventados', async () => {
      typeRepo.find.mockResolvedValue([]);
      await expect(service.addActivity('day-1', { ...dto, typeIds: ['t-x'] }, AUX))
        .rejects.toThrow(BadRequestException);
    });

    it('los tipos son opcionales: sin ellos se guarda igual', async () => {
      const act = await service.addActivity('day-1', dto, AUX);
      expect(act.types).toEqual([]);
    });

    it('un auxiliar no escribe en el día de otro', async () => {
      dayRepo.findOne.mockResolvedValue({ ...DIA, auxiliaryId: 'aux-2' });
      await expect(service.addActivity('day-1', dto, AUX)).rejects.toThrow(ForbiddenException);
    });

    it('día inexistente → 404', async () => {
      dayRepo.findOne.mockResolvedValue(null);
      await expect(service.addActivity('nope', dto, AUX)).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 4. Enganche: no se cruza de nodo
  // ══════════════════════════════════════════════════════════
  describe('enganche a actividades y procesos del nodo', () => {
    beforeEach(() => dayRepo.findOne.mockResolvedValue(DIA));
    const dto = { description: 'Apoyo', functionIds: ['fn-1'] };

    it('engancha a una actividad de SU nodo', async () => {
      // activity_requests no tiene nodo_id: el nodo sale de su dueño
      activityRepo.findOne.mockResolvedValue({ id: 'act-1', user: { nodoId: NODO_A } });
      const a = await service.addActivity('day-1', { ...dto, activityId: 'act-1' }, AUX);
      expect(a).toMatchObject({ activityId: 'act-1', processId: null });
    });

    it('NO engancha a una actividad de OTRO nodo', async () => {
      activityRepo.findOne.mockResolvedValue({ id: 'act-b', user: { nodoId: NODO_B } });
      await expect(service.addActivity('day-1', { ...dto, activityId: 'act-b' }, AUX))
        .rejects.toThrow(ForbiddenException);
      expect(actRepo.save).not.toHaveBeenCalled();
    });

    it('NO engancha si el dueño de la actividad no tiene nodo', async () => {
      activityRepo.findOne.mockResolvedValue({ id: 'act-x', user: { nodoId: null } });
      await expect(service.addActivity('day-1', { ...dto, activityId: 'act-x' }, AUX))
        .rejects.toThrow(ForbiddenException);
    });

    it('engancha a un proceso de SU nodo', async () => {
      processRepo.findOne.mockResolvedValue({ id: 'proc-1', nodoId: NODO_A });
      const a = await service.addActivity('day-1', { ...dto, processId: 'proc-1' }, AUX);
      expect(a).toMatchObject({ processId: 'proc-1', activityId: null });
    });

    it('NO engancha a un proceso de OTRO nodo', async () => {
      processRepo.findOne.mockResolvedValue({ id: 'proc-b', nodoId: NODO_B });
      await expect(service.addActivity('day-1', { ...dto, processId: 'proc-b' }, AUX))
        .rejects.toThrow(ForbiddenException);
    });

    it('rechaza enganchar a actividad Y proceso a la vez', async () => {
      await expect(service.addActivity(
        'day-1', { ...dto, activityId: 'act-1', processId: 'proc-1' }, AUX,
      )).rejects.toThrow(BadRequestException);
    });

    it('la actividad suelta no necesita enganche', async () => {
      const a = await service.addActivity('day-1', dto, AUX);
      expect(a).toMatchObject({ activityId: null, processId: null });
    });
  });

  // ══════════════════════════════════════════════════════════
  // 5. Un día tiene 24 horas
  // ══════════════════════════════════════════════════════════
  describe('tope de horas por día', () => {
    beforeEach(() => dayRepo.findOne.mockResolvedValue(DIA));
    const dto = (hours?: number) => ({ description: 'x', functionIds: ['fn-1'], hours });

    it('rechaza superar las 24 h sumando las actividades del día', async () => {
      actRepo.find.mockResolvedValue([{ id: 'a', hours: 12 }, { id: 'b', hours: 10 }]);
      await expect(service.addActivity('day-1', dto(3), AUX)).rejects.toThrow(BadRequestException);
      expect(actRepo.save).not.toHaveBeenCalled();
    });

    it('permite llegar justo a 24 h', async () => {
      actRepo.find.mockResolvedValue([{ id: 'a', hours: 20 }]);
      await expect(service.addActivity('day-1', dto(4), AUX)).resolves.toBeDefined();
    });

    it('las actividades SIN horas no cuentan ni se bloquean', async () => {
      actRepo.find.mockResolvedValue([{ id: 'a', hours: 24 }]);
      await expect(service.addActivity('day-1', dto(undefined), AUX)).resolves.toBeDefined();
    });

    it('al editar no se cuenta dos veces la propia actividad', async () => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', hours: 8, day: DIA, functions: [FN], types: [],
      });
      actRepo.find.mockResolvedValue([{ id: 'act-1', hours: 8 }, { id: 'otra', hours: 12 }]);

      await expect(service.updateActivity('act-1', { hours: 10 }, AUX)).resolves.toBeDefined();
    });

    it('al editar sí bloquea si el total del día se pasa', async () => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', hours: 8, day: DIA, functions: [FN], types: [],
      });
      actRepo.find.mockResolvedValue([{ id: 'act-1', hours: 8 }, { id: 'otra', hours: 20 }]);

      await expect(service.updateActivity('act-1', { hours: 6 }, AUX))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 6. Borrar un día no destruye lo que tiene dentro
  // ══════════════════════════════════════════════════════════
  describe('deleteDay', () => {
    beforeEach(() => dayRepo.findOne.mockResolvedValue(DIA));

    it('bloquea borrar un día que todavía tiene actividades', async () => {
      actRepo.count.mockResolvedValue(3);
      await expect(service.deleteDay('day-1', AUX)).rejects.toThrow(BadRequestException);
      expect(dayRepo.delete).not.toHaveBeenCalled();
    });

    it('borra un día vacío', async () => {
      actRepo.count.mockResolvedValue(0);
      await service.deleteDay('day-1', AUX);
      expect(dayRepo.delete).toHaveBeenCalledWith('day-1');
    });
  });

  // ══════════════════════════════════════════════════════════
  // 7. Lectura: aislamiento por nodo
  // ══════════════════════════════════════════════════════════
  describe('findDays — aislamiento por nodo', () => {
    it('el auxiliar ve sus días', async () => {
      userRepo.findOne.mockResolvedValue(AUX);
      await expect(service.findDays('aux-1', queryMes, AUX)).resolves.toBeDefined();
    });

    it('el auxiliar NO ve los de otro auxiliar', async () => {
      userRepo.findOne.mockResolvedValue(makeUser(UserRole.AUXILIAR, { id: 'aux-2' }));
      await expect(service.findDays('aux-2', queryMes, AUX)).rejects.toThrow(ForbiddenException);
    });

    it('el enlace ve al auxiliar de SU nodo', async () => {
      const enlace = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      userRepo.findOne.mockResolvedValue(AUX);
      await expect(service.findDays('aux-1', queryMes, enlace)).resolves.toBeDefined();
    });

    it('el enlace de otro nodo, sin histórico, queda fuera', async () => {
      const enlaceB = makeUser(UserRole.ENLACE, { id: 'enlace-b', nodoId: NODO_B });
      userRepo.findOne.mockResolvedValue(AUX);
      dayRepo.count.mockResolvedValue(0);
      await expect(service.findDays('aux-1', queryMes, enlaceB)).rejects.toThrow(ForbiddenException);
    });

    it('el enlace sin nodo no ve a nadie', async () => {
      const enlaceNull = makeUser(UserRole.ENLACE, { id: 'enlace-n', nodoId: null });
      userRepo.findOne.mockResolvedValue(AUX);
      await expect(service.findDays('aux-1', queryMes, enlaceNull)).rejects.toThrow(ForbiddenException);
    });

    it('si al auxiliar le RETIRAN el nodo, su propia vista se bloquea', async () => {
      const sinNodo = makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: null });
      userRepo.findOne.mockResolvedValue(sinNodo);
      await expect(service.findDays('aux-1', queryMes, sinNodo)).rejects.toThrow(BadRequestException);
    });

    it('el admin ve a cualquiera', async () => {
      const admin = makeUser(UserRole.ADMIN, { id: 'admin-1' });
      userRepo.findOne.mockResolvedValue(makeUser(UserRole.AUXILIAR, { id: 'aux-9', nodoId: NODO_B }));
      await expect(service.findDays('aux-9', queryMes, admin)).resolves.toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // 8. Traslado de nodo A → B
  // ══════════════════════════════════════════════════════════
  describe('cambio de nodo A → B', () => {
    const trasladado = makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: NODO_B });

    beforeEach(() => userRepo.findOne.mockResolvedValue(trasladado));

    it('el enlace del nodo NUEVO no ve lo que se hizo en el ANTERIOR', async () => {
      const enlaceB = makeUser(UserRole.ENLACE, { id: 'enlace-b', nodoId: NODO_B });
      await service.findDays('aux-1', queryMes, enlaceB);

      expect(dayRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ auxiliaryId: 'aux-1', nodoId: NODO_B }),
        }),
      );
    });

    it('el propio auxiliar SÍ ve todo su historial, de los dos nodos', async () => {
      await service.findDays('aux-1', queryMes, trasladado);
      const [{ where }] = dayRepo.find.mock.calls[0];
      expect(where).not.toHaveProperty('nodoId');
    });

    it('el admin tampoco se filtra por nodo', async () => {
      const admin = makeUser(UserRole.ADMIN, { id: 'admin-1' });
      await service.findDays('aux-1', queryMes, admin);
      const [{ where }] = dayRepo.find.mock.calls[0];
      expect(where).not.toHaveProperty('nodoId');
    });

    it('el enlace de A entra si el auxiliar dejó días en A', async () => {
      const enlaceA = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });
      dayRepo.count.mockResolvedValue(3);
      await expect(service.findDays('aux-1', queryMes, enlaceA)).resolves.toBeDefined();
    });

    it('un enlace SIN histórico ni pertenencia sigue fuera → 403', async () => {
      const ajeno = makeUser(UserRole.ENLACE, { id: 'enlace-x', nodoId: 'nodo-ccc' });
      dayRepo.count.mockResolvedValue(0);
      await expect(service.findDays('aux-1', queryMes, ajeno)).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 9. Filtro y paginación
  // ══════════════════════════════════════════════════════════
  describe('filtro y paginación', () => {
    const dias = Array.from({ length: 25 }, (_, i) => ({
      id: `d${i}`, auxiliaryId: 'aux-1', nodoId: NODO_A,
      logDate: `2026-08-${String(i + 1).padStart(2, '0')}`, createdAt: new Date(),
    }));

    beforeEach(() => {
      userRepo.findOne.mockResolvedValue(AUX);
      dayRepo.find.mockResolvedValue(dias);
    });

    it('pagina por días y reporta el total del período', async () => {
      const r = await service.findDays('aux-1', { ...queryMes, page: 1, pageSize: 10 }, AUX);
      expect(r.days).toHaveLength(10);
      expect(r.pagination).toMatchObject({ page: 1, pageSize: 10, total: 25, totalPages: 3 });
    });

    it('la última página trae el resto', async () => {
      const r = await service.findDays('aux-1', { ...queryMes, page: 3, pageSize: 10 }, AUX);
      expect(r.days).toHaveLength(5);
    });

    it('una página fuera de rango devuelve vacío sin romper', async () => {
      const r = await service.findDays('aux-1', { ...queryMes, page: 99, pageSize: 10 }, AUX);
      expect(r.days).toEqual([]);
    });

    it('el filtro por texto deja solo los días con actividades que coinciden', async () => {
      actRepo.find.mockResolvedValue([{ dayId: 'd3' }, { dayId: 'd7' }]);
      const r = await service.findDays('aux-1', { ...queryMes, search: 'taller' }, AUX);
      expect(r.pagination.total).toBe(2);
    });

    it('el filtro de fechas no saca al usuario del mes consultado', async () => {
      await service.findDays('aux-1', { ...queryMes, from: '2020-01-01', to: '2030-12-31' }, AUX);
      const [{ where }] = dayRepo.find.mock.calls[0];
      // Between recortado a agosto de 2026, no al rango pedido
      expect(JSON.stringify(where.logDate)).toContain('2026-08-01');
      expect(JSON.stringify(where.logDate)).toContain('2026-08-31');
    });

    it('el resumen es del MES completo, no de la página', async () => {
      const r = await service.findDays('aux-1', { ...queryMes, page: 1, pageSize: 2 }, AUX);
      expect(r.days).toHaveLength(2);
      expect(r.summary.daysWithLog).toBe(25);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 10. Evidencias
  // ══════════════════════════════════════════════════════════
  describe('evidencias', () => {
    beforeEach(() => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', day: DIA, functions: [FN], types: [],
      });
    });

    it('cuelga de la actividad tras validar permisos', async () => {
      const ev = await service.addEvidence(
        { activityId: 'act-1', fileUrl: 'https://d/x.png' }, AUX,
      );
      expect(ev).toMatchObject({ activityId: 'act-1' });
    });

    it('no se puede colgar evidencia en la actividad de otro', async () => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', day: { ...DIA, auxiliaryId: 'aux-2' },
        functions: [], types: [],
      });
      await expect(service.addEvidence({ activityId: 'act-1', fileUrl: 'https://d/x.png' }, AUX))
        .rejects.toThrow(ForbiddenException);
    });

    it('borrar una evidencia la marca, no la destruye', async () => {
      evidenceRepo.findOne.mockResolvedValue({ id: 'ev-7', activityId: 'act-1' });
      await service.deleteEvidence('ev-7', AUX);

      expect(evidenceRepo.softDelete).toHaveBeenCalledWith('ev-7');
      expect(evidenceRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // 11. Lista de auxiliares (vista del enlace)
  // ══════════════════════════════════════════════════════════
  describe('listAuxiliaries', () => {
    const enlaceA = makeUser(UserRole.ENLACE, { id: 'enlace-a', nodoId: NODO_A });

    it('el enlace filtra por SU nodo', async () => {
      await service.listAuxiliaries(enlaceA);
      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: UserRole.AUXILIAR, nodoId: NODO_A } }),
      );
    });

    it('incluye a quien ya no es del nodo pero dejó días en él', async () => {
      userRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeUser(UserRole.AUXILIAR, { id: 'aux-9' })]);
      dayRepo.find.mockResolvedValue([{ auxiliaryId: 'aux-9' }]);

      const lista = await service.listAuxiliaries(enlaceA);
      expect(lista.map((a) => a.id)).toEqual(['aux-9']);
    });

    it('no duplica a quien es del nodo Y tiene días en él', async () => {
      userRepo.find.mockResolvedValue([makeUser(UserRole.AUXILIAR, { id: 'aux-1' })]);
      dayRepo.find.mockResolvedValue([{ auxiliaryId: 'aux-1' }]);

      const lista = await service.listAuxiliaries(enlaceA);
      expect(lista).toHaveLength(1);
    });

    it('el enlace sin nodo recibe lista vacía y no consulta usuarios', async () => {
      const enlaceNull = makeUser(UserRole.ENLACE, { id: 'enlace-n', nodoId: null });
      await expect(service.listAuxiliaries(enlaceNull)).resolves.toEqual([]);
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    it('el auxiliar no lista a sus pares', async () => {
      await expect(service.listAuxiliaries(AUX)).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 12. Nodos del período: salen de los días, no del perfil
  // ══════════════════════════════════════════════════════════
  describe('nodos del período', () => {
    beforeEach(() => {
      userRepo.findOne.mockResolvedValue(
        makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: NODO_B }),
      );
    });

    it('un mes a caballo devuelve LOS DOS nodos, no el del perfil', async () => {
      const aux = makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: NODO_B });
      dayRepo.find.mockResolvedValue([
        { id: 'd1', nodoId: NODO_A, logDate: '2026-08-03', createdAt: new Date() },
        { id: 'd2', nodoId: NODO_B, logDate: '2026-08-20', createdAt: new Date() },
      ]);
      nodoRepo.find.mockResolvedValue([
        { id: NODO_A, name: 'Nodo Oriente' },
        { id: NODO_B, name: 'Nodo Occidente' },
      ]);

      const { nodos } = await service.findMonth('aux-1', 2026, 8, aux);
      expect(nodos.map((n) => n.name).sort()).toEqual(['Nodo Occidente', 'Nodo Oriente']);
    });

    it('un mes sin días no afirma ningún nodo', async () => {
      const aux = makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: NODO_B });
      const { nodos } = await service.findMonth('aux-1', 2026, 8, aux);
      expect(nodos).toEqual([]);
    });
  });
  // ══════════════════════════════════════════════════════════
  // 13. El tope se valida con el día BLOQUEADO
  // ══════════════════════════════════════════════════════════
  describe('serialización del tope de 24 h', () => {
    beforeEach(() => dayRepo.findOne.mockResolvedValue(DIA));
    const dto = { description: 'x', functionIds: ['fn-1'], hours: 4 };

    it('addActivity corre en transacción y bloquea la fila del día', async () => {
      await service.addActivity('day-1', dto, AUX);

      expect(dataSource.transaction).toHaveBeenCalled();
      const qb = dayRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('updateActivity también bloquea el día antes de sumar', async () => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', hours: 2, day: DIA, functions: [FN], types: [],
      });

      await service.updateActivity('act-1', { hours: 5 }, AUX);

      expect(dataSource.transaction).toHaveBeenCalled();
      const qb = dayRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('la suma de horas se lee DENTRO de la transacción, no fuera', async () => {
      // Si se leyera con el repo de fuera, el candado no serviría de nada.
      // El manager falso reparte el mismo mock, así que lo que se comprueba
      // es que la lectura ocurre después de haber bloqueado.
      const orden: string[] = [];
      dayRepo.createQueryBuilder.mockImplementation((): LockQbMock => {
        const b: LockQbMock = {
          setLock: jest.fn(() => b),
          where:   jest.fn(() => b),
          getOne:  jest.fn(async () => { orden.push('lock'); return DIA; }),
        };
        return b;
      });
      actRepo.find.mockImplementation(async () => { orden.push('suma'); return []; });

      await service.addActivity('day-1', dto, AUX);

      expect(orden).toEqual(['lock', 'suma']);
    });
  });

  // ══════════════════════════════════════════════════════════
  // 14. No se escribe hacia el nodo anterior
  // ══════════════════════════════════════════════════════════
  describe('traslado: el día viejo queda cerrado a escritura', () => {
    // El auxiliar ya está en el nodo B; el día es del nodo A
    const trasladado = makeUser(UserRole.AUXILIAR, { id: 'aux-1', nodoId: NODO_B });
    const diaViejo = { ...DIA, nodoId: NODO_A };

    it('no puede agregar actividades a un día del nodo anterior', async () => {
      dayRepo.findOne.mockResolvedValue(diaViejo);

      await expect(service.addActivity(
        'day-1', { description: 'Hacia atrás', functionIds: ['fn-1'] }, trasladado,
      )).rejects.toThrow(ForbiddenException);
      expect(actRepo.save).not.toHaveBeenCalled();
    });

    it('el mensaje dice que es por el nodo, no por la propiedad', async () => {
      dayRepo.findOne.mockResolvedValue(diaViejo);

      await expect(service.addActivity(
        'day-1', { description: 'x', functionIds: ['fn-1'] }, trasladado,
      )).rejects.toThrow(/nodo actual/i);
    });

    it('tampoco puede editar una actividad del nodo anterior', async () => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', hours: 2, day: diaViejo, functions: [FN], types: [],
      });

      await expect(service.updateActivity('act-1', { hours: 5 }, trasladado))
        .rejects.toThrow(ForbiddenException);
    });

    it('tampoco puede borrarla', async () => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', day: diaViejo, functions: [], types: [],
      });

      await expect(service.deleteActivity('act-1', trasladado))
        .rejects.toThrow(ForbiddenException);
      expect(actRepo.delete).not.toHaveBeenCalled();
    });

    it('tampoco puede colgarle una evidencia', async () => {
      actRepo.findOne.mockResolvedValue({
        id: 'act-1', dayId: 'day-1', day: diaViejo, functions: [], types: [],
      });

      await expect(service.addEvidence(
        { activityId: 'act-1', fileUrl: 'https://d/x.png' }, trasladado,
      )).rejects.toThrow(ForbiddenException);
      expect(evidenceRepo.save).not.toHaveBeenCalled();
    });

    it('tampoco puede borrar el día viejo', async () => {
      dayRepo.findOne.mockResolvedValue(diaViejo);
      actRepo.count.mockResolvedValue(0);

      await expect(service.deleteDay('day-1', trasladado)).rejects.toThrow(ForbiddenException);
      expect(dayRepo.delete).not.toHaveBeenCalled();
    });

    it('en su nodo ACTUAL sí escribe con normalidad', async () => {
      dayRepo.findOne.mockResolvedValue({ ...DIA, nodoId: NODO_B });

      await expect(service.addActivity(
        'day-1', { description: 'En mi nodo', functionIds: ['fn-1'] }, trasladado,
      )).resolves.toBeDefined();
    });

    it('un día sin nodo (dato migrado) también queda cerrado', async () => {
      // Escribir ahí generaría trabajo que ningún enlace podría ver
      dayRepo.findOne.mockResolvedValue({ ...DIA, nodoId: null });

      await expect(service.addActivity(
        'day-1', { description: 'x', functionIds: ['fn-1'] }, AUX,
      )).rejects.toThrow(ForbiddenException);
    });
  });
});
