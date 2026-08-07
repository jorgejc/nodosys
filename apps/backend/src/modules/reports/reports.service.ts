/**
 * reports.service.ts — Generación de reportes PDF y Excel
 *
 * pdfmake 0.2.x: usa new PdfPrinter(fonts) → createPdfKitDocument(docDef)
 * exceljs:       usa Workbook/Worksheet API con estilos completos
 */
import {
  Injectable, NotFoundException, BadRequestException,
  ForbiddenException, Logger, OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between, FindOptionsWhere } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
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
import { MonitorsService } from '../monitors/monitors.service';
import { fetchImageAsDataUri } from './remote-image.util';
import * as ExcelJS from 'exceljs';

// pdfmake 0.3.x — importar así para Node.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfsFonts = require('pdfmake/build/vfs_fonts');


// ── Etiquetas de dominio ──────────────────────────────────
const AXIS_LABELS: Record<string, string> = {
  docencia_directa:                  '1. Docencia Directa',
  trabajos_de_grado:                 '2. Asesoría de Trabajos de Grado',
  investigacion:                     '3. Investigación',
  extension:                         '4. Extensión',
  gestion_de_programas:              '5a. Gestión de Programas',
  representacion_cuerpos_colegiados: '5b. Representación en Cuerpos Colegiados',
  otras_administrativas:             '5c. Otras Actividades Administrativas',
};

const CONDITION_LABELS: Record<string, string> = {
  excelente: 'Excelente', bueno: 'Bueno',
  regular: 'Regular', malo: 'Malo', dado_de_baja: 'Dado de baja',
};

const STATUS_LABELS: Record<string, string> = {
  disponible: 'Disponible', en_prestamo: 'En préstamo',
  en_reparacion: 'En reparación', dado_de_baja: 'Dado de baja',
};

// Helper: generar PDF desde docDef → Promise<Buffer>
// Fonts de pdfmake 0.2.x
const pdfFonts = {
  Roboto: {
    normal:      Buffer.from(vfsFonts['Roboto-Regular.ttf'], 'base64'),
    bold:        Buffer.from(vfsFonts['Roboto-Medium.ttf'], 'base64'),
    italics:     Buffer.from(vfsFonts['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfsFonts['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

function buildPdf(docDefinition: object): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const printer = new PdfPrinter(pdfFonts);
      const doc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Asset loader ─────────────────────────────────────────
function readPngBase64(filename: string): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', filename),
    path.join(process.cwd(), 'src', 'assets', filename),
    path.join(process.cwd(), 'apps', 'backend', 'src', 'assets', filename),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
      }
    } catch { /* try next */ }
  }
  return '';
}

function getPngRatio(filename: string, fallback: number): number {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', filename),
    path.join(process.cwd(), 'src', 'assets', filename),
    path.join(process.cwd(), 'apps', 'backend', 'src', 'assets', filename),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = Buffer.alloc(24);
        const fd = fs.openSync(p, 'r');
        fs.readSync(fd, buf, 0, 24, 0);
        fs.closeSync(fd);
        return buf.readUInt32BE(20) / buf.readUInt32BE(16);
      }
    } catch { /* try next */ }
  }
  return fallback;
}

