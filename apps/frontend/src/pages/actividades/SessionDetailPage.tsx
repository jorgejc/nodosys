import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Edit2, Trash2, Plus,
  Download, Users, CheckCircle, XCircle,
  Calendar, Clock, MapPin,
} from 'lucide-react';
import { sessionsService, type SessionAttendee } from '@/services/sessions.service';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
function exportPDF(session: ReturnType<typeof sessionsService.getById> extends Promise<infer T> ? T : never, activityTitle: string, teacherName: string) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 15;
  let y = margin;

  // Encabezado institucional
  doc.setFillColor(255, 107, 43);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('IU DIGITAL — INSTITUCIÓN UNIVERSITARIA DIGITAL DE ANTIOQUIA', margin, 7);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Vicerrectoría de Extensión y Proyección Social', margin, 13);
  doc.setTextColor(0, 0, 0);
  y = 26;

  // Título del documento
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BITÁCORA DE SESIÓN', W / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const titleLines = doc.splitTextToSize(activityTitle, W - margin * 2);
  doc.text(titleLines, W / 2, y, { align: 'center' });
  y += titleLines.length * 5 + 4;

  // Datos de la sesión
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  const sessionData = [
    ['Sesión N°', String(session.sessionNumber), 'Fecha', fmt(session.date)],
    ['Hora inicio', session.startTime ?? '—', 'Hora fin', session.endTime ?? '—'],
    ['Lugar', session.location ?? '—', 'Asistentes', String(session.totalRegistered)],
    ['Tema', session.topic ?? '—', '', ''],
  ];

  autoTable(doc, {
    startY: y,
    body: sessionData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 28 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 28 },
      3: { cellWidth: 60 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // 3 Momentos pedagógicos
  const ORDER = ['explorar', 'crear', 'consolidar'] as const;
  const LABELS: Record<string, string> = {
    explorar:   '1. EXPLORAR — Activación de saberes previos',
    crear:      '2. CREAR — Desarrollo y práctica',
    consolidar: '3. CONSOLIDAR — Cierre y evaluación',
  };

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('MOMENTOS PEDAGÓGICOS', margin, y);
  y += 4;

  const momentsBody = ORDER.map((mt) => {
    const m = session.moments.find((mo) => mo.momentType === mt);
    return [
      LABELS[mt],
      m?.objective    ?? '',
      m?.methodology  ?? '',
      m?.materials    ?? '',
      m?.durationMinutes ? `${m.durationMinutes} min` : '',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Momento', 'Objetivo', 'Metodología', 'Materiales', 'Duración']],
    body: momentsBody,
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
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Lista de asistentes
  if (session.attendees.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE ASISTENTES', margin, y);
    y += 4;

    const attendeesBody = session.attendees.map((a, i) => [
      String(i + 1),
      a.fullName,
      a.documentNumber ?? '',
      a.attended ? 'Sí' : 'No',
      '', // Firma
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Nombre completo', 'Documento', 'Asistió', 'Firma']],
      body: attendeesBody,
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
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Firmas
  if (y > 250) { doc.addPage(); y = margin; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.line(margin, y + 10, margin + 60, y + 10);
  doc.line(W - margin - 60, y + 10, W - margin, y + 10);
  doc.text('Docente responsable', margin, y + 14);
  doc.text('Coordinador / Enlace', W - margin - 60, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, margin, y + 19);

  // Pie de página
  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado el ${today} — NodoSys / IU Digital`, W / 2, 290, { align: 'center' });

  const fileName = `Bitacora_S${session.sessionNumber}_${session.date}.pdf`;
  doc.save(fileName);
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

// ── Página principal ──────────────────────────────────────
export default function SessionDetailPage() {
  const { id: activityId, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, isVicerrector } = useAuth();
  const isDirector = isAdmin || isVicerrector;

  const [showAddAttendee, setShowAddAttendee] = useState(false);

  const q = useQuery({
    queryKey: ['session', sid],
    queryFn: () => sessionsService.getById(sid!),
    enabled: !!sid,
  });

  const deleteAttendeeM = useMutation({
    mutationFn: (attendeeId: string) => sessionsService.deleteAttendee(sid!, attendeeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sid] }),
  });

  const toggleAttendedM = useMutation({
    mutationFn: ({ attendeeId, attended }: { attendeeId: string; attended: boolean }) =>
      sessionsService.updateAttendee(sid!, attendeeId, { attended }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sid] }),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  const s = q.data;
  if (!s) return null;

  const canEdit = isDirector || s.createdBy === user?.id;
  const ORDER = ['explorar', 'crear', 'consolidar'] as const;

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Navegación */}
      <button
        onClick={() => navigate(`/actividades/${activityId}`)}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Volver a la actividad
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
              <h1 className="text-xl font-bold text-white">{s.topic ?? `Sesión ${s.sessionNumber}`}</h1>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => exportPDF(s, s.topic ?? `Sesión ${s.sessionNumber}`, user?.name ?? 'Docente')}
              className="flex items-center gap-1.5 text-xs bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Download size={13} /> Bitácora PDF
            </button>
            {canEdit && (
              <button
                onClick={() => navigate(`/actividades/${activityId}/sesiones/${sid}/editar`)}
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

      {/* 3 Momentos pedagógicos */}
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
            {canEdit
              ? 'Agrega los participantes de esta sesión.'
              : 'Sin asistentes registrados.'}
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

      {showAddAttendee && (
        <AddAttendeeModal sessionId={sid!} onClose={() => setShowAddAttendee(false)} />
      )}
    </div>
  );
}
