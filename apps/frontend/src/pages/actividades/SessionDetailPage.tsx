import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Edit2, Trash2, Plus,
  Download, Users, CheckCircle, XCircle,
  Calendar, Clock, MapPin, FileText, Link2, Zap,
} from 'lucide-react';
import { sessionsService, type SessionAttendee, type SessionEvidence } from '@/services/sessions.service';
import { processesService } from '@/services/processes.service';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadInstitutionalAssets, getInstitutionalMargins, applyInstitutionalLayout } from '@/utils/pdfLayout';
import type { SessionTemplate } from '@/types';

// ── Helpers ───────────────────────────────────────────────
function fmt(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

const MOMENT_META = {
  explorar:   { label: 'Momento 1 — EXPLORAR',   color: 'text-blue-400',   border: 'border-blue-400/20',   bg: 'bg-blue-400/5'   },
  crear:      { label: 'Momento 2 — CREAR',       color: 'text-green-400',  border: 'border-green-400/20',  bg: 'bg-green-400/5'  },
  consolidar: { label: 'Momento 3 — CONSOLIDAR',  color: 'text-purple-400', border: 'border-purple-400/20', bg: 'bg-purple-400/5' },
} as const;

// ── PDF export ────────────────────────────────────────────
type SessionData = Awaited<ReturnType<typeof sessionsService.getById>>;

async function exportPDF(session: SessionData, contextTitle: string, teacherName: string, template: SessionTemplate): Promise<void> {
  const assets  = await loadInstitutionalAssets();
  const margins = getInstitutionalMargins(assets);
  const doc    = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W      = 210;
  const margin = margins.left;
  const pbY    = 297 - margins.bottom - 5;
  let y        = margins.top;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BITÁCORA DE SESIÓN', W / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const titleLines = doc.splitTextToSize(contextTitle, W - margin * 2);
  doc.text(titleLines, W / 2, y, { align: 'center' });
  y += titleLines.length * 5 + 4;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  autoTable(doc, {
    startY: y,
    body: [
      ['Sesión N°', String(session.sessionNumber), 'Fecha', fmt(session.date)],
      ['Hora inicio', session.startTime ?? '—', 'Hora fin', session.endTime ?? '—'],
      ['Lugar', session.location ?? '—', 'Asistentes', String(session.totalRegistered)],
      ['Tema', session.topic ?? '—', '', ''],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 28 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 28 },
      3: { cellWidth: 60 },
    },
    margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (template === 'tres_momentos') {
    const ORDER   = ['explorar', 'crear', 'consolidar'] as const;
    const LABELS: Record<string, string> = {
      explorar:   '1. EXPLORAR — Activación de saberes previos',
      crear:      '2. CREAR — Desarrollo y práctica',
      consolidar: '3. CONSOLIDAR — Cierre y evaluación',
    };

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MOMENTOS PEDAGÓGICOS', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Momento', 'Objetivo', 'Metodología', 'Materiales', 'Duración']],
      body: ORDER.map((mt) => {
        const m = session.moments.find((mo) => mo.momentType === mt);
        return [
          LABELS[mt],
          m?.objective    ?? '',
          m?.methodology  ?? '',
          m?.materials    ?? '',
          m?.durationMinutes ? `${m.durationMinutes} min` : '',
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 43], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 34 },
        2: { cellWidth: 34 },
        3: { cellWidth: 34 },
        4: { cellWidth: 18, halign: 'center' },
      },
      margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (template === 'investigacion') {
    if (y > pbY - 20) { doc.addPage(); y = margins.top; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('INVESTIGACIÓN', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      body: [
        ['Tema técnico', session.temaTecnico ?? '—'],
        ['Herramienta / Simulador', session.herramientaSimulador ?? '—'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 },
        1: {},
      },
      margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    for (const [label, value] of [['DESARROLLO DE LA SESIÓN', session.desarrollo], ['RESULTADOS', session.resultados]] as const) {
      if (value) {
        if (y > pbY) { doc.addPage(); y = margins.top; }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(value, W - margin * 2);
        if (y + lines.length * 4.5 > pbY) { doc.addPage(); y = margins.top; }
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 5;
      }
    }
  }

  if (session.experience) {
    if (y > pbY) { doc.addPage(); y = margins.top; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN / EXPERIENCIA DE LA SESIÓN', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const expLines = doc.splitTextToSize(session.experience, W - margin * 2);
    if (y + expLines.length * 4.5 > pbY) { doc.addPage(); y = margins.top; }
    doc.text(expLines, margin, y);
    y += expLines.length * 4.5 + 6;
  }

  if (session.attendees.length > 0) {
    if (y > pbY - 20) { doc.addPage(); y = margins.top; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE ASISTENTES', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Nombre completo', 'Documento', 'Asistió', 'Firma']],
      body: session.attendees.map((a, i) => [
        String(i + 1),
        a.fullName,
        a.documentNumber ?? '',
        a.attended ? 'Sí' : 'No',
        '',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 68 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 42 },
      },
      margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const evidences = session.evidences ?? [];
  if (evidences.length > 0) {
    if (y > pbY) { doc.addPage(); y = margins.top; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EVIDENCIAS', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'URL / Enlace']],
      body: evidences.map((ev) => [ev.caption ?? '(sin descripción)', ev.fileUrl]),
      theme: 'striped',
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 3, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 125, textColor: [0, 80, 200] },
      },
      margin: { left: margin, right: margin, top: margins.top, bottom: margins.bottom },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (y > pbY) { doc.addPage(); y = margins.top; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.line(margin, y + 10, margin + 60, y + 10);
  doc.line(W - margin - 60, y + 10, W - margin, y + 10);
  doc.text('Docente responsable', margin, y + 14);
  doc.text('Coordinador / Enlace', W - margin - 60, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, margin, y + 19);

  applyInstitutionalLayout(doc, assets);
  doc.save(`Bitacora_S${session.sessionNumber}_${session.date}.pdf`);
}

// ── Modal agregar asistente ───────────────────────────────
function AddAttendeeModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fullName: '', documentNumber: '', attended: true });

  const addM = useMutation({
    mutationFn: () => sessionsService.addAttendee(sessionId, {
      fullName: form.fullName,
      documentNumber: form.documentNumber || undefined,
      attended: form.attended,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">Agregar asistente</h3>

        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Nombre completo *</label>
          <input
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Ana María García"
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
          />
        </div>

        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Documento</label>
          <input
            value={form.documentNumber}
            onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))}
            placeholder="1234567890"
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
          />
        </div>

        <div className="flex items-center gap-3 p-3 bg-[#1A1A1A] rounded-lg">
          <input
            type="checkbox"
            id="attended"
            checked={form.attended}
            onChange={(e) => setForm((f) => ({ ...f, attended: e.target.checked }))}
            className="accent-[#FF6B2B]"
          />
          <label htmlFor="attended" className="text-sm text-white cursor-pointer">Asistió a esta sesión</label>
        </div>

        {addM.error && (
          <p className="text-red-400 text-xs">
            {(addM.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al agregar'}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#2A2A2A] rounded-lg text-sm text-[#666] hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => addM.mutate()}
            disabled={!form.fullName.trim() || addM.isPending}
            className="flex-1 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            {addM.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal agregar evidencia ───────────────────────────────
function AddEvidenceModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fileUrl: '', caption: '' });

  const addM = useMutation({
    mutationFn: () => sessionsService.addEvidence(sessionId, {
      fileUrl: form.fileUrl,
      caption: form.caption || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">Agregar evidencia</h3>

        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">URL del archivo *</label>
          <input
            type="url"
            value={form.fileUrl}
            onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
            placeholder="https://drive.google.com/..."
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
          />
          <p className="text-xs text-[#444] mt-1">Sube la foto/archivo a Google Drive y pega el enlace compartible.</p>
        </div>

        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Descripción</label>
          <input
            value={form.caption}
            onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
            placeholder="Ej: Foto del inicio de la sesión"
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
          />
        </div>

        {addM.error && (
          <p className="text-red-400 text-xs">
            {(addM.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al agregar'}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#2A2A2A] rounded-lg text-sm text-[#666] hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => addM.mutate()}
            disabled={!form.fileUrl.trim() || addM.isPending}
            className="flex-1 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            {addM.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function SessionDetailPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, isVicerrector } = useAuth();
  const isDirector = isAdmin || isVicerrector;

  const [showAddAttendee,  setShowAddAttendee]  = useState(false);
  const [showAddEvidence,  setShowAddEvidence]  = useState(false);
  const [generatingPDF,    setGeneratingPDF]    = useState(false);

  const q = useQuery({
    queryKey: ['session', sid],
    queryFn: () => sessionsService.getById(sid!),
    enabled: !!sid,
  });

  const s = q.data;

  // Cargar el proceso padre para obtener la plantilla de sesión
  const processQ = useQuery({
    queryKey: ['process-template', s?.processId],
    queryFn: () => processesService.getById(s!.processId!),
    enabled: !!s?.processId,
  });

  const sessionTemplate: SessionTemplate = processQ.data?.sessionTemplate ?? 'tres_momentos';
  const isTresMomentos  = sessionTemplate === 'tres_momentos';
  const isInvestigacion = sessionTemplate === 'investigacion';

  async function handleExportPDF(sess: NonNullable<typeof q.data>) {
    setGeneratingPDF(true);
    try { await exportPDF(sess, sess.topic ?? `Sesión ${sess.sessionNumber}`, user?.name ?? 'Docente', sessionTemplate); }
    finally { setGeneratingPDF(false); }
  }

  const deleteAttendeeM = useMutation({
    mutationFn: (attendeeId: string) => sessionsService.deleteAttendee(sid!, attendeeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sid] }),
  });

  const toggleAttendedM = useMutation({
    mutationFn: ({ attendeeId, attended }: { attendeeId: string; attended: boolean }) =>
      sessionsService.updateAttendee(sid!, attendeeId, { attended }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sid] }),
  });

  const deleteEvidenceM = useMutation({
    mutationFn: (evidenceId: string) => sessionsService.deleteEvidence(evidenceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sid] }),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  if (!s) return null;

  const canEdit = isDirector || s.createdBy === user?.id;
  const ORDER = ['explorar', 'crear', 'consolidar'] as const;

  // Backlink dinámico: usa processId si existe, si no activityId, si no el param de la URL
  const backPath = s.processId
    ? `/procesos/${s.processId}`
    : s.activityId
      ? `/actividades/${s.activityId}`
      : `/actividades/${id}`;

  const editPath = s.processId
    ? `/procesos/${s.processId}/sesiones/${sid}/editar`
    : `/actividades/${s.activityId ?? id}/sesiones/${sid}/editar`;

  const contextTitle = s.topic ?? `Sesión ${s.sessionNumber}`;

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Navegación */}
      <button
        onClick={() => navigate(backPath)}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> {s.processId ? 'Volver al proceso' : 'Volver a la actividad'}
      </button>

      {/* Encabezado de la sesión */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B2B]/10 border border-[#FF6B2B]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#FF6B2B] font-bold">{s.sessionNumber}</span>
            </div>
            <div>
              <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Sesión {s.sessionNumber}</p>
              <h1 className="text-xl font-bold text-white">{contextTitle}</h1>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {s.processId && (
              <button
                onClick={() => navigate('/actividades/nueva', {
                  state: {
                    sessionId:     sid,
                    sessionNumber: s.sessionNumber,
                    sessionTopic:  s.topic,
                    processId:     s.processId,
                    strategyId:    processQ.data?.strategyId ?? null,
                    strategyName:  processQ.data?.strategy?.name ?? null,
                  },
                })}
                className="flex items-center gap-1.5 text-xs bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                <Zap size={13} /> Solicitar recursos
              </button>
            )}
            <button
              onClick={() => handleExportPDF(s!)}
              disabled={generatingPDF}
              className="flex items-center gap-1.5 text-xs bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] hover:text-white disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
            >
              {generatingPDF ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Bitácora PDF
            </button>
            {canEdit && (
              <button
                onClick={() => navigate(editPath)}
                className="flex items-center gap-1.5 text-xs bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 text-[#FF6B2B] hover:bg-[#FF6B2B]/20 px-3 py-2 rounded-lg transition-colors"
              >
                <Edit2 size={13} /> Editar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#1E1E1E]">
          <div>
            <div className="flex items-center gap-1 text-xs text-[#555] mb-0.5"><Calendar size={11} /> Fecha</div>
            <div className="text-sm text-white">{fmt(s.date)}</div>
          </div>
          {(s.startTime || s.endTime) && (
            <div>
              <div className="flex items-center gap-1 text-xs text-[#555] mb-0.5"><Clock size={11} /> Horario</div>
              <div className="text-sm text-white">{s.startTime ?? '—'} — {s.endTime ?? '—'}</div>
            </div>
          )}
          {s.location && (
            <div>
              <div className="flex items-center gap-1 text-xs text-[#555] mb-0.5"><MapPin size={11} /> Lugar</div>
              <div className="text-sm text-white">{s.location}</div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-1 text-xs text-[#555] mb-0.5"><Users size={11} /> Asistentes</div>
            <div className="text-sm text-white">{s.totalRegistered}</div>
          </div>
        </div>
      </div>

      {/* Momentos pedagógicos (solo para tres_momentos) */}
      {isTresMomentos && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white px-1">Momentos pedagógicos</h2>
          {ORDER.map((mt) => {
            const m = s.moments.find((mo) => mo.momentType === mt);
            const meta = MOMENT_META[mt];
            const isEmpty = !m?.objective && !m?.methodology && !m?.materials;

            return (
              <div key={mt} className={`border ${meta.border} ${meta.bg} rounded-xl p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-semibold text-sm ${meta.color}`}>{meta.label}</h3>
                  {m?.durationMinutes && (
                    <span className="text-xs text-[#555] bg-[#1A1A1A] px-2 py-0.5 rounded-full">
                      {m.durationMinutes} min
                    </span>
                  )}
                </div>

                {isEmpty ? (
                  <p className="text-xs text-[#444] italic">Sin información registrada en este momento.</p>
                ) : (
                  <div className="space-y-3">
                    {m?.objective && (
                      <div>
                        <p className="text-xs text-[#555] uppercase tracking-wider mb-1">Objetivo</p>
                        <p className="text-sm text-[#CCC] whitespace-pre-wrap">{m.objective}</p>
                      </div>
                    )}
                    {m?.methodology && (
                      <div>
                        <p className="text-xs text-[#555] uppercase tracking-wider mb-1">Metodología</p>
                        <p className="text-sm text-[#CCC] whitespace-pre-wrap">{m.methodology}</p>
                      </div>
                    )}
                    {m?.materials && (
                      <div>
                        <p className="text-xs text-[#555] uppercase tracking-wider mb-1">Materiales</p>
                        <p className="text-sm text-[#CCC] whitespace-pre-wrap">{m.materials}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Campos de investigación */}
      {isInvestigacion && (
        <div className="bg-[#111] border border-amber-400/20 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-amber-400">Investigación</h2>

          {(s.temaTecnico || s.herramientaSimulador) && (
            <div className="grid grid-cols-2 gap-4">
              {s.temaTecnico && (
                <div>
                  <p className="text-xs text-[#555] uppercase tracking-wider mb-1">Tema técnico</p>
                  <p className="text-sm text-white">{s.temaTecnico}</p>
                </div>
              )}
              {s.herramientaSimulador && (
                <div>
                  <p className="text-xs text-[#555] uppercase tracking-wider mb-1">Herramienta / Simulador</p>
                  <p className="text-sm text-white">{s.herramientaSimulador}</p>
                </div>
              )}
            </div>
          )}

          {s.desarrollo && (
            <div>
              <p className="text-xs text-[#555] uppercase tracking-wider mb-1">Desarrollo de la sesión</p>
              <p className="text-sm text-[#CCC] whitespace-pre-wrap leading-relaxed">{s.desarrollo}</p>
            </div>
          )}

          {s.resultados && (
            <div>
              <p className="text-xs text-[#555] uppercase tracking-wider mb-1">Resultados</p>
              <p className="text-sm text-[#CCC] whitespace-pre-wrap leading-relaxed">{s.resultados}</p>
            </div>
          )}
        </div>
      )}

      {/* Descripción / Experiencia */}
      {(s.experience || canEdit) && (
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={15} className="text-[#FF6B2B]" />
            <h2 className="text-sm font-semibold text-white">
              {sessionTemplate === 'descripcion_libre' ? 'Descripción de la sesión' : 'Descripción / Experiencia'}
            </h2>
          </div>
          {s.experience ? (
            <p className="text-sm text-[#CCC] whitespace-pre-wrap leading-relaxed">{s.experience}</p>
          ) : (
            <p className="text-xs text-[#444] italic">
              Sin descripción narrativa.{' '}
              {canEdit && (
                <button onClick={() => navigate(editPath)} className="text-[#FF6B2B] hover:underline">
                  Agregar →
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {/* Asistentes */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E1E1E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-[#FF6B2B]" />
            <span className="text-sm font-semibold text-white">Lista de asistentes</span>
            <span className="text-xs text-[#555] bg-[#1A1A1A] px-2 py-0.5 rounded-full">
              {s.attendees.length}
            </span>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddAttendee(true)}
              className="flex items-center gap-1.5 text-xs bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 text-[#FF6B2B] hover:bg-[#FF6B2B]/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} /> Agregar
            </button>
          )}
        </div>

        {s.attendees.length === 0 ? (
          <div className="py-10 text-center text-[#555] text-sm">
            {canEdit ? 'Agrega los participantes de esta sesión.' : 'Sin asistentes registrados.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E]">
                  {['Nombre', 'Documento', 'Asistió', 'Faltas', 'Certificable', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-mono text-[#555] uppercase px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.attendees.map((a: SessionAttendee) => (
                  <tr key={a.id} className="border-b border-[#1A1A1A] hover:bg-[#161616]">
                    <td className="px-4 py-2.5 text-white font-medium">{a.fullName}</td>
                    <td className="px-4 py-2.5 text-[#666] text-xs">{a.documentNumber ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {canEdit ? (
                        <input
                          type="checkbox"
                          checked={a.attended}
                          onChange={(e) => toggleAttendedM.mutate({ attendeeId: a.id, attended: e.target.checked })}
                          className="accent-[#FF6B2B]"
                        />
                      ) : (
                        a.attended
                          ? <CheckCircle size={14} className="text-green-400" />
                          : <XCircle size={14} className="text-red-400" />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-sm font-mono ${a.absencesCount > 4 ? 'text-red-400' : 'text-[#888]'}`}>
                        {a.absencesCount}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {a.certifiable
                        ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Sí</span>
                        : <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">No</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit && (
                        <button
                          onClick={() => deleteAttendeeM.mutate(a.id)}
                          className="text-[#444] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evidencias */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E1E1E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-[#FF6B2B]" />
            <span className="text-sm font-semibold text-white">Evidencias</span>
            <span className="text-xs text-[#555] bg-[#1A1A1A] px-2 py-0.5 rounded-full">
              {(s.evidences ?? []).length}
            </span>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddEvidence(true)}
              className="flex items-center gap-1.5 text-xs bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 text-[#FF6B2B] hover:bg-[#FF6B2B]/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} /> Agregar
            </button>
          )}
        </div>

        {(s.evidences ?? []).length === 0 ? (
          <div className="py-10 text-center text-[#555] text-sm">
            {canEdit ? 'Agrega fotos o archivos (URL de Google Drive).' : 'Sin evidencias registradas.'}
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {(s.evidences ?? []).map((ev: SessionEvidence) => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#161616]">
                <div className="flex-1 min-w-0">
                  {ev.caption && (
                    <p className="text-sm text-white font-medium truncate">{ev.caption}</p>
                  )}
                  <a
                    href={ev.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#FF6B2B] hover:underline truncate block"
                  >
                    {ev.fileUrl}
                  </a>
                </div>
                <a
                  href={ev.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#666] hover:text-white transition-colors flex-shrink-0"
                  title="Abrir enlace"
                >
                  <Link2 size={14} />
                </a>
                {canEdit && (
                  <button
                    onClick={() => deleteEvidenceM.mutate(ev.id)}
                    className="text-[#444] hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddAttendee && (
        <AddAttendeeModal sessionId={sid!} onClose={() => setShowAddAttendee(false)} />
      )}
      {showAddEvidence && (
        <AddEvidenceModal sessionId={sid!} onClose={() => setShowAddEvidence(false)} />
      )}
    </div>
  );
}
