/**
 * reports.service.ts — Generación de reportes PDF y Excel
 *
 * pdfmake 0.2.x: usa new PdfPrinter(fonts) → createPdfKitDocument(docDef)
 * exceljs:       usa Workbook/Worksheet API con estilos completos
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryUnit } from '../inventory/entities/inventory-unit.entity';
import { WorkPlan } from '../workplan/entities/work-plan.entity';
import { WorkPlanAxis } from '../workplan/entities/work-plan-axis.entity';
import { AxisActivity } from '../workplan/entities/axis-activity.entity';
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

@Injectable()
export class ReportsService {
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
  ) {}

  // ══════════════════════════════════════════════════════════
  // INVENTARIO → PDF
  // ══════════════════════════════════════════════════════════
  async generateInventoryPdf(nodoId?: string): Promise<Buffer> {
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

    // Encabezados de tabla
    const tableBody: unknown[][] = [[
      { text: '#', style: 'th' },
      { text: 'Ítem', style: 'th' },
      { text: 'Marca / Modelo', style: 'th' },
      { text: 'Total', style: 'th' },
      { text: 'Disponible', style: 'th' },
      { text: 'Préstamo', style: 'th' },
      { text: 'Problemas', style: 'th' },
    ]];

    let seq = 1;
    Object.entries(byCategory).forEach(([catName, catItems]) => {
      // Fila separadora de categoría
      tableBody.push([
        { text: `  ${catName}`, colSpan: 7, style: 'catRow', fillColor: '#1E1E1E' },
        '', '', '', '', '', '',
      ]);
      catItems.forEach(item => {
        const units = item.units ?? [];
        const avail   = units.filter(u => u.status === 'disponible').length;
        const loan    = units.filter(u => u.status === 'en_prestamo').length;
        const damaged = units.filter(u => ['malo','dado_de_baja'].includes(u.condition)).length;
        tableBody.push([
          { text: seq++, style: 'td', alignment: 'center' },
          { text: item.name, style: 'td' },
          { text: [item.brand, item.model].filter(Boolean).join(' · ') || '—', style: 'tdMuted' },
          { text: units.length, style: 'td', alignment: 'center', bold: true },
          { text: avail,        style: 'td', alignment: 'center', color: '#4ADE80' },
          { text: loan || '—', style: 'td', alignment: 'center', color: '#38BDF8' },
          { text: damaged || '—', style: 'td', alignment: 'center',
            color: damaged > 0 ? '#F87171' : '#666666', bold: damaged > 0 },
        ]);
      });
    });

    // Totales finales
    const totalUnits   = items.reduce((s, i) => s + (i.units?.length ?? 0), 0);
    const totalAvail   = items.reduce((s, i) => s + (i.units?.filter(u => u.status === 'disponible').length ?? 0), 0);
    const totalDamaged = items.reduce((s, i) => s + (i.units?.filter(u => ['malo','dado_de_baja'].includes(u.condition)).length ?? 0), 0);
    tableBody.push([
      { text: 'TOTAL', colSpan: 3, style: 'totalRow', fillColor: '#FF6B2B', color: '#FFFFFF', bold: true },
      '', '',
      { text: totalUnits,   style: 'totalRow', fillColor: '#FF6B2B', color: '#FFFFFF', bold: true, alignment: 'center' },
      { text: totalAvail,   style: 'totalRow', fillColor: '#FF6B2B', color: '#4ADE80', bold: true, alignment: 'center' },
      { text: totalUnits - totalAvail - totalDamaged, style: 'totalRow', fillColor: '#FF6B2B', color: '#38BDF8', bold: true, alignment: 'center' },
      { text: totalDamaged, style: 'totalRow', fillColor: '#FF6B2B', color: '#F87171', bold: true, alignment: 'center' },
    ]);

    const docDef = {
      pageSize: 'LETTER',
      pageMargins: [40, 55, 40, 45],
      header: {
        columns: [
          { text: 'NODOSYS · IU DIGITAL · NODO ARBOLETES', fontSize: 8, color: '#888888', margin: [40, 15, 0, 0] },
          { text: `Generado: ${new Date().toLocaleDateString('es-CO')}`, fontSize: 8, color: '#888888', alignment: 'right', margin: [0, 15, 40, 0] },
        ],
      },
      footer: (page: number, pages: number) => ({
        text: `Página ${page} de ${pages}  ·  NodoSys Sistema de Gestión`,
        fontSize: 8, color: '#555555', alignment: 'center', margin: [0, 10, 0, 0],
      }),
      content: [
        { text: 'REPORTE DE INVENTARIO', style: 'title' },
        { text: 'Estado actual de todos los equipos y materiales del nodo', style: 'subtitle' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 2, lineColor: '#FF6B2B' }], margin: [0, 0, 0, 14] },
        {
          table: {
            headerRows: 1,
            widths: [22, '*', 100, 36, 48, 48, 52],
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
  async generateInventoryExcel(nodoId?: string): Promise<Buffer> {
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

    // Título
    ws1.mergeCells('A1:I1');
    const titleCell = ws1.getCell('A1');
    titleCell.value = 'INVENTARIO NODO ARBOLETES · IU DIGITAL';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 30;

    ws1.mergeCells('A2:I2');
    const subCell = ws1.getCell('A2');
    subCell.value = `Generado: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'full' })}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF888888' } };
    subCell.alignment = { horizontal: 'center' };

    // Encabezados
    const headers = ['#', 'Categoría', 'Ítem', 'Marca', 'Modelo', 'Total', 'Disponibles', 'En Préstamo', 'Con Problemas'];
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
      row.values = [seq++, item.category?.name ?? '', item.name, item.brand ?? '—', item.model ?? '—', units.length, avail, loan, damaged];
      const bg = excelRow % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF';
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.font = { size: 10 };
        c.alignment = { vertical: 'middle' };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
      });
      if (damaged > 0) row.getCell(9).font = { bold: true, color: { argb: 'FFCC0000' }, size: 10 };
    });
    [4, 15, 32, 14, 16, 10, 13, 13, 14].forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

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

    return buildPdf({
      pageSize: 'LEGAL',
      pageOrientation: 'landscape',
      pageMargins: [28, 45, 28, 38],
      header: {
        columns: [
          { text: 'NodoSys · IU Digital', fontSize: 7, color: '#555555', margin: [28, 14, 0, 0] },
          { text: `Generado: ${new Date().toLocaleString('es-CO')}`, fontSize: 7, color: '#555555', alignment: 'right', margin: [0, 14, 28, 0] },
        ],
      },
      footer: (page: number, pages: number) => ({
        text: `Página ${page} de ${pages}  ·  Plan de Trabajo Profesoral DO-F-002 · IU Digital`,
        fontSize: 7, color: '#555555', alignment: 'center', margin: [0, 8, 0, 0],
      }),
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
}
