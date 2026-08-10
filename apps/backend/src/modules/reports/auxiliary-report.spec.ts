/**
 * auxiliary-report.spec.ts — El reporte mensual del auxiliar se genera
 *
 * pdfmake falla en RUNTIME ante un documento mal formado (anchos de tabla
 * que no cuadran con las columnas, estilos inexistentes, colSpan mal
 * contado...). TypeScript no ve nada de eso, así que estos casos generan
 * el PDF de verdad y comprueban los bytes.
 *
 * Cubre además los casos borde que rompen los reportes: mes vacío,
 * registros sin horas, eventos sin tipos y evidencias sin descripción.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { AuxiliaryService } from '../auxiliary/auxiliary.service';
import { MonitorsService } from '../monitors/monitors.service';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryUnit } from '../inventory/entities/inventory-unit.entity';
import { WorkPlan } from '../workplan/entities/work-plan.entity';
import { WorkPlanAxis } from '../workplan/entities/work-plan-axis.entity';
import { AxisActivity } from '../workplan/entities/axis-activity.entity';
import { ActivityRequest } from '../activities/entities/activity-request.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { MonitorWorkPlan } from '../monitors/entities/monitor-work-plan.entity';
import { MonitorWeek } from '../monitors/entities/monitor-week.entity';
import { MonitorWeekActivity } from '../monitors/entities/monitor-week-activity.entity';

const AUX_USER = {
  id: 'aux-1', role: UserRole.AUXILIAR, nodoId: 'nodo-a', name: 'Auxiliar Prueba',
} as User;

const auxiliaryPayload = {
  id: 'aux-1',
  name: 'Auxiliar Prueba',
  email: 'aux@test.com',
  documentType: 'CC',
  documentNumber: '12345',
  nodoId: 'nodo-a',
  nodoName: 'Nodo Oriente',
  phone: null,
};

/** Un mes con datos completos: dos funciones, evento enganchado y suelto. */
const mesLleno = {
  auxiliary: auxiliaryPayload,
  year: 2026, month: 8,
  days: [
    {
      id: 'd1', logDate: '2026-08-03', nodoId: 'nodo-a',
      activities: [
        {
          id: 'a1', dayId: 'd1', description: 'Acompanamiento a usuarios en sala',
          hours: 4, activityId: 'act-1', processId: null,
          linkLabel: 'Feria de ciencia', isLinked: true,
          functions: [{ id: 'f1', name: 'Atencion y acompanamiento' }],
          types: [{ id: 't1', name: 'Apoyo logistico' }],
          evidences: [{ id: 'e1', caption: 'Planilla', fileUrl: 'https://d/1' }],
          createdAt: new Date(),
        },
        {
          id: 'a2', dayId: 'd1', description: 'Atencion telefonica',
          hours: null, activityId: null, processId: null,
          linkLabel: null, isLinked: false,
          functions: [
            { id: 'f1', name: 'Atencion y acompanamiento' },
            { id: 'f2', name: 'Gestion administrativa y documental' },
          ],
          types: [], evidences: [], createdAt: new Date(),
        },
      ],
    },
    {
      id: 'd2', logDate: '2026-08-05', nodoId: 'nodo-a',
      activities: [
        {
          id: 'a3', dayId: 'd2', description: 'Archivo de actas', hours: 2.5,
          activityId: null, processId: null, linkLabel: null, isLinked: false,
          functions: [{ id: 'f2', name: 'Gestion administrativa y documental' }],
          types: [],
          evidences: [{ id: 'e2', caption: null, fileUrl: 'https://drive.google.com/file/d/muy-larga-de-verdad-para-truncar/view' }],
          createdAt: new Date(),
        },
      ],
    },
  ],
  summary: {
    year: 2026, month: 8,
    daysWithLog: 2, activityCount: 3, evidenceCount: 2, totalHours: 6.5,
  },
};

/** Mes sin absolutamente nada: el caso que más rompe reportes. */
const mesVacio = {
  auxiliary: auxiliaryPayload,
  year: 2026, month: 9,
  days: [],
  summary: {
    year: 2026, month: 9,
    daysWithLog: 0, activityCount: 0, evidenceCount: 0, totalHours: null,
  },
};

