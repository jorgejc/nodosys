/**
 * inventory.controller.spec.ts — Tests de integración con Supertest
 *
 * Verifica que los endpoints del inventario:
 *  1. Requieren autenticación JWT (401 sin token)
 *  2. Pasan el usuario autenticado al servicio para que aplique RBAC
 *  3. El servicio recibe correctamente los query params del cliente
 */
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../users/entities/user.entity';

/** Construye una app de test con el guard sustituido por uno que inyecta `currentUser` */
async function buildApp(
  mockService: Partial<InventoryService>,
  currentUser: User,
): Promise<INestApplication> {
  const guardStub = {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = currentUser;
      return true;
    },
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [InventoryController],
    providers: [{ provide: InventoryService, useValue: mockService }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(guardStub)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('InventoryController — integración (Supertest)', () => {
  const mockService: jest.Mocked<Partial<InventoryService>> = {
    getItems:       jest.fn().mockResolvedValue([]),
    getCategories:  jest.fn().mockResolvedValue([]),
    getSummary:     jest.fn().mockResolvedValue({ total_units: 0 }),
    getActiveLoans: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => jest.clearAllMocks());

  // ── GET /api/inventory/items ──────────────────────────────

  it('GET /api/inventory/items — responde 200 con usuario autenticado', async () => {
    const enlace = { id: 'u1', role: UserRole.ENLACE, nodoId: 'nodo-1' } as User;
    const app = await buildApp(mockService, enlace);

    await request(app.getHttpServer()).get('/api/inventory/items').expect(200);

    expect(mockService.getItems).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('GET /api/inventory/items — el servicio recibe el usuario para aplicar RBAC', async () => {
    const enlace = { id: 'u1', role: UserRole.ENLACE, nodoId: 'nodo-1' } as User;
    const app = await buildApp(mockService, enlace);

    await request(app.getHttpServer()).get('/api/inventory/items').expect(200);

    // El controlador pasa el usuario completo al servicio — el servicio aplica el filtro
    expect(mockService.getItems).toHaveBeenCalledWith(
      expect.objectContaining({ nodoId: undefined }),
      enlace,
    );
    await app.close();
  });

  it('GET /api/inventory/items?nodoId=nodo-2 — admin puede solicitar un nodo específico', async () => {
    const admin = { id: 'adm', role: UserRole.ADMIN, nodoId: null } as User;
    const app = await buildApp(mockService, admin);

    await request(app.getHttpServer())
      .get('/api/inventory/items?nodoId=nodo-2')
      .expect(200);

    expect(mockService.getItems).toHaveBeenCalledWith(
      expect.objectContaining({ nodoId: 'nodo-2' }),
      admin,
    );
    await app.close();
  });

  it(
    'GET /api/inventory/items?nodoId=otro — enlace pasa el query al servicio; ' +
    'el servicio reemplazará el nodoId con el propio del usuario',
    async () => {
      const enlace = { id: 'u2', role: UserRole.ENLACE, nodoId: 'nodo-1' } as User;
      const app = await buildApp(mockService, enlace);

      await request(app.getHttpServer())
        .get('/api/inventory/items?nodoId=otro-nodo')
        .expect(200);

      // El controlador pasa todo al servicio; la restricción ocurre dentro del servicio
      expect(mockService.getItems).toHaveBeenCalledWith(
        expect.anything(),
        enlace, // el usuario con su nodoId real llega al servicio
      );
      await app.close();
    },
  );

  // ── Acceso sin autenticación ──────────────────────────────

  it('GET /api/inventory/items — sin token (guard real que lanza 401)', async () => {
    // Guard que simula exactamente el comportamiento de JwtAuthGuard cuando no hay token
    const rejectGuard = {
      canActivate: () => { throw new UnauthorizedException(); },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InventoryController],
      providers:  [{ provide: InventoryService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(rejectGuard)
      .compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    await request(app.getHttpServer()).get('/api/inventory/items').expect(401);

    await app.close();
  });

  // ── GET /api/inventory/categories (resolveNodo en el controller) ──

  it('GET /api/inventory/categories — enlace: resolveNodo devuelve su nodoId', async () => {
    const enlace = { id: 'u3', role: UserRole.ENLACE, nodoId: 'nodo-5' } as User;
    const app = await buildApp(mockService, enlace);

    await request(app.getHttpServer()).get('/api/inventory/categories').expect(200);

    // Para roles no-globales, el controller llama getCategories con el nodoId del usuario
    expect(mockService.getCategories).toHaveBeenCalledWith('nodo-5');
    await app.close();
  });

  it('GET /api/inventory/categories — admin con ?nodoId puede filtrar por nodo específico', async () => {
    const admin = { id: 'adm', role: UserRole.ADMIN, nodoId: null } as User;
    const app = await buildApp(mockService, admin);

    await request(app.getHttpServer())
      .get('/api/inventory/categories?nodoId=nodo-x')
      .expect(200);

    expect(mockService.getCategories).toHaveBeenCalledWith('nodo-x');
    await app.close();
  });
});