@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly log = new Logger(ReportsService.name);

  private headerBase64  = '';
  private footerBase64  = '';
  private headerRatio   = 106 / 794;
  private footerRatio   = 114 / 857;

  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryUnit)
    private readonly unitRepo: Repository<InventoryUnit>,
    @InjectRepository(WorkPlan)
    private readonly planRepo: Repository<WorkPlan>,
    @InjectRepository(WorkPlanAxis)
    private readonly axisRepo: Repository<WorkPlanAxis>,
    @InjectRepository(AxisActivity)
    private readonly activityRepo: Repository<AxisActivity>,
    @InjectRepository(ActivityRequest)
    private readonly actReqRepo: Repository<ActivityRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    // ── Monitorías ──
    @InjectRepository(MonitorWorkPlan)
    private readonly monitorPlanRepo: Repository<MonitorWorkPlan>,
    @InjectRepository(MonitorWeekActivity)
    private readonly monitorActivityRepo: Repository<MonitorWeekActivity>,
    @InjectRepository(MonitorWeek)
    private readonly monitorWeekRepo: Repository<MonitorWeek>,
    // Dueño del control de acceso de monitorías (rol + aislamiento por nodo)
    private readonly monitorsService: MonitorsService,
  ) {}

  onModuleInit() {
    this.headerBase64 = readPngBase64('iudigital-header.png');
    this.footerBase64 = readPngBase64('iudigital-footer.png');
    this.headerRatio  = getPngRatio('iudigital-header.png', 106 / 794);
    this.footerRatio  = getPngRatio('iudigital-footer.png', 114 / 857);
    if (this.headerBase64) {
      this.log.log(`Institutional images loaded — header ratio ${this.headerRatio.toFixed(4)}, footer ratio ${this.footerRatio.toFixed(4)}`);
    } else {
      this.log.warn('Institutional images NOT found — PDFs will use text headers');
    }
  }

  private headerHPt(pageWidthPt: number) { return Math.ceil(this.headerRatio * pageWidthPt); }
  private footerHPt(pageWidthPt: number) { return Math.ceil(this.footerRatio * pageWidthPt); }
  private topMarginPt(pageWidthPt: number)    { return this.headerHPt(pageWidthPt) + 10; }
  private bottomMarginPt(pageWidthPt: number) { return this.footerHPt(pageWidthPt) + 14; }

  private makePdfHeader() {
    if (!this.headerBase64) return undefined;
    const ratio = this.headerRatio;
    const data  = this.headerBase64;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_p: number, _c: number, ps: any) => ({
      image: data, width: ps.width, height: Math.ceil(ratio * ps.width), margin: [0, 0, 0, 0],
    });
  }

  private makePdfFooter() {
    if (!this.footerBase64) return undefined;
    const ratio = this.footerRatio;
    const data  = this.footerBase64;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (page: number, pages: number, ps: any) => ([
      { text: `Página ${page} de ${pages}`, fontSize: 7, color: '#555555', alignment: 'right', margin: [0, 0, 10, 3] },
      { image: data, width: ps.width, height: Math.ceil(ratio * ps.width), margin: [0, 0, 0, 0] },
    ]);
  }

  // ══════════════════════════════════════════════════════════
  // INVENTARIO → PDF
  // ══════════════════════════════════════════════════════════
  private fmtPdfLocation(item: InventoryItem): string {
    if (!item.locationType) return '—';
    if (item.locationType === 'gabinete') {
      const parts = [
        item.cabinetNumber ? `G${item.cabinetNumber}` : null,
        item.shelfNumber   ? `E${item.shelfNumber}`   : null,
      ].filter(Boolean);
      return parts.length ? parts.join('/') : '—';
    }
    // mobiliario_suelto
    if (!item.locationNote) return '—';
    return item.locationNote.length > 22 ? item.locationNote.substring(0, 22) + '…' : item.locationNote;
  }

  async generateInventoryPdf(nodoId?: string, nodoLabel = 'IU DIGITAL'): Promise<Buffer> {
    const items = await this.itemRepo.find({
      where: { deletedAt: IsNull(), ...(nodoId ? { nodoId } : {}) },
      relations: ['category', 'units'],
      order: { category: { name: 'ASC' }, name: 'ASC' },
    });

    // Agrupar por categoría
    const byCategory: Record<string, typeof items> = {};
    items.forEach(item => {
      const cat = item.category?.name ?? 'Sin categoría';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    // LETTER landscape: 792pt wide, margins [40,top,40,bottom] → 712pt usable
    // 8 columnas: [20,'*',88,68,32,42,42,50] → fixed=342 → '*'=370pt
    const COLS = 8;
    const tableBody: unknown[][] = [[
      { text: '#',             style: 'th' },
      { text: 'Ítem',         style: 'th' },
      { text: 'Marca / Modelo', style: 'th' },
      { text: 'Ubicación',    style: 'th' },
      { text: 'Total',        style: 'th' },
      { text: 'Disponible',   style: 'th' },
      { text: 'Préstamo',     style: 'th' },
      { text: 'Problemas',    style: 'th' },
    ]];

    let seq = 1;
    Object.entries(byCategory).forEach(([catName, catItems]) => {
      tableBody.push([
        { text: `  ${catName}`, colSpan: COLS, style: 'catRow', fillColor: '#1E1E1E' },
        '', '', '', '', '', '', '',
      ]);
      catItems.forEach(item => {
        const units   = item.units ?? [];
        const avail   = units.filter(u => u.status === 'disponible').length;
        const loan    = units.filter(u => u.status === 'en_prestamo').length;
        const damaged = units.filter(u => ['malo','dado_de_baja'].includes(u.condition)).length;
        tableBody.push([
          { text: seq++,                            style: 'td', alignment: 'center' },
          { text: item.name,                        style: 'td' },
          { text: [item.brand, item.model].filter(Boolean).join(' · ') || '—', style: 'tdMuted' },
          { text: this.fmtPdfLocation(item),        style: 'tdMuted' },
          { text: units.length,                     style: 'td', alignment: 'center', bold: true },
          { text: avail,                            style: 'td', alignment: 'center', color: '#4ADE80' },
          { text: loan || '—',                      style: 'td', alignment: 'center', color: '#38BDF8' },
          { text: damaged || '—',                   style: 'td', alignment: 'center',
            color: damaged > 0 ? '#F87171' : '#666666', bold: damaged > 0 },
        ]);
      });
    });

    const totalUnits   = items.reduce((s, i) => s + (i.units?.length ?? 0), 0);
    const totalAvail   = items.reduce((s, i) => s + (i.units?.filter(u => u.status === 'disponible').length ?? 0), 0);
    const totalDamaged = items.reduce((s, i) => s + (i.units?.filter(u => ['malo','dado_de_baja'].includes(u.condition)).length ?? 0), 0);
    tableBody.push([
      { text: 'TOTAL', colSpan: 4, style: 'totalRow', fillColor: '#FF6B2B', color: '#FFFFFF', bold: true },
      '', '', '',
      { text: totalUnits,                           style: 'totalRow', fillColor: '#FF6B2B', color: '#FFFFFF', bold: true, alignment: 'center' },
      { text: totalAvail,                           style: 'totalRow', fillColor: '#FF6B2B', color: '#4ADE80', bold: true, alignment: 'center' },
      { text: totalUnits - totalAvail - totalDamaged, style: 'totalRow', fillColor: '#FF6B2B', color: '#38BDF8', bold: true, alignment: 'center' },
      { text: totalDamaged,                         style: 'totalRow', fillColor: '#FF6B2B', color: '#F87171', bold: true, alignment: 'center' },
    ]);

    // LETTER landscape → pageWidth = 792pt
    const PW = 792;
    const docDef = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [40, this.topMarginPt(PW), 40, this.bottomMarginPt(PW)],
      header: this.makePdfHeader() ?? {
        columns: [
          { text: `NODOSYS · IU DIGITAL · ${nodoLabel}`, fontSize: 8, color: '#888888', margin: [40, 15, 0, 0] },
          { text: `Generado: ${new Date().toLocaleDateString('es-CO')}`, fontSize: 8, color: '#888888', alignment: 'right', margin: [0, 15, 40, 0] },
        ],
      },
      footer: this.makePdfFooter() ?? ((page: number, pages: number) => ({
        text: `Página ${page} de ${pages}  ·  NodoSys Sistema de Gestión`,
        fontSize: 8, color: '#555555', alignment: 'center', margin: [0, 10, 0, 0],
      })),
      content: [
        { text: 'REPORTE DE INVENTARIO', style: 'title' },
        { text: 'Estado actual de todos los equipos y materiales del nodo', style: 'subtitle' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 712, y2: 0, lineWidth: 2, lineColor: '#FF6B2B' }], margin: [0, 0, 0, 14] },
        {
          table: {
            headerRows: 1,
            // fixed: 20+88+68+32+42+42+50 = 342 → '*' = 712-342 = 370
            widths: [20, '*', 88, 68, 32, 42, 42, 50],
            body: tableBody,
          },
          layout: {
            fillColor: (row: number) => row === 0 ? '#222222' : null,
            hLineColor: () => '#2A2A2A',
            vLineColor: () => '#2A2A2A',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
        {
          text: `\nTotal: ${items.length} modelos · ${totalUnits} unidades · ${totalAvail} disponibles · ${totalDamaged} con problemas`,
          fontSize: 9, color: '#888888', margin: [0, 8, 0, 0],
        },
      ],
      styles: {
        title:    { fontSize: 18, bold: true, color: '#FFFFFF', margin: [0, 0, 0, 4] },
        subtitle: { fontSize: 10, color: '#888888', margin: [0, 0, 0, 10] },
        th:       { fontSize: 9, bold: true, color: '#FFFFFF', margin: [3, 3] },
        td:       { fontSize: 9, color: '#DDDDDD', margin: [3, 3] },
        tdMuted:  { fontSize: 8, color: '#888888', margin: [3, 3] },
        catRow:   { fontSize: 9, bold: true, color: '#FF6B2B', margin: [3, 5] },
        totalRow: { fontSize: 9, margin: [3, 4] },
      },
      defaultStyle: { font: 'Roboto', color: '#DDDDDD' },
    };

    return buildPdf(docDef);
  }

  // ══════════════════════════════════════════════════════════
  // INVENTARIO → EXCEL
  // ══════════════════════════════════════════════════════════
  async generateInventoryExcel(nodoId?: string, nodoLabel = 'IU DIGITAL'): Promise<Buffer> {
    const items = await this.itemRepo.find({
      where: { deletedAt: IsNull(), ...(nodoId ? { nodoId } : {}) },
      relations: ['category', 'units'],
      order: { category: { name: 'ASC' }, name: 'ASC' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NodoSys · IU Digital';
    wb.created = new Date();

    // ── Hoja 1: Resumen por ítem ──────────────────────────
    const ws1 = wb.addWorksheet('Resumen Inventario');

    // Título (10 columnas: A:J)
    ws1.mergeCells('A1:J1');
    const titleCell = ws1.getCell('A1');
    titleCell.value = `INVENTARIO ${nodoLabel} · IU DIGITAL`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 30;

    ws1.mergeCells('A2:J2');
    const subCell = ws1.getCell('A2');
    subCell.value = `Generado: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'full' })}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF888888' } };
    subCell.alignment = { horizontal: 'center' };

    // Encabezados — añadida columna Ubicación (F)
    const headers = ['#', 'Categoría', 'Ítem', 'Marca', 'Modelo', 'Ubicación', 'Total', 'Disponibles', 'En Préstamo', 'Con Problemas'];
    const hr = ws1.getRow(4);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { bottom: { style: 'medium', color: { argb: 'FFFF6B2B' } } };
    });
    ws1.getRow(4).height = 22;

    let seq = 1;
    let excelRow = 5;
    items.forEach(item => {
      const units   = item.units ?? [];
      const avail   = units.filter(u => u.status === 'disponible').length;
      const loan    = units.filter(u => u.status === 'en_prestamo').length;
      const damaged = units.filter(u => ['malo','dado_de_baja'].includes(u.condition)).length;
      const row = ws1.getRow(excelRow++);
      row.values = [seq++, item.category?.name ?? '', item.name, item.brand ?? '—', item.model ?? '—',
        this.fmtPdfLocation(item), units.length, avail, loan, damaged];
      const bg = excelRow % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF';
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.font = { size: 10 };
        c.alignment = { vertical: 'middle' };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
      });
      if (damaged > 0) row.getCell(10).font = { bold: true, color: { argb: 'FFCC0000' }, size: 10 };
    });
    [4, 15, 32, 14, 16, 20, 10, 13, 13, 14].forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

    // ── Hoja 2: Unidades físicas ──────────────────────────
    const ws2 = wb.addWorksheet('Unidades Físicas');
    ws2.mergeCells('A1:J1');
    const t2 = ws2.getCell('A1');
    t2.value = 'UNIDADES FÍSICAS · DETALLE INDIVIDUAL';
    t2.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
    t2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(1).height = 26;

    const uh = ['#', 'Categoría', 'Ítem', 'Serial', 'Código Interno', 'Condición', 'Estado', 'Ubicación', 'Fecha Ingreso', 'Valor COP'];
    const uhr = ws2.getRow(3);
    uh.forEach((h, i) => {
      const c = uhr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
      c.alignment = { horizontal: 'center' };
      c.border = { bottom: { style: 'medium', color: { argb: 'FFFF6B2B' } } };
    });

    let unitSeq = 1;
    let unitRow = 4;
    const condColors: Record<string, string> = {
      excelente: 'FFE8F5E9', bueno: 'FFF1F8E9',
      regular: 'FFFFF8E1', malo: 'FFFFEBEE', dado_de_baja: 'FFEEEEEE',
    };
    items.forEach(item => {
      (item.units ?? []).forEach(u => {
        const row = ws2.getRow(unitRow++);
        row.values = [
          unitSeq++,
          item.category?.name ?? '',
          item.name,
          u.serialNumber ?? '—',
          u.internalCode ?? '—',
          CONDITION_LABELS[u.condition] ?? u.condition,
          STATUS_LABELS[u.status] ?? u.status,
          u.location,
          u.acquisitionDate ? new Date(u.acquisitionDate).toLocaleDateString('es-CO') : '—',
          u.acquisitionValue ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(u.acquisitionValue) : '—',
        ];
        const bg = condColors[u.condition] ?? 'FFFFFFFF';
        row.eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          c.font = { size: 10 };
          c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
        });
      });
    });
    [4, 14, 28, 18, 16, 12, 14, 20, 14, 18].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ══════════════════════════════════════════════════════════
  // PLAN DE TRABAJO → PDF
  // ══════════════════════════════════════════════════════════
  async generateWorkPlanPdf(planId: string): Promise<Buffer> {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['user', 'axes', 'axes.activities'],
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const axes = plan.axes.sort((a, b) => a.displayOrder - b.displayOrder);
    const totalExecuted = axes.flatMap(ax => ax.activities ?? [])
      .reduce((s, a) => s + Number(a.executedHours || 0), 0);
    const completionPct = plan.totalHours > 0
      ? ((totalExecuted / Number(plan.totalHours)) * 100).toFixed(1) : '0';

    const content: unknown[] = [
      // Encabezado del documento
      {
        columns: [
          { text: 'IU DIGITAL\nDE ANTIOQUIA', fontSize: 9, bold: true, color: '#FF6B2B', width: 90 },
          { text: 'PLAN DE TRABAJO PROFESORAL', fontSize: 16, bold: true, alignment: 'center', color: '#FFFFFF' },
          { text: 'DO-F-002\nVersión 02', fontSize: 8, alignment: 'right', color: '#888888' },
        ],
        margin: [0, 0, 0, 8],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 770, y2: 0, lineWidth: 2, lineColor: '#FF6B2B' }], margin: [0, 0, 0, 12] },

      // Info del docente
      {
        table: {
          widths: [140, '*', 100, '*'],
          body: [
            [
              { text: 'RESOLUCIÓN RECTORAL', style: 'infoLabel' }, { text: plan.resolutionNumber ?? '—', style: 'infoVal' },
              { text: 'SEMESTRE', style: 'infoLabel' }, { text: plan.semester, style: 'infoVal' },
            ],
            [
              { text: 'FACULTAD / DEPENDENCIA', style: 'infoLabel' }, { text: plan.faculty ?? '—', style: 'infoVal', colSpan: 3 }, '', '',
            ],
            [
              { text: 'DOCENTE', style: 'infoLabel' }, { text: plan.user?.name ?? '—', style: 'infoVal' },
              { text: 'ÁREA / PROGRAMA', style: 'infoLabel' }, { text: plan.program ?? '—', style: 'infoVal' },
            ],
            [
              { text: 'TOTAL HORAS PLAN', style: 'infoLabel' }, { text: `${plan.totalHours} horas`, style: 'infoVal' },
              { text: 'AVANCE GENERAL', style: 'infoLabel' },
              { text: `${totalExecuted}h ejecutadas (${completionPct}%)`, style: 'infoVal', color: '#FF6B2B', bold: true },
            ],
          ],
        },
        layout: {
          fillColor: (r: number) => r % 2 === 0 ? '#181818' : '#111111',
          hLineColor: () => '#2A2A2A', vLineColor: () => '#2A2A2A',
        },
        margin: [0, 0, 0, 14],
      },
    ];

    // Actividades por eje
    axes.forEach(axis => {
      const acts = axis.activities ?? [];
      const axisExec = acts.reduce((s, a) => s + Number(a.executedHours || 0), 0);
      const pctPlan = plan.totalHours > 0 ? ((Number(axis.plannedHours) / Number(plan.totalHours)) * 100).toFixed(1) : '0';
      const pctExec = axis.plannedHours > 0 ? ((axisExec / Number(axis.plannedHours)) * 100).toFixed(1) : '0';

      content.push(
        {
          columns: [
            { text: AXIS_LABELS[axis.axisType] ?? axis.axisType, style: 'axisTitle', width: '*' },
            { text: `Plan: ${axis.plannedHours}h (${pctPlan}% del plan) | Ejecutado: ${axisExec}h (${pctExec}%)`, fontSize: 8, color: '#888888', alignment: 'right', width: 230 },
          ],
          margin: [0, 10, 0, 4],
        },
      );

      if (acts.length === 0) {
        content.push({ text: 'Sin actividades registradas.', fontSize: 8, color: '#555555', margin: [0, 0, 0, 6] });
        return;
      }

      const actBody: unknown[][] = [[
        { text: 'Actividad específica', style: 'actTh' },
        { text: 'Descripción / Relación con el eje', style: 'actTh' },
        { text: 'Dimensiones', style: 'actTh' },
        { text: 'Estado', style: 'actTh' },
        { text: 'Fechas', style: 'actTh' },
        { text: 'Soporte', style: 'actTh' },
        { text: 'H.Plan', style: 'actTh' },
        { text: 'H.Ejec', style: 'actTh' },
      ]];

      acts.forEach(act => {
        const dims = [
          act.dimInclusion   ? 'Inclusión'    : '',
          act.dimTerritorial ? 'Territorial'   : '',
          act.dimHuman       ? 'Sentido H.'    : '',
        ].filter(Boolean).join('\n') || '—';

        const dates = [
          act.startDate ? new Date(act.startDate).toLocaleDateString('es-CO') : '',
          act.endDate   ? new Date(act.endDate  ).toLocaleDateString('es-CO') : '',
        ].filter(Boolean).join(' -\n') || '—';

        const totalH = (act.weeks && act.hoursPerWeek)
          ? act.weeks * act.hoursPerWeek
          : Number(act.plannedHours);

        const statusColor = act.activityStatus === 'finalizada' ? '#4ADE80'
          : act.activityStatus === 'en_proceso' ? '#FFB830' : '#666666';

        actBody.push([
          { text: act.name, style: 'actTd' },
          { text: act.specificDescription ?? '—', style: 'actTdMuted' },
          { text: dims, style: 'actTdMuted', color: '#FF6B2B' },
          { text: act.activityStatus.replace('_', ' '), style: 'actTd', color: statusColor },
          { text: dates, style: 'actTdMuted' },
          {
            text: act.evidenceType ? `${act.evidenceType}` : '—',
            style: 'actTdMuted',
            color: act.evidenceUrl ? '#38BDF8' : '#555555',
          },
          { text: totalH || 0, style: 'actTd', alignment: 'center' },
          { text: Number(act.executedHours) || 0, style: 'actTd', alignment: 'center', color: '#4ADE80' },
        ]);
      });

      content.push({
        table: { headerRows: 1, widths: ['*', 90, 52, 42, 52, 38, 28, 28], body: actBody },
        layout: {
          fillColor: (r: number) => r === 0 ? '#1E1E1E' : r % 2 === 0 ? '#131313' : '#0D0D0D',
          hLineColor: () => '#2A2A2A', vLineColor: () => '#2A2A2A',
          hLineWidth: () => 0.3, vLineWidth: () => 0.3,
          paddingTop: () => 3, paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 6],
      });
    });

    // LEGAL landscape: 14in × 8.5in = 1008pt × 612pt
    return buildPdf({
      pageSize: 'LEGAL',
      pageOrientation: 'landscape',
      pageMargins: [28, this.topMarginPt(1008), 28, this.bottomMarginPt(1008)],
      header: this.makePdfHeader() ?? {
        columns: [
          { text: 'NodoSys · IU Digital', fontSize: 7, color: '#555555', margin: [28, 14, 0, 0] },
          { text: `Generado: ${new Date().toLocaleString('es-CO')}`, fontSize: 7, color: '#555555', alignment: 'right', margin: [0, 14, 28, 0] },
        ],
      },
      footer: this.makePdfFooter() ?? ((page: number, pages: number) => ({
        text: `Página ${page} de ${pages}  ·  Plan de Trabajo Profesoral DO-F-002 · IU Digital`,
        fontSize: 7, color: '#555555', alignment: 'center', margin: [0, 8, 0, 0],
      })),
      content,
      styles: {
        axisTitle: { fontSize: 11, bold: true, color: '#FF6B2B' },
        actTh:     { fontSize: 8, bold: true, color: '#FFFFFF', margin: [2, 3] },
        actTd:     { fontSize: 8, color: '#DDDDDD', margin: [2, 2] },
        actTdMuted:{ fontSize: 7, color: '#AAAAAA', margin: [2, 2] },
        infoLabel: { fontSize: 8, bold: true, color: '#AAAAAA', margin: [4, 3] },
        infoVal:   { fontSize: 9, color: '#FFFFFF', margin: [4, 3] },
      },
      defaultStyle: { font: 'Roboto', color: '#DDDDDD' },
    });
  }

  // ══════════════════════════════════════════════════════════
  // PLAN DE TRABAJO → EXCEL
  // ══════════════════════════════════════════════════════════
  async generateWorkPlanExcel(planId: string): Promise<Buffer> {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['user', 'axes', 'axes.activities'],
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NodoSys · IU Digital';

    const ws = wb.addWorksheet('Plan de Trabajo');

    // Título
    ws.mergeCells('A1:I1');
    const tc = ws.getCell('A1');
    tc.value = 'PLAN DE TRABAJO PROFESORAL  ·  DO-F-002';
    tc.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    // Info general
    const info = [
      ['RESOLUCIÓN RECTORAL', plan.resolutionNumber ?? '—', 'SEMESTRE', plan.semester],
      ['FACULTAD / DEPENDENCIA', plan.faculty ?? '—', 'ÁREA / PROGRAMA', plan.program ?? '—'],
      ['DOCENTE', plan.user?.name ?? '—', 'TOTAL HORAS PLAN', String(plan.totalHours)],
    ];
    let row = 3;
    info.forEach(([l1, v1, l2, v2]) => {
      ws.mergeCells(`B${row}:C${row}`);
      ws.mergeCells(`F${row}:I${row}`);
      const r = ws.getRow(row++);
      r.getCell(1).value = l1; r.getCell(1).font = { bold: true, size: 10 }; r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8E4F0' } };
      r.getCell(2).value = v1; r.getCell(2).font = { size: 10 };
      r.getCell(4).value = l2; r.getCell(4).font = { bold: true, size: 10 }; r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8E4F0' } };
      r.getCell(6).value = v2; r.getCell(6).font = { size: 10 };
      r.height = 18;
    });
    row++;

    // Actividades por eje
    const axes = plan.axes.sort((a, b) => a.displayOrder - b.displayOrder);
    axes.forEach(axis => {
      const acts = axis.activities ?? [];
      const axisExec = acts.reduce((s, a) => s + Number(a.executedHours || 0), 0);

      // Encabezado del eje
      ws.mergeCells(`A${row}:I${row}`);
      const axisRow = ws.getRow(row++);
      axisRow.getCell(1).value = `${AXIS_LABELS[axis.axisType] ?? axis.axisType}  ·  Plan: ${axis.plannedHours}h | Ejecutado: ${axisExec}h`;
      axisRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      axisRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
      axisRow.height = 22;

      if (acts.length === 0) { row++; return; }

      // Encabezados de tabla según el tipo de eje
      const isDocencia  = axis.axisType === 'docencia_directa';
      const isTesis     = axis.axisType === 'trabajos_de_grado';
      const colHeaders  = isDocencia
        ? ['N°', 'Asignatura', 'Código Grupo', 'Estudiantes', 'Nivel', 'Tipo', 'Semanas', 'H/Semana', 'Total H']
        : isTesis
        ? ['N°', 'Modalidad', 'Estudiante', 'Semanas', 'Horas', 'Total H', 'Estado', 'Fechas', 'Soporte']
        : ['N°', 'Actividad', 'Descripción', 'H. Planeadas', 'H. Ejecutadas', 'Estado', 'Inicio', 'Fin', 'Soporte'];

      const hRow = ws.getRow(row++);
      colHeaders.forEach((h, i) => {
        const c = hRow.getCell(i + 1);
        c.value = h;
        c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
        c.alignment = { horizontal: 'center', wrapText: true };
        c.border = { bottom: { style: 'thin' } };
      });
      hRow.height = 28;

      acts.forEach((act, i) => {
        const aRow = ws.getRow(row++);
        const totalH = (act.weeks && act.hoursPerWeek) ? act.weeks * act.hoursPerWeek : Number(act.plannedHours);
        if (isDocencia) {
          aRow.values = [i+1, act.name, act.courseCode ?? '—', act.numStudents ?? '—', act.level ?? '—', act.courseType ?? '—', act.weeks ?? '—', act.hoursPerWeek ?? '—', totalH];
        } else if (isTesis) {
          aRow.values = [i+1, act.thesisModality ?? '—', act.studentName ?? '—', act.weeks ?? '—', act.hoursPerWeek ?? '—', totalH, act.activityStatus, '', act.evidenceType ?? '—'];
        } else {
          aRow.values = [i+1, act.name, act.specificDescription ?? '—', act.plannedHours, act.executedHours, act.activityStatus,
            act.startDate ? new Date(act.startDate).toLocaleDateString('es-CO') : '—',
            act.endDate   ? new Date(act.endDate  ).toLocaleDateString('es-CO') : '—',
            act.evidenceType ?? '—'];
        }
        aRow.font = { size: 9 };
        aRow.eachCell(c => {
          c.alignment = { wrapText: true, vertical: 'middle' };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF9F9F9' : 'FFFFFFFF' } };
          c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
        });
        aRow.height = 20;
      });
      row++;
    });

    // Resumen final
    ws.mergeCells(`A${row}:I${row}`);
    const finalRow = ws.getRow(row);
    const totalExecuted = axes.flatMap(ax => ax.activities ?? []).reduce((s, a) => s + Number(a.executedHours || 0), 0);
    finalRow.getCell(1).value = `TOTAL: ${totalExecuted} horas ejecutadas de ${plan.totalHours} planeadas`;
    finalRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    finalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
    finalRow.getCell(1).alignment = { horizontal: 'center' };
    finalRow.height = 24;

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 36;
    ws.getColumn(3).width = 22;
    [4,5,6,7,8,9].forEach(i => { ws.getColumn(i).width = 13; });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ══════════════════════════════════════════════════════════
  // ACTIVIDADES → helpers internos
  // ══════════════════════════════════════════════════════════

  private readonly ACTIVITY_ROLES_GLOBAL: UserRole[] = [
    UserRole.ADMIN, UserRole.VICERRECTOR_EXTENSION,
  ];

  private readonly STATUS_LABELS_ACT: Record<string, string> = {
    borrador:     'Borrador',
    pendiente:    'Pendiente',
    aprobada:     'Aprobada',
    rechazada:    'Rechazada',
    en_ejecucion: 'En ejecución',
    ejecutada:    'Ejecutada',
    cerrada:      'Cerrada',
  };

  private async fetchActivities(
    user: User,
    filters: { dateFrom?: string; dateTo?: string; status?: string; userId?: string; nodoId?: string },
  ): Promise<ActivityRequest[]> {
    const qb = this.actReqRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('r.strategy', 'st')
      .leftJoinAndSelect('r.municipality', 'mu')
      .orderBy('r.activity_date', 'DESC');

    if (!this.ACTIVITY_ROLES_GLOBAL.includes(user.role)) {
      qb.andWhere('r.user_id = :uid', { uid: user.id });
    } else if (filters.userId) {
      qb.andWhere('r.user_id = :uid', { uid: filters.userId });
    }

    if (filters.nodoId && this.ACTIVITY_ROLES_GLOBAL.includes(user.role)) {
      qb.andWhere('u.nodo_id = :nodoId', { nodoId: filters.nodoId });
    }
    if (filters.status)   qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.dateFrom) qb.andWhere('r.activity_date >= :df', { df: filters.dateFrom });
    if (filters.dateTo)   qb.andWhere('r.activity_date <= :dt', { dt: filters.dateTo });

    return qb.getMany();
  }

  private fmtDateAct(d: Date | string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private fmtCOP(n: number | null | undefined): string {
    if (!n) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }

  // ══════════════════════════════════════════════════════════
  // ACTIVIDADES → PDF
  // ══════════════════════════════════════════════════════════
  async generateActivitiesPdf(
    user: User,
    filters: { dateFrom?: string; dateTo?: string; status?: string; userId?: string; nodoId?: string },
  ): Promise<Buffer> {
    const records = await this.fetchActivities(user, filters);

    const tableBody: unknown[][] = [[
      { text: 'Código',        style: 'th' },
      { text: 'Título',        style: 'th' },
      { text: 'Docente',       style: 'th' },
      { text: 'Fecha',         style: 'th' },
      { text: 'Municipio',     style: 'th' },
      { text: 'Estrategia',    style: 'th' },
      { text: 'Participantes', style: 'th' },
      { text: 'Total COP',     style: 'th' },
      { text: 'Estado',        style: 'th' },
      { text: 'Pago',          style: 'th' },
    ]];

    records.forEach((r, i) => {
      const total = (r as any).totalEstimated ?? 0;
      tableBody.push([
        { text: r.activityCode ?? '—', style: 'tdMono' },
        { text: r.title, style: 'td' },
        { text: (r as any).user?.name ?? '—', style: 'tdMuted' },
        { text: this.fmtDateAct(r.activityDate), style: 'tdMono' },
        { text: (r as any).municipality?.name ?? '—', style: 'tdMuted' },
        { text: (r as any).strategy?.name ?? '—', style: 'tdMuted' },
        { text: r.estimatedParticipants ?? '—', style: 'td', alignment: 'center' },
        { text: this.fmtCOP(total), style: 'tdMono' },
        {
          text: this.STATUS_LABELS_ACT[r.status] ?? r.status,
          style: 'td',
          color: r.status === 'aprobada' ? '#4ADE80'
            : r.status === 'rechazada'   ? '#F87171'
            : r.status === 'cerrada'     ? '#888888' : '#DDDDDD',
        },
        { text: r.paymentType ?? '—', style: 'tdMuted' },
      ]);
    });

    if (records.length === 0) {
      tableBody.push([{ text: 'Sin registros para los filtros seleccionados.', colSpan: 10, style: 'tdMuted', alignment: 'center' }, ...Array(9).fill('')]);
    }

    const subtitle = [
      filters.dateFrom ? `Desde: ${filters.dateFrom}` : null,
      filters.dateTo   ? `Hasta: ${filters.dateTo}`   : null,
      filters.status   ? `Estado: ${this.STATUS_LABELS_ACT[filters.status] ?? filters.status}` : null,
    ].filter(Boolean).join('  ·  ') || 'Todos los registros';

    const docDef = {
      pageSize: 'LEGAL',
      pageOrientation: 'landscape',
      pageMargins: [28, this.topMarginPt(1008), 28, this.bottomMarginPt(1008)],
      header: this.makePdfHeader() ?? {
        columns: [
          { text: 'NodoSys · IU Digital · Reporte de Actividades', fontSize: 7, color: '#555555', margin: [28, 14, 0, 0] },
          { text: `Generado: ${new Date().toLocaleString('es-CO')}`, fontSize: 7, color: '#555555', alignment: 'right', margin: [0, 14, 28, 0] },
        ],
      },
      footer: this.makePdfFooter() ?? ((page: number, pages: number) => ({
        text: `Página ${page} de ${pages}  ·  Reporte de Actividades · IU Digital`,
        fontSize: 7, color: '#555555', alignment: 'center', margin: [0, 8, 0, 0],
      })),
      content: [
        { text: 'REPORTE DE ACTIVIDADES Y VIÁTICOS', style: 'title' },
        { text: subtitle, style: 'subtitle' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 970, y2: 0, lineWidth: 2, lineColor: '#FF6B2B' }], margin: [0, 0, 0, 12] },
        {
          table: {
            headerRows: 1,
            widths: [46, '*', 80, 54, 68, 68, 44, 62, 54, 40],
            body: tableBody,
          },
          layout: {
            fillColor: (row: number) => row === 0 ? '#222222' : row % 2 === 0 ? '#131313' : '#0D0D0D',
            hLineColor: () => '#2A2A2A', vLineColor: () => '#2A2A2A',
            hLineWidth: () => 0.4, vLineWidth: () => 0.4,
            paddingTop: () => 3, paddingBottom: () => 3,
          },
        },
        { text: `\nTotal: ${records.length} actividades`, fontSize: 9, color: '#888888', margin: [0, 8, 0, 0] },
      ],
      styles: {
        title:   { fontSize: 14, bold: true, color: '#FFFFFF', margin: [0, 0, 0, 4] },
        subtitle:{ fontSize: 9,  color: '#888888', margin: [0, 0, 0, 10] },
        th:      { fontSize: 8, bold: true, color: '#FFFFFF', margin: [2, 3] },
        td:      { fontSize: 8, color: '#DDDDDD', margin: [2, 2] },
        tdMuted: { fontSize: 7, color: '#AAAAAA', margin: [2, 2] },
        tdMono:  { fontSize: 7, color: '#CCCCCC', margin: [2, 2] },
      },
      defaultStyle: { font: 'Roboto', color: '#DDDDDD' },
    };

    return buildPdf(docDef);
  }

  // ══════════════════════════════════════════════════════════
  // ACTIVIDADES → EXCEL
  // ══════════════════════════════════════════════════════════
  async generateActivitiesExcel(
    user: User,
    filters: { dateFrom?: string; dateTo?: string; status?: string; userId?: string; nodoId?: string },
  ): Promise<Buffer> {
    const records = await this.fetchActivities(user, filters);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NodoSys · IU Digital';
    wb.created = new Date();

    const ws = wb.addWorksheet('Actividades');

    ws.mergeCells('A1:J1');
    const tc = ws.getCell('A1');
    tc.value = 'REPORTE DE ACTIVIDADES Y VIÁTICOS  ·  IU DIGITAL';
    tc.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:J2');
    const sc = ws.getCell('A2');
    const subtitle = [
      filters.dateFrom ? `Desde: ${filters.dateFrom}` : null,
      filters.dateTo   ? `Hasta: ${filters.dateTo}`   : null,
      filters.status   ? `Estado: ${this.STATUS_LABELS_ACT[filters.status] ?? filters.status}` : null,
    ].filter(Boolean).join('  ·  ') || 'Todos los registros';
    sc.value = `${subtitle}  ·  Generado: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'full' })}`;
    sc.font = { italic: true, size: 9, color: { argb: 'FF888888' } };
    sc.alignment = { horizontal: 'center' };

    const headers = ['Código', 'Título', 'Docente', 'Fecha', 'Municipio', 'Estrategia', 'Participantes', 'Total COP', 'Estado', 'Tipo Pago'];
    const hr = ws.getRow(4);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { bottom: { style: 'medium', color: { argb: 'FFFF6B2B' } } };
    });
    ws.getRow(4).height = 22;

    const statusColors: Record<string, string> = {
      aprobada: 'FFD4EDDA', cerrada: 'FFE9ECEF', rechazada: 'FFF8D7DA',
      en_ejecucion: 'FFCCE5FF', ejecutada: 'FFE2D9F3',
    };

    let excelRow = 5;
    records.forEach(r => {
      const row = ws.getRow(excelRow++);
      const total = (r as any).totalEstimated ?? 0;
      row.values = [
        r.activityCode ?? '—',
        r.title,
        (r as any).user?.name ?? '—',
        r.activityDate ? new Date(r.activityDate).toLocaleDateString('es-CO') : '—',
        (r as any).municipality?.name ?? '—',
        (r as any).strategy?.name ?? '—',
        r.estimatedParticipants ?? 0,
        total ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total) : '—',
        this.STATUS_LABELS_ACT[r.status] ?? r.status,
        r.paymentType ?? '—',
      ];
      const bg = statusColors[r.status] ?? 'FFF9F9F9';
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.font = { size: 10 };
        c.alignment = { vertical: 'middle', wrapText: true };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
      row.height = 18;
    });

    [14, 45, 28, 14, 20, 24, 14, 18, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ══════════════════════════════════════════════════════════
  // USUARIOS → helpers internos
  // ══════════════════════════════════════════════════════════

  private readonly ROLE_LABELS: Record<string, string> = {
    admin:                 'Administrador',
    vicerrector_extension: 'Vicerrector Extensión',
    vicerrector_academico: 'Vicerrector Académico',
    equipo_extension:      'Equipo Extensión',
    decano:                'Decano',
    coordinador:           'Coordinador',
    enlace:                'Enlace de Nodo',
    docente:               'Docente',
    monitor:               'Monitor',
    auxiliar:              'Auxiliar',
  };

  private async fetchUsers(
    filters: { role?: string; nodoId?: string; facultyId?: string },
  ): Promise<User[]> {
    const where: FindOptionsWhere<User> = {};
    if (filters.role)      (where as any).role      = filters.role;
    if (filters.nodoId)    (where as any).nodoId    = filters.nodoId;
    if (filters.facultyId) (where as any).facultyId = filters.facultyId;

    return this.userRepo.find({
      where,
      order: { role: 'ASC', name: 'ASC' },
    });
  }

  // ══════════════════════════════════════════════════════════
  // USUARIOS → PDF
  // ══════════════════════════════════════════════════════════
  async generateUsersPdf(
    filters: { role?: string; nodoId?: string; facultyId?: string },
  ): Promise<Buffer> {
    const users = await this.fetchUsers(filters);

    const tableBody: unknown[][] = [[
      { text: 'Nombre',    style: 'th' },
      { text: 'Email',     style: 'th' },
      { text: 'Documento', style: 'th' },
      { text: 'Rol',       style: 'th' },
      { text: 'Facultad',  style: 'th' },
      { text: 'Programa',  style: 'th' },
      { text: 'Nodo',      style: 'th' },
      { text: 'Activo',    style: 'th' },
    ]];

    users.forEach(u => {
      tableBody.push([
        { text: u.name, style: 'td' },
        { text: u.email, style: 'tdMuted' },
        { text: u.documentNumber ? `${u.documentType ?? ''} ${u.documentNumber}` : '—', style: 'tdMono' },
        { text: this.ROLE_LABELS[u.role] ?? u.role, style: 'td', color: u.role === 'admin' ? '#F87171' : '#DDDDDD' },
        { text: u.faculty ?? '—', style: 'tdMuted' },
        { text: u.program ?? '—', style: 'tdMuted' },
        { text: u.nodoName ?? '—', style: 'tdMuted' },
        { text: u.isActive ? 'Sí' : 'No', style: 'td', color: u.isActive ? '#4ADE80' : '#F87171', alignment: 'center' },
      ]);
    });

    if (users.length === 0) {
      tableBody.push([{ text: 'Sin registros para los filtros seleccionados.', colSpan: 8, style: 'tdMuted', alignment: 'center' }, ...Array(7).fill('')]);
    }

    const subtitle = [
      filters.role      ? `Rol: ${this.ROLE_LABELS[filters.role] ?? filters.role}` : null,
      filters.nodoId    ? `Nodo ID: ${filters.nodoId.slice(0, 8)}` : null,
      filters.facultyId ? `Facultad ID: ${filters.facultyId.slice(0, 8)}` : null,
    ].filter(Boolean).join('  ·  ') || 'Todos los usuarios';

    const docDef = {
      pageSize: 'LETTER',
      pageMargins: [28, this.topMarginPt(612), 28, this.bottomMarginPt(612)],
      header: this.makePdfHeader() ?? {
        columns: [
          { text: 'NodoSys · IU Digital · Reporte de Usuarios', fontSize: 7, color: '#555555', margin: [28, 14, 0, 0] },
          { text: `Generado: ${new Date().toLocaleString('es-CO')}`, fontSize: 7, color: '#555555', alignment: 'right', margin: [0, 14, 28, 0] },
        ],
      },
      footer: this.makePdfFooter() ?? ((page: number, pages: number) => ({
        text: `Página ${page} de ${pages}  ·  Reporte de Usuarios · IU Digital`,
        fontSize: 7, color: '#555555', alignment: 'center', margin: [0, 8, 0, 0],
      })),
      content: [
        { text: 'REPORTE DE USUARIOS', style: 'title' },
        { text: subtitle, style: 'subtitle' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 2, lineColor: '#FF6B2B' }], margin: [0, 0, 0, 12] },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', 62, 82, 70, 70, 60, 28],
            body: tableBody,
          },
          layout: {
            fillColor: (row: number) => row === 0 ? '#222222' : row % 2 === 0 ? '#F9F9F9' : '#FFFFFF',
            hLineColor: () => '#CCCCCC', vLineColor: () => '#CCCCCC',
            hLineWidth: () => 0.4, vLineWidth: () => 0.4,
            paddingTop: () => 3, paddingBottom: () => 3,
          },
        },
        { text: `\nTotal: ${users.length} usuarios`, fontSize: 9, color: '#888888', margin: [0, 8, 0, 0] },
      ],
      styles: {
        title:   { fontSize: 16, bold: true, color: '#FFFFFF', margin: [0, 0, 0, 4] },
        subtitle:{ fontSize: 9,  color: '#888888', margin: [0, 0, 0, 10] },
        th:      { fontSize: 8, bold: true, color: '#FFFFFF', margin: [2, 3] },
        td:      { fontSize: 8, color: '#222222', margin: [2, 2] },
        tdMuted: { fontSize: 7, color: '#555555', margin: [2, 2] },
        tdMono:  { fontSize: 7, color: '#333333', margin: [2, 2] },
      },
      defaultStyle: { font: 'Roboto', color: '#222222' },
    };

    return buildPdf(docDef);
  }

  // ══════════════════════════════════════════════════════════
  // USUARIOS → EXCEL
  // ══════════════════════════════════════════════════════════
  async generateUsersExcel(
    filters: { role?: string; nodoId?: string; facultyId?: string },
  ): Promise<Buffer> {
    const users = await this.fetchUsers(filters);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NodoSys · IU Digital';
    wb.created = new Date();

    const ws = wb.addWorksheet('Usuarios');

    ws.mergeCells('A1:H1');
    const tc = ws.getCell('A1');
    tc.value = 'REPORTE DE USUARIOS  ·  IU DIGITAL';
    tc.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:H2');
    const subtitle = [
      filters.role ? `Rol: ${this.ROLE_LABELS[filters.role] ?? filters.role}` : null,
    ].filter(Boolean).join('  ·  ') || 'Todos los usuarios';
    const sc = ws.getCell('A2');
    sc.value = `${subtitle}  ·  Generado: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'full' })}`;
    sc.font = { italic: true, size: 9, color: { argb: 'FF888888' } };
    sc.alignment = { horizontal: 'center' };

    const headers = ['Nombre', 'Email', 'Documento', 'Rol', 'Facultad', 'Programa', 'Nodo', 'Activo'];
    const hr = ws.getRow(4);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { bottom: { style: 'medium', color: { argb: 'FFFF6B2B' } } };
    });
    ws.getRow(4).height = 22;

    const roleColors: Record<string, string> = {
      admin: 'FFFCE8E8', vicerrector_extension: 'FFF3E8FC', vicerrector_academico: 'FFEEE8FC',
      decano: 'FFE8F0FC', enlace: 'FFFFF3E8', docente: 'FFE8FCF0',
    };

    let excelRow = 5;
    users.forEach(u => {
      const row = ws.getRow(excelRow++);
      row.values = [
        u.name, u.email,
        u.documentNumber ? `${u.documentType ?? ''} ${u.documentNumber}` : '—',
        this.ROLE_LABELS[u.role] ?? u.role,
        u.faculty ?? '—', u.program ?? '—', u.nodoName ?? '—',
        u.isActive ? 'Sí' : 'No',
      ];
      const bg = roleColors[u.role] ?? 'FFF9F9F9';
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.font = { size: 10 };
        c.alignment = { vertical: 'middle', wrapText: true };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
      // Colorear Activo
      const activeCell = row.getCell(8);
      activeCell.font = { size: 10, bold: true, color: { argb: u.isActive ? 'FF1A7C3E' : 'FF9C1717' } };
      row.height = 18;
    });

    [32, 36, 20, 22, 26, 26, 24, 10].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ══════════════════════════════════════════════════════════
  // MONITORÍAS → helpers
  // ══════════════════════════════════════════════════════════

  /**
   * Carga el plan de monitoría validando permisos con MonitorsService
   * (rol permitido + aislamiento por nodo). Un enlace de otro nodo recibe 403
   * antes de que se genere un solo byte del documento.
   */
  private async loadMonitorPlan(planId: string, user: User) {
    const plan = await this.monitorsService.getPlanForRead(planId, user);
    const [activities, weeks] = await Promise.all([
      this.monitorActivityRepo.find({
        where: { workPlanId: plan.id },
        order: { weekNumber: 'ASC', createdAt: 'ASC' },
      }),
      this.monitorWeekRepo.find({ where: { workPlanId: plan.id } }),
    ]);
    const monitor = plan.monitor
      ?? await this.userRepo.findOne({ where: { id: plan.monitorId } });

    // Etiqueta de cada semana a partir de sus fechas: 'Semana 5 · 19/05–22/05'
    const weekLabel = new Map<number, string>();
    for (const w of weeks) {
      weekLabel.set(w.weekNumber, this.fmtWeekLabel(w.weekNumber, w.startDate, w.endDate));
    }

    return { plan, activities, weekLabel, monitor };
  }

  /** 'Semana N · dd/mm–dd/mm' si hay fechas; si no, 'Semana N'. */
  private fmtWeekLabel(weekNumber: number, startDate: string | null, endDate: string | null): string {
    const dm = (d: string | null): string | null => {
      if (!d) return null;
      const [, m, day] = d.split('-');
      return m && day ? `${day}/${m}` : null;
    };
    const a = dm(startDate);
    const b = dm(endDate);
    if (a && b) return `Semana ${weekNumber} · ${a}–${b}`;
    if (a)      return `Semana ${weekNumber} · ${a}`;
    return `Semana ${weekNumber}`;
  }

  /** Quién firma el certificado: el enlace que lo genera; si es admin, el enlace del nodo. */
  private async resolveSigner(user: User, nodoId: string | null): Promise<User | null> {
    if (user.role === UserRole.ENLACE) return user;
    return this.monitorsService.findNodoEnlace(nodoId);
  }

  private fmtHours(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  // ══════════════════════════════════════════════════════════
  // MONITORÍAS → PLAN DE TRABAJO EN EXCEL
  // ══════════════════════════════════════════════════════════
  async generateMonitorPlanExcel(planId: string, user: User): Promise<Buffer> {
    const { plan, activities, weekLabel, monitor } = await this.loadMonitorPlan(planId, user);
    const signer = await this.resolveSigner(user, plan.nodoId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NodoSys · IU Digital';
    const ws = wb.addWorksheet('Plan de Trabajo');

    // ── Título ──
    ws.mergeCells('A1:C1');
    const title = ws.getCell('A1');
    title.value = 'PLAN DE TRABAJO · PROGRAMA MONITORÍAS';
    title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    // ── Encabezado institucional ──
    const info: [string, string][] = [
      ['ÁREA / NODO', monitor?.nodoName ?? '—'],
      ['ENLACE',      signer?.name ?? '—'],
      ['MONITOR(A)',  monitor?.name ?? '—'],
      ['PROGRAMA',    monitor?.program ?? '—'],
      ['VIGENCIA',    plan.vigencia],
    ];

    let row = 3;
    info.forEach(([label, value]) => {
      const r = ws.getRow(row++);
      r.getCell(1).value = label;
      r.getCell(1).font  = { bold: true, size: 10 };
      r.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8E4F0' } };
      ws.mergeCells(`B${r.number}:C${r.number}`);
      r.getCell(2).value = value;
      r.getCell(2).font  = { size: 10 };
      r.height = 18;
    });
    row++;

    // ── Cabecera de la tabla ──
    const headerRow = ws.getRow(row++);
    ['SEMANA', 'DESCRIPCIÓN DE LA ACTIVIDAD', 'HORAS'].forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { bottom: { style: 'thin' } };
    });
    headerRow.height = 22;

    // ── Actividades ──
    activities.forEach((act, i) => {
      const r = ws.getRow(row++);
      r.getCell(1).value = weekLabel.get(act.weekNumber) ?? act.weekLabel ?? `Semana ${act.weekNumber}`;
      r.getCell(2).value = act.description;
      r.getCell(3).value = Number(act.hours);
      r.font = { size: 10 };
      r.eachCell((c) => {
        c.alignment = { wrapText: true, vertical: 'top' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF9F9F9' : 'FFFFFFFF' } };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'top' };
      r.getCell(3).numFmt = '0.0';
    });

    if (activities.length === 0) {
      const r = ws.getRow(row++);
      ws.mergeCells(`A${r.number}:C${r.number}`);
      r.getCell(1).value = 'Sin actividades registradas.';
      r.getCell(1).font = { size: 10, italic: true, color: { argb: 'FF888888' } };
      r.getCell(1).alignment = { horizontal: 'center' };
    }

    // ── Total ──
    const totalHours = activities.reduce((s, a) => s + Number(a.hours), 0);
    const totalRow = ws.getRow(row);
    ws.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    totalRow.getCell(1).value = 'TOTAL DE HORAS';
    totalRow.getCell(3).value = Math.round(totalHours * 10) / 10;
    totalRow.getCell(3).numFmt = '0.0';
    [1, 3].forEach((i) => {
      const c = totalRow.getCell(i);
      c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
      c.alignment = { horizontal: i === 1 ? 'right' : 'center', vertical: 'middle' };
    });
    totalRow.height = 24;

    ws.getColumn(1).width = 26;
    ws.getColumn(2).width = 70;
    ws.getColumn(3).width = 12;

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ══════════════════════════════════════════════════════════
  // MONITORÍAS → CERTIFICADO DE HORAS (PDF)
  // ══════════════════════════════════════════════════════════

  /**
   * Constancias del formato oficial. Se dejan aquí para que el enlace pueda
   * ajustar la redacción en un solo sitio si Vicerrectoría cambia el formato.
   */
  private readonly CERT_CONSTANCIAS: string[] = [
    'Que el/la monitor(a) tiene registradas en el sistema NodoSys las actividades ' +
    'que conforman su plan de trabajo para las semanas relacionadas, bajo el ' +
    'acompañamiento del enlace del nodo.',

    // Ojo: el total sale de sumar las horas registradas en el plan. El sistema
    // NO guarda un estado de ejecución ni exige evidencia por actividad, así
    // que esta constancia no puede afirmar ejecución verificada: quien valida
    // es el enlace al firmar. Si algún día se añade ese estado, aquí es donde
    // se cambia la redacción.
    'Que el total de horas corresponde a la suma de las horas registradas en el ' +
    'plan de trabajo para el rango de semanas indicado, y que su validación ' +
    'corresponde al enlace de nodo que suscribe esta certificación.',

    'Que la presente certificación se expide para efectos del trámite de pago del ' +
    'programa de monitorías de la IU Digital de Antioquia.',
  ];

  async generateMonitorCertificatePdf(
    planId: string,
    opts: { from: number; to: number; observaciones?: string },
    user: User,
  ): Promise<Buffer> {
    const { plan, activities, monitor } = await this.loadMonitorPlan(planId, user);

    // El certificado es el documento de pago y va firmado por el enlace. Leer
    // el plan propio no basta: la monitora NO puede autoexpedirse un
    // certificado con la firma de su enlace. Solo firma quien certifica.
    if (user.role !== UserRole.ENLACE && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo el enlace del nodo puede emitir el certificado de horas',
      );
    }

    if (opts.from > opts.to) {
      throw new BadRequestException('El rango de semanas es inválido');
    }

    const inRange = activities.filter(
      (a) => a.weekNumber >= opts.from && a.weekNumber <= opts.to,
    );
    const totalHours = Math.round(
      inRange.reduce((s, a) => s + Number(a.hours), 0) * 10,
    ) / 10;

    const signer = await this.resolveSigner(user, plan.nodoId);

    // Firma remota: si falla la descarga el certificado sale con la línea
    // en blanco para firmar a mano, nunca con una excepción.
    const signatureImage = await fetchImageAsDataUri(signer?.signatureUrl);

    const hoy = new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const nodoLabel   = monitor?.nodoName ?? '—';
    const monitorDoc  = monitor?.documentNumber
      ? `${monitor.documentType ?? 'CC'} ${monitor.documentNumber}`
      : '—';

    const content: unknown[] = [
      {
        text: 'CERTIFICACIÓN DE HORAS DEL PLAN DE TRABAJO',
        fontSize: 15, bold: true, alignment: 'center',
        color: '#1A1A1A', margin: [0, 0, 0, 4],
      },
      {
        text: 'Programa monitorías IU Digital de Antioquia',
        fontSize: 11, alignment: 'center', color: '#FF6B2B',
        margin: [0, 0, 0, 12],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#FF6B2B' }],
        margin: [0, 0, 0, 14],
      },

      // ── Datos generales ──
      {
        table: {
          widths: [110, '*', 70, '*'],
          body: [
            [
              { text: 'VIGENCIA', style: 'lbl' }, { text: plan.vigencia, style: 'val' },
              { text: 'FECHA', style: 'lbl' },    { text: hoy, style: 'val' },
            ],
            [
              { text: 'NODO', style: 'lbl' },     { text: nodoLabel, style: 'val' },
              { text: 'ENLACE', style: 'lbl' },   { text: signer?.name ?? '—', style: 'val' },
            ],
          ],
        },
        layout: {
          fillColor: (r: number) => (r % 2 === 0 ? '#F5F5F5' : '#FFFFFF'),
          hLineColor: () => '#DDDDDD', vLineColor: () => '#DDDDDD',
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        },
        margin: [0, 0, 0, 14],
      },

      // ── Información del monitor ──
      { text: 'INFORMACIÓN DEL MONITOR', style: 'section' },
      {
        table: {
          widths: [110, '*', 70, '*'],
          body: [
            [
              { text: 'NOMBRE', style: 'lbl' },   { text: monitor?.name ?? '—', style: 'val' },
              { text: 'DOCUMENTO', style: 'lbl' },{ text: monitorDoc, style: 'val' },
            ],
            [
              { text: 'PROGRAMA', style: 'lbl' },
              { text: monitor?.program ?? '—', style: 'val', colSpan: 3 }, '', '',
            ],
          ],
        },
        layout: {
          fillColor: (r: number) => (r % 2 === 0 ? '#F5F5F5' : '#FFFFFF'),
          hLineColor: () => '#DDDDDD', vLineColor: () => '#DDDDDD',
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        },
        margin: [0, 0, 0, 14],
      },

      // ── Texto de certificación ──
      {
        text: [
          'El suscrito ', { text: signer?.name ?? '__________________', bold: true },
          ', en calidad de ', { text: signer?.position ?? 'Enlace de Nodo', bold: true },
          ' del nodo ', { text: nodoLabel, bold: true },
          ' de la Institución Universitaria Digital de Antioquia, certifica que ',
          { text: monitor?.name ?? '__________________', bold: true },
          ', identificado(a) con ', { text: monitorDoc, bold: true },
          ', tiene registrado el plan de trabajo concertado dentro del programa de ',
          'monitorías, con las horas que a continuación se relacionan para el periodo ',
          'certificado.',
        ],
        fontSize: 10, alignment: 'justify', lineHeight: 1.35,
        color: '#1A1A1A', margin: [0, 0, 0, 14],
      },

      // ── Semanas y horas certificadas ──
      {
        table: {
          widths: ['*', 150],
          body: [
            [
              { text: 'SEMANAS DE EJECUCIÓN', style: 'certLbl' },
              { text: 'HORAS REGISTRADAS',   style: 'certLbl', alignment: 'center' },
            ],
            [
              {
                text: `De la semana ${opts.from} a la semana ${opts.to}`,
                fontSize: 11, color: '#1A1A1A', margin: [6, 8],
              },
              {
                text: `${this.fmtHours(totalHours)} horas`,
                fontSize: 16, bold: true, color: '#FF6B2B',
                alignment: 'center', margin: [6, 6],
              },
            ],
          ],
        },
        layout: {
          fillColor: (r: number) => (r === 0 ? '#1A1A1A' : '#FFFFFF'),
          hLineColor: () => '#FF6B2B', vLineColor: () => '#FF6B2B',
          hLineWidth: () => 0.8, vLineWidth: () => 0.8,
        },
        margin: [0, 0, 0, 16],
      },

      // ── Constancias ──
      { text: 'SE HACE CONSTAR', style: 'section' },
      {
        ol: this.CERT_CONSTANCIAS.map((t) => ({
          text: t, fontSize: 9.5, alignment: 'justify',
          lineHeight: 1.3, margin: [0, 0, 0, 6],
        })),
        margin: [0, 0, 0, 14],
      },

      // ── Observaciones ──
      { text: 'OBSERVACIONES', style: 'section' },
      {
        table: {
          widths: ['*'],
          body: [[{
            text: opts.observaciones?.trim() || 'Sin observaciones.',
            fontSize: 9.5, color: opts.observaciones?.trim() ? '#1A1A1A' : '#888888',
            alignment: 'justify', lineHeight: 1.3, margin: [6, 8],
          }]],
        },
        layout: {
          fillColor: () => '#FAFAFA',
          hLineColor: () => '#DDDDDD', vLineColor: () => '#DDDDDD',
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        },
        margin: [0, 0, 0, 30],
      },

      // ── Firma ──
      {
        columns: [
          {
            width: 250,
            stack: [
              signatureImage
                ? { image: signatureImage, fit: [180, 60], margin: [0, 0, 0, 2] }
                : { text: ' ', margin: [0, 0, 0, 46] },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#1A1A1A' }] },
              { text: signer?.name ?? '—', fontSize: 10, bold: true, margin: [0, 4, 0, 0], color: '#1A1A1A' },
              { text: signer?.position ?? 'Enlace de Nodo', fontSize: 9, color: '#555555' },
              { text: `Nodo ${nodoLabel}`, fontSize: 9, color: '#555555' },
            ],
          },
          { width: 20, text: '' },
          {
            width: '*',
            stack: [
              { text: ' ', margin: [0, 0, 0, 46] },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#1A1A1A' }] },
              { text: monitor?.name ?? '—', fontSize: 10, bold: true, margin: [0, 4, 0, 0], color: '#1A1A1A' },
              { text: 'Monitor(a)', fontSize: 9, color: '#555555' },
              { text: monitorDoc, fontSize: 9, color: '#555555' },
            ],
          },
        ],
      },
    ];

    // LETTER vertical: 8.5in × 11in = 612pt × 792pt
    return buildPdf({
      pageSize: 'LETTER',
      pageOrientation: 'portrait',
      pageMargins: [48, this.topMarginPt(612), 48, this.bottomMarginPt(612)],
      header: this.makePdfHeader() ?? {
        text: 'IU Digital de Antioquia · Programa Monitorías',
        fontSize: 8, color: '#555555', margin: [48, 16, 0, 0],
      },
      footer: this.makePdfFooter() ?? ((page: number, pages: number) => ({
        text: `Página ${page} de ${pages}  ·  Certificación de horas · NodoSys · IU Digital`,
        fontSize: 7, color: '#555555', alignment: 'center', margin: [0, 8, 0, 0],
      })),
      content,
      styles: {
        section: { fontSize: 10, bold: true, color: '#FF6B2B', margin: [0, 0, 0, 6] },
        lbl:     { fontSize: 8, bold: true, color: '#555555', margin: [5, 5] },
        val:     { fontSize: 9.5, color: '#1A1A1A', margin: [5, 5] },
        certLbl: { fontSize: 9, bold: true, color: '#FFFFFF', margin: [6, 5] },
      },
      defaultStyle: { font: 'Roboto', color: '#222222' },
    });
  }
}
