import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Loader2, BookOpen,
  Zap, Calendar, User, Tag, Download,
} from 'lucide-react';
import { processesService, type ProcessReport } from '@/services/processes.service';
import { activitiesService } from '@/services/activities.service';
import { useAuth } from '@/hooks/useAuth';
import SessionsTab from '@/pages/actividades/SessionsTab';
import type { ProcessType, ProcessStatus, SessionTemplate } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadInstitutionalAssets, getInstitutionalMargins, applyInstitutionalLayout } from '@/utils/pdfLayout';

const TYPE_LABELS: Record<ProcessType, string> = {
  curso:   'Curso',
  club:    'Club',
  taller:  'Taller',
  proceso: 'Proceso',
};

const TYPE_COLORS: Record<ProcessType, string> = {
  curso:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  club:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  taller:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  proceso: 'bg-[#FF6B2B]/10 text-[#FF6B2B] border-[#FF6B2B]/20',
};

const STATUS_COLORS: Record<ProcessStatus, string> = {
  activo:     'bg-green-500/10 text-green-400 border-green-500/20',
  finalizado: 'bg-[#333] text-[#666] border-[#2A2A2A]',
};

const STATUS_LABELS: Record<ProcessStatus, string> = {
  activo:     'Activo',
  finalizado: 'Finalizado',
};

type ActiveTab = 'sesiones' | 'actividades';

// ── Helpers PDF ───────────────────────────────────────────
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

