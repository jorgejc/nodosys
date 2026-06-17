import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActivitiesService } from './activities.service';
import { ActivityRequest } from './entities/activity-request.entity';
import { ActivityExpense } from './entities/activity-expense.entity';
import { ActivityParticipant } from './entities/activity-participant.entity';
import { ActivityEvidence } from './entities/activity-evidence.entity';
import { User, UserRole } from '../users/entities/user.entity';

/** Helper de usuario de prueba */
const makeUser = (
  role: UserRole,
  opts: { id?: string; nodoId?: string | null } = {},
): User =>
  ({
    id:     opts.id     ?? 'uid-1',
    role,
    nodoId: opts.nodoId ?? null,
    name:   'Test',
    email:  'test@test.com',
  } as User);

/** QueryBuilder encadenable genérico */
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

describe('ActivitiesService — RBAC: findAll() filtra actividades por rol del usuario', () => {
  let service: ActivitiesService;
  let mockQb: ReturnType<typeof makeMockQb>;

  beforeEach(async () => {
    mockQb = makeMockQb();

    const mockRequestRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: getRepositoryToken(ActivityRequest),     useValue: mockRequestRepo },
        { provide: getRepositoryToken(ActivityExpense),     useValue: {} },
        { provide: getRepositoryToken(ActivityParticipant), useValue: {} },
        { provide: getRepositoryToken(ActivityEvidence),    useValue: {} },
        { provide: DataSource,                              useValue: {} },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  // ── Revisores globales: ven todas las actividades ─────────
  // GLOBAL_REVIEWERS = [admin, vicerrector_extension, equipo_extension, decano, coordinador]

  it('admin: no aplica WHERE (ve todas las actividades)', async () => {
    await service.findAll(makeUser(UserRole.ADMIN));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('vicerrector_extension: no aplica WHERE', async () => {
    await service.findAll(makeUser(UserRole.VICERRECTOR_EXTENSION));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('equipo_extension: no aplica WHERE', async () => {
    await service.findAll(makeUser(UserRole.EQUIPO_EXTENSION));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('decano: no aplica WHERE (revisor global en actividades)', async () => {
    await service.findAll(makeUser(UserRole.DECANO));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('coordinador: no aplica WHERE (revisor global en actividades)', async () => {
    await service.findAll(makeUser(UserRole.COORDINADOR));
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  // ── Roles de nodo: filtran por nodo ───────────────────────
  // NODO_ROLES = [enlace, monitor, auxiliar]

  it('enlace con nodo: WHERE u.nodo_id = su_nodo', async () => {
    await service.findAll(makeUser(UserRole.ENLACE, { nodoId: 'nodo-55' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.nodo_id = :nodoId',
      { nodoId: 'nodo-55' },
    );
  });

  it('monitor con nodo: WHERE u.nodo_id = su_nodo', async () => {
    await service.findAll(makeUser(UserRole.MONITOR, { nodoId: 'nodo-77' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.nodo_id = :nodoId',
      { nodoId: 'nodo-77' },
    );
  });

  it('auxiliar con nodo: WHERE u.nodo_id = su_nodo', async () => {
    await service.findAll(makeUser(UserRole.AUXILIAR, { nodoId: 'nodo-88' }));

    expect(mockQb.where).toHaveBeenCalledWith(
      'u.nodo_id = :nodoId',
      { nodoId: 'nodo-88' },
    );
  });

  // ── Docente y otros sin rol de revisión/nodo ─────────────

  it('docente: WHERE r.user_id = su_id (solo sus propias actividades)', async () => {
    const docente = makeUser(UserRole.DOCENTE, { id: 'doc-42' });
    await service.findAll(docente);

    expect(mockQb.where).toHaveBeenCalledWith(
      'r.user_id = :uid',
      { uid: 'doc-42' },
    );
  });

  it('enlace sin nodo asignado: fallback a sus propias actividades', async () => {
    // Enlace con nodoId = null → no entra en la rama NODO_ROLES → fallback
    const enlace = makeUser(UserRole.ENLACE, { id: 'enl-no-nodo', nodoId: null });
    await service.findAll(enlace);

    expect(mockQb.where).toHaveBeenCalledWith(
      'r.user_id = :uid',
      { uid: 'enl-no-nodo' },
    );
  });
});
