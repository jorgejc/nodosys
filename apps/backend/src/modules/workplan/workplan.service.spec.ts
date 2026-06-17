import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WorkPlanService } from './workplan.service';
import { WorkPlan } from './entities/work-plan.entity';
import { WorkPlanAxis } from './entities/work-plan-axis.entity';
import { AxisActivity } from './entities/axis-activity.entity';
import { User, UserRole } from '../users/entities/user.entity';

/** Helper para construir usuarios de prueba */
const makeUser = (
  role: UserRole,
  opts: {
    id?: string;
    nodoId?: string | null;
    faculty?: string | null;
    program?: string | null;
  } = {},
): User =>
  ({
    id:      opts.id      ?? 'uid-1',
    role,
    nodoId:  opts.nodoId  ?? null,
    faculty: opts.faculty ?? null,
    program: opts.program ?? null,
    name:    'Test',
    email:   'test@test.com',
  } as User);

/** QueryBuilder encadenable */
const makeMockQb = () => {
  const qb = {
    leftJoinAndSelect: jest.fn(),
    where:             jest.fn(),
    andWhere:          jest.fn(),
    orderBy:           jest.fn(),
    getMany:           jest.fn().mockResolvedValue([]),
  };
  for (const key of Object.keys(qb) as (keyof typeof qb)[]) {
    if (key !== 'getMany') (qb[key] as jest.Mock).mockReturnValue(qb);
  }
  return qb;
};

describe('WorkPlanService — RBAC: findAll() filtra planes por rol del usuario', () => {
  let service: WorkPlanService;
  let mockQb: ReturnType<typeof makeMockQb>;

  beforeEach(async () => {
    mockQb = makeMockQb();

    const mockPlanRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkPlanService,
        { provide: getRepositoryToken(WorkPlan),     useValue: mockPlanRepo },
        { provide: getRepositoryToken(WorkPlanAxis), useValue: {} },
        { provide: getRepositoryToken(AxisActivity), useValue: {} },
        { provide: DataSource,                       useValue: {} },
      ],
    }).compile();

    service = module.get<WorkPlanService>(WorkPlanService);
  });

  // ── Roles globales: ven todos los planes ──────────────────

  it('admin: no aplica cláusula WHERE (ve todos los planes de todos los nodos)', async () => {
    await service.findAll(makeUser(UserRole.ADMIN));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('vicerrector_extension: no aplica WHERE', async () => {
    await service.findAll(makeUser(UserRole.VICERRECTOR_EXTENSION));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('vicerrector_academico: no aplica WHERE', async () => {
    await service.findAll(makeUser(UserRole.VICERRECTOR_ACADEMICO));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('equipo_extension: no aplica WHERE', async () => {
    await service.findAll(makeUser(UserRole.EQUIPO_EXTENSION));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  // ── Filtrado por facultad / programa ──────────────────────

  it('decano: WHERE u.faculty = su_facultad', async () => {
    await service.findAll(makeUser(UserRole.DECANO, { faculty: 'Ingeniería' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.faculty = :faculty',
      { faculty: 'Ingeniería' },
    );
  });

  it('coordinador: WHERE u.program = su_programa', async () => {
    await service.findAll(makeUser(UserRole.COORDINADOR, { program: 'Tecnología en Sistemas' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.program = :program',
      { program: 'Tecnología en Sistemas' },
    );
  });

  // ── Filtrado por nodo ─────────────────────────────────────

  it('enlace con nodo: WHERE u.nodo_id = su_nodo', async () => {
    await service.findAll(makeUser(UserRole.ENLACE, { nodoId: 'nodo-1' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.nodo_id = :nodoId',
      { nodoId: 'nodo-1' },
    );
  });

  it('monitor con nodo: WHERE u.nodo_id = su_nodo', async () => {
    await service.findAll(makeUser(UserRole.MONITOR, { nodoId: 'nodo-2' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.nodo_id = :nodoId',
      { nodoId: 'nodo-2' },
    );
  });

  it('auxiliar con nodo: WHERE u.nodo_id = su_nodo', async () => {
    await service.findAll(makeUser(UserRole.AUXILIAR, { nodoId: 'nodo-3' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.nodo_id = :nodoId',
      { nodoId: 'nodo-3' },
    );
  });

  // ── Docente: solo sus propios planes ─────────────────────

  it('docente: WHERE wp.user_id = su_id (solo sus propios planes)', async () => {
    const docente = makeUser(UserRole.DOCENTE, { id: 'doc-99' });
    await service.findAll(docente);

    expect(mockQb.where).toHaveBeenCalledWith(
      'wp.user_id = :userId',
      { userId: 'doc-99' },
    );
  });

  it('docente con nodo pero sin rol de nodo: WHERE wp.user_id = su_id', async () => {
    // DOCENTE no entra en las ramas de enlace/monitor/auxiliar
    const docente = makeUser(UserRole.DOCENTE, { id: 'doc-55', nodoId: 'nodo-x' });
    await service.findAll(docente);

    expect(mockQb.where).toHaveBeenCalledWith(
      'wp.user_id = :userId',
      { userId: 'doc-55' },
    );
  });
});