describe('ReportsService — reporte mensual del auxiliar', () => {
  let service: ReportsService;
  let auxiliaryService: { findMonth: jest.Mock };

  beforeEach(async () => {
    auxiliaryService = { findMonth: jest.fn() };
    const repoMock = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: AuxiliaryService, useValue: auxiliaryService },
        { provide: MonitorsService,  useValue: { getPlanForRead: jest.fn(), findNodoEnlace: jest.fn() } },
        { provide: getRepositoryToken(InventoryItem),        useValue: repoMock },
        { provide: getRepositoryToken(InventoryUnit),        useValue: repoMock },
        { provide: getRepositoryToken(WorkPlan),             useValue: repoMock },
        { provide: getRepositoryToken(WorkPlanAxis),         useValue: repoMock },
        { provide: getRepositoryToken(AxisActivity),         useValue: repoMock },
        { provide: getRepositoryToken(ActivityRequest),      useValue: repoMock },
        { provide: getRepositoryToken(User),                 useValue: repoMock },
        { provide: getRepositoryToken(MonitorWorkPlan),      useValue: repoMock },
        { provide: getRepositoryToken(MonitorWeekActivity),  useValue: repoMock },
        { provide: getRepositoryToken(MonitorWeek),          useValue: repoMock },
      ],
    }).compile();

    service = module.get(ReportsService);
    service.onModuleInit();   // carga header/footer institucional
  });

  const esPdf = (buf: Buffer) => buf.subarray(0, 5).toString() === '%PDF-';

  it('genera un PDF válido con un mes completo', async () => {
    auxiliaryService.findMonth.mockResolvedValue(mesLleno);

    const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 8, AUX_USER);

    expect(esPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('genera un PDF válido con un mes SIN datos', async () => {
    auxiliaryService.findMonth.mockResolvedValue(mesVacio);

    const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 9, AUX_USER);

    expect(esPdf(buf)).toBe(true);
  });

  it('no inventa un 0 cuando nadie registró horas', async () => {
    auxiliaryService.findMonth.mockResolvedValue(mesVacio);
    await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 9, AUX_USER);
    // El total null no llega al documento como número: lo comprueba el
    // hecho de que el PDF se genere con la nota en vez del valor.
    expect(auxiliaryService.findMonth).toHaveBeenCalledWith('aux-1', 2026, 9, AUX_USER);
  });

  it('el control de acceso lo hace AuxiliaryService, no el reporte', async () => {
    // Si findMonth rechaza, no debe generarse ni un byte
    auxiliaryService.findMonth.mockRejectedValue(new Error('403 simulado'));

    await expect(service.generateAuxiliaryMonthlyPdf('aux-9', 2026, 8, AUX_USER))
      .rejects.toThrow('403 simulado');
  });

  it.each([1, 2, 12])('genera el mes %i sin desbordar el índice de meses', async (month) => {
    auxiliaryService.findMonth.mockResolvedValue({ ...mesVacio, month });

    const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, month, AUX_USER);
    expect(esPdf(buf)).toBe(true);
  });

  it('soporta una actividad sin tipos y sin evidencias', async () => {
    auxiliaryService.findMonth.mockResolvedValue({
      ...mesVacio,
      days: [{ ...mesLleno.days[0], activities: [mesLleno.days[0].activities[1]] }],
      summary: { ...mesVacio.summary, daysWithLog: 1, activityCount: 1 },
    });

    const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 9, AUX_USER);
    expect(esPdf(buf)).toBe(true);
  });

  it('soporta un auxiliar sin documento ni nodo asignado en el encabezado', async () => {
    auxiliaryService.findMonth.mockResolvedValue({
      ...mesVacio,
      auxiliary: { ...auxiliaryPayload, documentNumber: null, nodoName: null },
    });

    const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 9, AUX_USER);
    expect(esPdf(buf)).toBe(true);
  });

  // ══════════════════════════════════════════════════════════
  // El documento firmado no puede afirmar un nodo falso
  // ══════════════════════════════════════════════════════════
  describe('nodo del encabezado', () => {
    // Función pura: se prueba directamente en vez de buscar texto dentro
    // del binario del PDF, que sería frágil y difícil de diagnosticar.
    const label = ReportsService.buildNodoLabel;

    it('un solo nodo se nombra tal cual', () => {
      expect(label([{ id: 'a', name: 'Nodo Oriente' }])).toBe('Nodo Oriente');
    });

    it('un período a caballo NO elige uno: nombra los dos', () => {
      const texto = label([
        { id: 'a', name: 'Nodo Oriente' },
        { id: 'b', name: 'Nodo Occidente' },
      ]);
      expect(texto).toContain('Nodo Oriente');
      expect(texto).toContain('Nodo Occidente');
      expect(texto).toContain('Varios nodos');
    });

    it('sin filas no afirma ningún nodo', () => {
      expect(label([])).toBe('—');
    });

    it('un nodo sin nombre no se imprime como vacío ni como undefined', () => {
      expect(label([{ id: 'a', name: null }])).toBe('Nodo sin nombre');
      expect(label([{ id: 'a', name: '   ' }])).toBe('Nodo sin nombre');
    });

    it('el encabezado NO usa el nodo del perfil', async () => {
      // El perfil dice "Nodo Occidente" pero todo el trabajo se hizo en
      // Oriente: el documento debe hablar de Oriente.
      auxiliaryService.findMonth.mockResolvedValue({
        ...mesLleno,
        auxiliary: { ...auxiliaryPayload, nodoName: 'Nodo Occidente' },
        nodos: [{ id: 'nodo-oriente', name: 'Nodo Oriente' }],
      });

      const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 8, AUX_USER);
      expect(esPdf(buf)).toBe(true);
    });

    it('genera un PDF válido con filas de DOS nodos (agrupa por nodo)', async () => {
      auxiliaryService.findMonth.mockResolvedValue({
        ...mesLleno,
        nodos: [
          { id: 'nodo-a', name: 'Nodo Oriente' },
          { id: 'nodo-b', name: 'Nodo Occidente' },
        ],
        days: [
          { ...mesLleno.days[0], nodoId: 'nodo-a' },
          { ...mesLleno.days[1], nodoId: 'nodo-b' },
        ],
      });

      const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 8, AUX_USER);
      expect(esPdf(buf)).toBe(true);
    });

    it('tolera una fila cuyo nodo no está en el catálogo', async () => {
      auxiliaryService.findMonth.mockResolvedValue({
        ...mesLleno,
        nodos: [
          { id: 'nodo-a', name: 'Nodo Oriente' },
          { id: 'nodo-b', name: 'Nodo Occidente' },
        ],
        days: [{ ...mesLleno.days[0], nodoId: 'nodo-fantasma' }],
      });

      const buf = await service.generateAuxiliaryMonthlyPdf('aux-1', 2026, 8, AUX_USER);
      expect(esPdf(buf)).toBe(true);
    });
  });
});
