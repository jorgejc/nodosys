/**
 * workplan.controller.spec.ts — Tests de integración con Supertest
 *
 * Verifica que el endpoint GET /api/workplan:
 *  1. Requiere autenticación (401 sin token)
 *  2. Pasa el usuario autenticado a WorkPlanService.findAll()
 *  3. El rol del usuario (nodoId, faculty, etc.) llega correctamente al servicio
 */
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { WorkPlanController } from './workplan.controller';
import { WorkPlanService } from './workplan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../users/entities/user.entity';

/** App de test con guard sustituido por uno que inyecta el usuario indicado */
async function buildApp(
  mockService: Partial<WorkPlanService>,
  currentUser: User,
): Promise<INestApplication> {
  const guardStub = {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = currentUser;
      return true;
    },
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [WorkPlanController],
    providers: [{ provide: WorkPlanService, useValue: mockService }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(guardStub)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('WorkPlanController — integración (Supertest)', () => {
  const mockService: jest.Mocked<Partial<WorkPlanService>> = {
    findAll:        jest.fn().mockResolvedValue([]),
    findOne:        jest.fn(),
    getPlanSummary: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => jest.clearAllMocks());

  // ── GET /api/workplan ─────────────────────────────────────

  it('GET /api/workplan — admin: findAll recibe el usuario admin completo', async () => {
    const admin = { id: 'adm-1', role: UserRole.ADMIN, nodoId: null, faculty: null } as User;
    const app = await buildApp(mockService, admin);

    await request(app.getHttpServer()).get('/api/workplan').expect(200);

    expect(mockService.findAll).toHaveBeenCalledWith(admin);
    await app.close();
  });

  it('GET /api/workplan — docente: findAll recibe el usuario docente', async () => {
    const docente = { id: 'doc-1', role: UserRole.DOCENTE, nodoId: null } as User;
    const app = await buildApp(mockService, docente);

    await request(app.getHttpServer()).get('/api/workplan').expect(200);

    expect(mockService.findAll).toHaveBeenCalledWith(docente);
    await app.close();
  });

  it('GET /api/workplan — enlace: findAll recibe el nodoId del enlace', async () => {
    const enlace = {
      id: 'enl-1',
      role: UserRole.ENLACE,
      nodoId: 'nodo-3',
      faculty: null,
    } as User;
    const app = await buildApp(mockService, enlace);

    await request(app.getHttpServer()).get('/api/workplan').expect(200);

    expect(mockService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ENLACE, nodoId: 'nodo-3' }),
    );
    await app.close();
  });

  it('GET /api/workplan — decano: findAll recibe la facultad del decano', async () => {
    const decano = {
      id: 'dec-1',
      role: UserRole.DECANO,
      nodoId: null,
      faculty: 'Facultad de Ingeniería',
    } as User;
    const app = await buildApp(mockService, decano);

    await request(app.getHttpServer()).get('/api/workplan').expect(200);

    expect(mockService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.DECANO, faculty: 'Facultad de Ingeniería' }),
    );
    await app.close();
  });

  it('GET /api/workplan — responde 200 y retorna el array del servicio', async () => {
    const admin = { id: 'adm', role: UserRole.ADMIN } as User;
    mockService.findAll = jest.fn().mockResolvedValue([{ id: 'plan-1' }, { id: 'plan-2' }]);
    const app = await buildApp(mockService, admin);

    const res = await request(app.getHttpServer()).get('/api/workplan').expect(200);

    expect(res.body).toHaveLength(2);
    await app.close();
  });

  // ── Acceso sin autenticación ──────────────────────────────

  it('GET /api/workplan — sin token: guard lanza 401', async () => {
    const rejectGuard = {
      canActivate: () => { throw new UnauthorizedException(); },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WorkPlanController],
      providers:  [{ provide: WorkPlanService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(rejectGuard)
      .compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    await request(app.getHttpServer()).get('/api/workplan').expect(401);

    await app.close();
  });
});
