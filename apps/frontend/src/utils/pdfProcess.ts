import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadInstitutionalAssets, getInstitutionalMargins, applyInstitutionalLayout } from '@/utils/pdfLayout';
import type { ProcessReport } from '@/services/processes.service';
import type { SessionTemplate } from '@/types';

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const MOMENT_LABELS: Record<string, string> = {
  explorar:   '1. EXPLORAR',
  crear:      '2. CREAR',
  consolidar: '3. CONSOLIDAR',
};

function ensureSpace(doc: jsPDF, y: number, needed: number, topMargin: number, breakY = 278): number {
  if (y + needed > breakY) {
    doc.addPage();
    return topMargin;
  }
  return y;
}

export async function exportConsolidatedPDF(report: ProcessReport): Promise<void> {
  const assets  = await loadInstitutionalAssets();
  const margins = getInstitutionalMargins(assets);
  const { process: p, sessions, consolidatedAttendance, totalSessions, dateRange } = report;
  const doc    = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W      = 210;
  const margin = margins.left;
  const pbY    = 297 - margins.bottom - 5;
  let y        = margins.top;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('BITÁCORA CONSOLIDADA DEL PROCESO', W / 2, y, { align: 'center' });
  y += 7;

  const titleLines = doc.splitTextToSize(p.name, W - margin * 2);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(titleLines, W / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += titleLines.length * 5 + 5;

  const TYPE_LABELS: Record<string, string> = { curso: 'Curso', club: 'Club', taller: 'Taller', proceso: 'Proceso' };
  const STATUS_LABELS_MAP: Record<string, string> = { activo: 'Activo', finalizado: 'Finalizado' };

  autoTable(doc, {
    startY: y,
    body: [
      ['Tipo', TYPE_LABELS[p.type] ?? p.type, 'Estado', STATUS_LABELS_MAP[p.status] ?? p.status],
      ['Docente', p.creator?.name ?? '—', 'Total sesiones', String(totalSessions)],
      ['Fecha inicio', dateRange.start ? fmtDate(dateRange.start) : '—', 'Fecha cierre', dateRange.end ? fmtDate(dateRange.end) : '—'],
      ...(p.description ? [['Descripción', { content: p.description, colSpan: 3 }]] : []),
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 30 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 30 },
      3: { cellWidth: 60 },
    },
    margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  const sessionTemplate: SessionTemplate = (p as any).sessionTemplate ?? 'tres_momentos';

  for (const session of sessions) {
    y = ensureSpace(doc, y, 50, margins.top, pbY);

    doc.setFillColor(255, 107, 43);
    doc.roundedRect(margin, y, W - margin * 2, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const sessionTitle = `SESIÓN ${session.sessionNumber}${session.date ? '  ·  ' + fmtDate(session.date) : ''}${session.topic ? '  —  ' + session.topic : ''}`;
    doc.text(doc.splitTextToSize(sessionTitle, W - margin * 2 - 4)[0], margin + 2, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const metaCells: string[][] = [];
    if (session.startTime || session.endTime)
      metaCells.push(['Horario', `${session.startTime ?? '—'} — ${session.endTime ?? '—'}`, 'Lugar', session.location ?? '—']);
    if (metaCells.length > 0) {
      autoTable(doc, {
        startY: y,
        body: metaCells,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [250, 250, 250], cellWidth: 22 },
          1: { cellWidth: 64 },
          2: { fontStyle: 'bold', fillColor: [250, 250, 250], cellWidth: 22 },
          3: { cellWidth: 64 },
        },
        margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
      });
      y = (doc as any).lastAutoTable.finalY + 3;
    }

    if (sessionTemplate === 'tres_momentos') {
      const ORDER = ['explorar', 'crear', 'consolidar'] as const;
      autoTable(doc, {
        startY: y,
        head: [['Momento', 'Objetivo', 'Metodología', 'Materiales', 'Min']],
        body: ORDER.map((mt) => {
          const m = (session.moments ?? []).find((mo) => mo.momentType === mt);
          return [
            MOMENT_LABELS[mt] ?? mt,
            m?.objective   ?? '',
            m?.methodology ?? '',
            m?.materials   ?? '',
            m?.durationMinutes ? String(m.durationMinutes) : '',
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2, valign: 'top' },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 40 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 14, halign: 'center' },
        },
        margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    if (sessionTemplate === 'investigacion') {
      const s = session as any;
      autoTable(doc, {
        startY: y,
        body: [
          ['Tema técnico', s.temaTecnico ?? '—'],
          ['Herramienta / Simulador', s.herramientaSimulador ?? '—'],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 },
          1: {},
        },
        margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
      });
      y = (doc as any).lastAutoTable.finalY + 3;
      for (const [label, value] of [['Desarrollo', s.desarrollo], ['Resultados', s.resultados]] as const) {
        if (value) {
          y = ensureSpace(doc, y, 14, margins.top, pbY);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}:`, margin, y);
          y += 4;
          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(value, W - margin * 2);
          y = ensureSpace(doc, y, lines.length * 4, margins.top, pbY);
          doc.text(lines, margin, y);
          y += lines.length * 4 + 3;
        }
      }
    }

    if (session.experience) {
      y = ensureSpace(doc, y, 14, margins.top, pbY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Descripción / Experiencia:', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const expLines = doc.splitTextToSize(session.experience, W - margin * 2);
      y = ensureSpace(doc, y, expLines.length * 4, margins.top, pbY);
      doc.text(expLines, margin, y);
      y += expLines.length * 4 + 4;
    }

    if ((session.attendees ?? []).length > 0) {
      y = ensureSpace(doc, y, 20, margins.top, pbY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Asistentes (${session.attendees.length})`, margin, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [['Nombre', 'Documento', 'Asistió']],
        body: session.attendees.map((a) => [a.fullName, a.documentNumber ?? '', a.attended ? 'Sí' : 'No']),
        theme: 'striped',
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 50 },
          2: { cellWidth: 25, halign: 'center' },
        },
        margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    if ((session.evidences ?? []).length > 0) {
      y = ensureSpace(doc, y, 16, margins.top, pbY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Evidencias (${session.evidences.length})`, margin, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [['Descripción', 'URL']],
        body: session.evidences.map((ev) => [ev.caption ?? '—', ev.fileUrl]),
        theme: 'plain',
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 115, textColor: [0, 80, 200] },
        },
        margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    y += 4;
  }

  if (consolidatedAttendance.length > 0) {
    doc.addPage();
    y = margins.top;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('ASISTENCIA CONSOLIDADA', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${totalSessions} sesiones · ${consolidatedAttendance.length} participantes únicos`, margin, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [['Nombre', 'Documento', 'Sesiones asistidas', 'Total sesiones', 'Faltas', 'Certificable']],
      body: consolidatedAttendance.map((a) => [
        a.fullName,
        a.documentNumber ?? '—',
        String(a.sessionsAttended),
        String(a.totalSessions),
        String(a.absences),
        a.certifiable ? 'Sí' : 'No',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 43], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          const absences = parseInt(String(data.cell.raw), 10);
          if (absences > 4) data.cell.styles.textColor = [220, 50, 50];
        }
        if (data.column.index === 5 && data.section === 'body') {
          data.cell.styles.textColor = data.cell.raw === 'Sí' ? [30, 150, 60] : [200, 50, 50];
        }
      },
    });
  }

  applyInstitutionalLayout(doc, assets);
  const safeName = p.name.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
  doc.save(`Bitacora_Proceso_${safeName}.pdf`);
}
