import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryCategory } from './entities/inventory-category.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryUnit } from './entities/inventory-unit.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { User, UserRole } from '../users/entities/user.entity';

/** Construye un User de prueba con los campos mínimos necesarios */
const makeUser = (role: UserRole, nodoId: string | null = null): User =>
  ({ id: 'uid-1', role, nodoId, name: 'Test', email: 'test@test.com' } as User);

/** Crea un mock de QueryBuilder encadenable (todos los métodos de construcción devuelven `this`) */
const makeMockQb = () => {
  const qb = {
    leftJoinAndSelect:  jest.fn(),
    leftJoin:           jest.fn(),
    addSelect:          jest.fn(),
    where:              jest.fn(),
    andWhere:           jest.fn(),
    groupBy:            jest.fn(),
    orderBy:            jest.fn(),
    addOrderBy:         jest.fn(),
    getRawAndEntities:  jest.fn().mockResolvedValue({ entities: [], raw: [] }),
  };
  for (const key of Object.keys(qb) as (keyof typeof qb)[]) {
    if (key !== 'getRawAndEntities') {
      (qb[key] as jest.Mock).mockReturnValue(qb);
    }
  }
  return qb;
};

describe('InventoryService — RBAC: getItems() filtra por rol del usuario', () => {
  let service: InventoryService;
  let mockQb: ReturnType<typeof makeMockQb>;
  let mockItemRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    mockQb = makeMockQb();
    mockItemRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryCategory), useValue: {} },
        { provide: getRepositoryToken(InventoryItem),     useValue: mockItemRepo },
        { provide: getRepositoryToken(InventoryUnit),     useValue: {} },
        { provide: getRepositoryToken(InventoryMovement), useValue: {} },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  // ── Roles globales: ven todos los nodos ───────────────────

  it('admin: no fuerza filtro nodo_id, ejecuta query sin restricción de nodo', async () => {
    await service.getItems({}, makeUser(UserRole.ADMIN));

    const nodoFilter = mockQb.andWhere.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('nodo_id'),
    );
    expect(nodoFilter).toBeUndefined();
    expect(mockQb.getRawAndEntities).toHaveBeenCalled();
  });

  it('vicerrector_extension: no fuerza filtro nodo_id', async () => {
    await service.getItems({}, makeUser(UserRole.VICERRECTOR_EXTENSION));

    const nodoFilter = mockQb.andWhere.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('nodo_id'),
    );
    expect(nodoFilter).toBeUndefined();
    expect(mockQb.getRawAndEntities).toHaveBeenCalled();
  });

  it('decano: no fuerza filtro nodo_id (rol global)', async () => {
    await service.getItems({}, makeUser(UserRole.DECANO));

    const nodoFilter = mockQb.andWhere.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('nodo_id'),
    );
    expect(nodoFilter).toBeUndefined();
  });

  // ── Roles de nodo: solo ven su propio nodo ────────────────

  it('enlace con nodo: fuerza filtro nodo_id = su propio nodo', async () => {
    await service.getItems({}, makeUser(UserRole.ENLACE, 'nodo-abc'));

    const nodoFilter = mockQb.andWhere.mock.calls.find(
      ([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes('nodo_id') &&
        (params as Record<string, string>)?.nodoId === 'nodo-abc',
    );
    expect(nodoFilter).toBeDefined();
  });

  it('monitor con nodo: fuerza filtro nodo_id = su propio nodo', async () => {
    await service.getItems({}, makeUser(UserRole.MONITOR, 'nodo-xyz'));

    const nodoFilter = mockQb.andWhere.mock.calls.find(
      ([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes('nodo_id') &&
        (params as Record<string, string>)?.nodoId === 'nodo-xyz',
    );
    expect(nodoFilter).toBeDefined();
  });

  it('auxiliar con nodo: fuerza filtro nodo_id = su propio nodo', async () => {
    await service.getItems({}, makeUser(UserRole.AUXILIAR, 'nodo-99'));

    const nodoFilter = mockQb.andWhere.mock.calls.find(
      ([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes('nodo_id') &&
        (params as Record<string, string>)?.nodoId === 'nodo-99',
    );
    expect(nodoFilter).toBeDefined();
  });

  // ── Sin nodo asignado: retorno vacío inmediato ────────────

  it('docente sin nodo asignado: retorna [] sin ejecutar ninguna query', async () => {
    const result = await service.getItems({}, makeUser(UserRole.DOCENTE, null));

    expect(result).toEqual([]);
    expect(mockItemRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('enlace sin nodo asignado: retorna [] sin ejecutar query', async () => {
    const result = await service.getItems({}, makeUser(UserRole.ENLACE, null));

    expect(result).toEqual([]);
    expect(mockItemRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