async function exportConsolidatedPDF(report: ProcessReport): Promise<void> {
  const assets  = await loadInstitutionalAssets();
  const margins = getInstitutionalMargins(assets);
  const { process: p, sessions, consolidatedAttendance, totalSessions, dateRange } = report;
  const doc    = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W      = 210;
  const margin = margins.left;
  const pbY    = 297 - margins.bottom - 5; // page-break threshold
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
  const STATUS_LABELS: Record<string, string> = { activo: 'Activo', finalizado: 'Finalizado' };

  autoTable(doc, {
    startY: y,
    body: [
      ['Tipo', TYPE_LABELS[p.type] ?? p.type, 'Estado', STATUS_LABELS[p.status] ?? p.status],
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

  // ── Sesiones ────────────────────────────────────────────
  for (const session of sessions) {
    y = ensureSpace(doc, y, 50, margins.top, pbY);

    // Franja de encabezado de sesión
    doc.setFillColor(255, 107, 43);
    doc.roundedRect(margin, y, W - margin * 2, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const sessionTitle = `SESIÓN ${session.sessionNumber}${session.date ? '  ·  ' + fmtDate(session.date) : ''}${session.topic ? '  —  ' + session.topic : ''}`;
    doc.text(doc.splitTextToSize(sessionTitle, W - margin * 2 - 4)[0], margin + 2, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Metadatos de la sesión
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

    // Contenido según plantilla
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

    // Experiencia
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

    // Asistentes
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

    // Evidencias
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

    y += 4; // espacio entre sesiones
  }

  // ── Asistencia consolidada ───────────────────────────────
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

// ── Pestaña de actividades vinculadas al proceso ──────────
function ActivitiesTab({ processId }: { processId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ['activities', { processId }],
    queryFn:  () => activitiesService.getAll({ processId } as Record<string, string>),
    enabled:  !!user,
  });

  const activities = q.data ?? [];

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-[#111] border border-[#2A2A2A] rounded-xl">
        <Zap size={36} className="text-[#333] mb-3" />
        <p className="text-[#555] text-sm">Este proceso no tiene solicitudes de recursos</p>
        <p className="text-xs text-[#444] mt-1 max-w-xs">
          Para solicitar viáticos o recursos, abre una sesión y usa el botón "Solicitar recursos".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white font-semibold text-sm">Actividades / Recursos</h2>
        <p className="text-xs text-[#555] mt-0.5">
          {activities.length} actividad{activities.length !== 1 ? 'es' : ''} vinculada{activities.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-2">
        {activities.map((act: {
          id: string; title: string; status: string;
          activityDate: string; activityCode?: string;
          sessionId?: string | null;
        }) => (
          <div
            key={act.id}
            onClick={() => navigate(`/actividades/${act.id}`)}
            className="bg-[#111] border border-[#2A2A2A] rounded-xl px-5 py-4 hover:border-[#FF6B2B]/40 cursor-pointer transition-all group flex items-center gap-4"
          >
            <div className="w-8 h-8 rounded-lg bg-[#FF6B2B]/10 border border-[#FF6B2B]/20 flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-[#FF6B2B]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium group-hover:text-[#FF6B2B] transition-colors truncate">
                {act.title}
              </p>
              <p className="text-xs text-[#555] mt-0.5">
                {act.activityCode ?? 'Borrador'} · {new Date(act.activityDate).toLocaleDateString('es-CO')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {act.sessionId && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-[#1A1A1A] text-[#888] border-[#333]">
                  sesión
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full border bg-[#1A1A1A] text-[#666] border-[#2A2A2A] capitalize">
                {act.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function ProcesoDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { canCreateProceso } = useAuth();
  const [activeTab, setActiveTab]       = useState<ActiveTab>('sesiones');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  async function handleGeneratePDF() {
    setGeneratingPDF(true);
    try {
      const report = await processesService.getReport(id!);
      await exportConsolidatedPDF(report);
    } catch (err) {
      console.error('Error generando bitácora consolidada:', err);
    } finally {
      setGeneratingPDF(false);
    }
  }

  const q = useQuery({
    queryKey: ['process', id],
    queryFn:  () => processesService.getById(id!),
    enabled:  !!id,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  if (!q.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[#555]">Proceso no encontrado</p>
        <button onClick={() => navigate('/procesos')} className="mt-3 text-[#FF6B2B] text-sm hover:underline">
          Volver al listado
        </button>
      </div>
    );
  }

  const p = q.data;

  const tabs: { key: ActiveTab; label: string; icon: typeof BookOpen }[] = [
    { key: 'sesiones',    label: 'Bitácora de sesiones', icon: BookOpen },
    { key: 'actividades', label: 'Actividades / Recursos', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/procesos')}
            className="mt-0.5 p-2 text-[#555] hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-bold text-lg leading-tight">{p.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[p.type]}`}>
                {TYPE_LABELS[p.type]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[p.status]}`}>
                {STATUS_LABELS[p.status]}
              </span>
              {p.sessionTemplate && p.sessionTemplate !== 'tres_momentos' && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                  {p.sessionTemplate === 'investigacion' ? 'Investigación' : 'Desc. libre'}
                </span>
              )}
            </div>
            {p.description && (
              <p className="text-[#666] text-sm mt-1">{p.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {p.creator && (
                <span className="flex items-center gap-1.5 text-xs text-[#555]">
                  <User size={11} /> {p.creator.name}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs text-[#555]">
                <Calendar size={11} />
                {new Date(p.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {p.strategy && (
                <span className="flex items-center gap-1.5 text-xs text-[#555]">
                  <Tag size={11} /> {p.strategy.name}
                </span>
              )}
              {p.missionAxis && (
                <span className="flex items-center gap-1.5 text-xs text-[#555]">
                  <Tag size={11} /> {p.missionAxis.name}
                </span>
              )}
              {p.workPlanTaskId && (
                <span className="flex items-center gap-1.5 text-xs text-[#555]">
                  <Tag size={11} /> Vinculado a plan de trabajo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleGeneratePDF}
            disabled={generatingPDF}
            className="flex items-center gap-2 text-xs border border-[#2A2A2A] text-[#666] hover:text-white hover:border-[#444] px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {generatingPDF
              ? <Loader2 size={13} className="animate-spin" />
              : <Download size={13} />}
            Bitácora PDF
          </button>
          {canCreateProceso && (
            <button
              onClick={() => navigate(`/procesos/${id}/editar`)}
              className="flex items-center gap-2 text-xs border border-[#2A2A2A] text-[#666] hover:text-white hover:border-[#444] px-3 py-2 rounded-lg transition-colors"
            >
              <Edit2 size={13} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex items-center gap-1 border-b border-[#1E1E1E] mb-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === key
                  ? 'border-[#FF6B2B] text-[#FF6B2B]'
                  : 'border-transparent text-[#666] hover:text-white'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'sesiones' && (
          <SessionsTab processId={id!} processTitle={p.name} />
        )}
        {activeTab === 'actividades' && (
          <ActivitiesTab processId={id!} />
        )}
      </div>
    </div>
  );
}
