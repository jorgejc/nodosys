/**
 * ActivityDetailPage.tsx — Detalle completo de una solicitud de actividad
 *
 * Muestra toda la información de la solicitud organizada en secciones:
 *  - Encabezado con estado, código y acciones según rol
 *  - Viáticos solicitados vs ejecutados
 *  - Gastos reales (agregar, ver por categoría)
 *  - Participantes (lista con asistencia)
 *  - Evidencias (fotos, facturas, documentos)
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Send, Check, X, Plus, Trash2,
  Loader2, ExternalLink, Users, Image,
  FileText, DollarSign, CheckCircle2, Clock,
  XCircle, PlayCircle, AlertTriangle,
} from 'lucide-react';
import { activitiesService } from '@/services/activities.service';
import { useAuth } from '@/hooks/useAuth';

// ── Tipos ─────────────────────────────────────────────────
interface ActivityDetail {
  id: string;
  title: string;
  description: string | null;
  activityDate: string;
  endDate: string | null;
  location: string | null;
  expectedParticipants: number;
  status: string;
  activityCode: string | null;
  totalEstimated: number;
  rejectionReason: string | null;
  reviewerNotes: string | null;
  requiresFood: boolean; foodAmount: number;
  requiresTransport: boolean; transportAmount: number;
  requiresAccommodation: boolean; accommodationAmount: number;
  requiresMaterials: boolean; materialsAmount: number;
  requiresOther: boolean; otherDescription: string | null; otherAmount: number;
  requiresAdvance: boolean; advanceAmount: number;
  user?: { name: string; email: string };
  expenses?: ExpenseItem[];
  participants?: ParticipantItem[];
  evidence?: EvidenceItem[];
}

interface ExpenseItem {
  id: string; expenseDate: string; category: string;
  description: string | null; amount: number; receiptUrl: string | null;
}
interface ParticipantItem {
  id: string; name: string; email: string | null;
  phone: string | null; institution: string | null; role: string | null;
}
interface EvidenceItem {
  id: string; evidenceType: string; storageUrl: string;
  fileName: string | null; caption: string | null;
}

// ── Helpers visuales ──────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{size:number}> }> = {
  borrador:     { label: 'Borrador',     color: 'text-[#666]',     bg: 'bg-[#1A1A1A]',     border: 'border-[#333]',        icon: FileText },
  pendiente:    { label: 'Pendiente',    color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', icon: Clock },
  aprobada:     { label: 'Aprobada',     color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  icon: CheckCircle2 },
  rechazada:    { label: 'Rechazada',    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    icon: XCircle },
  en_ejecucion: { label: 'En ejecución', color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   icon: PlayCircle },
  ejecutada:    { label: 'Ejecutada',    color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30', icon: AlertTriangle },
  cerrada:      { label: 'Cerrada',      color: 'text-[#555]',     bg: 'bg-[#111]',        border: 'border-[#222]',        icon: Check },
};

const EXPENSE_LABELS: Record<string, string> = {
  alimentacion: '🍽️ Alimentación', transporte: '🚌 Transporte',
  hospedaje: '🏨 Hospedaje', materiales: '📦 Materiales',
  comunicaciones: '📡 Comunicaciones', otro: '📎 Otro',
};

const EVIDENCE_LABELS: Record<string, string> = {
  foto_evento: '📸 Foto del evento', factura: '🧾 Factura',
  factura_pendiente: '⏳ Factura pendiente', registro_participantes: '📋 Registro',
  otro: '📄 Otro',
};

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['borrador'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon size={11} />{cfg.label}
    </span>
  );
}

const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]";
const lbl = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";

// ── Modal de revisión ─────────────────────────────────────
function ReviewModal({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<'aprobada' | 'rechazada' | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const m = useMutation({
    mutationFn: () => activitiesService.review(activityId, {
      decision: decision!, rejectionReason: reason || undefined, reviewerNotes: notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activity', activityId] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <h2 className="text-white font-semibold">Revisar solicitud</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(['aprobada', 'rechazada'] as const).map(d => (
              <button key={d} onClick={() => setDecision(d)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                  decision === d
                    ? d === 'aprobada' ? 'bg-green-400/15 border-green-400/40 text-green-400' : 'bg-red-400/15 border-red-400/40 text-red-400'
                    : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#666] hover:text-white'
                }`}>
                {d === 'aprobada' ? <><Check size={15}/> Aprobar</> : <><X size={15}/> Rechazar</>}
              </button>
            ))}
          </div>
          {decision === 'rechazada' && (
            <div>
              <label className={lbl}>Motivo del rechazo *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Explica el motivo..." className={`${inp} resize-none`}/>
            </div>
          )}
          <div>
            <label className={lbl}>Observaciones adicionales</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Comentarios para el docente..." className={`${inp} resize-none`}/>
          </div>
          <button onClick={() => m.mutate()}
            disabled={!decision || (decision === 'rechazada' && !reason) || m.isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {m.isPending ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
            Confirmar {decision === 'aprobada' ? 'aprobación' : 'rechazo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal agregar gasto ───────────────────────────────────
function AddExpenseModal({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ expenseDate: '', category: 'alimentacion', description: '', amount: '', receiptUrl: '' });
  const F = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const m = useMutation({
    mutationFn: () => activitiesService.addExpense(activityId, {
      expenseDate: form.expenseDate, category: form.category,
      description: form.description || undefined,
      amount: parseFloat(form.amount),
      receiptUrl: form.receiptUrl || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activity', activityId] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <h2 className="text-white font-semibold">Registrar gasto</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha *</label>
              <input type="date" value={form.expenseDate} onChange={e => F('expenseDate', e.target.value)} className={inp}/>
            </div>
            <div>
              <label className={lbl}>Categoría *</label>
              <select value={form.category} onChange={e => F('category', e.target.value)} className={inp}>
                {['alimentacion','transporte','hospedaje','materiales','comunicaciones','otro'].map(c => (
                  <option key={c} value={c}>{EXPENSE_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Descripción</label>
            <input value={form.description} onChange={e => F('description', e.target.value)}
              placeholder="Almuerzo 3 personas, combustible..." className={inp}/>
          </div>
          <div>
            <label className={lbl}>Monto (COP) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#555]">$</span>
              <input type="number" min={0} value={form.amount} onChange={e => F('amount', e.target.value)}
                placeholder="45000" className={`${inp} pl-7`}/>
            </div>
          </div>
          <div>
            <label className={lbl}>URL foto de la factura/recibo</label>
            <input type="url" value={form.receiptUrl} onChange={e => F('receiptUrl', e.target.value)}
              placeholder="https://drive.google.com/..." className={inp}/>
            <p className="text-xs text-[#555] mt-1">Sube la foto al Drive y pega el enlace aquí</p>
          </div>
          <button onClick={() => m.mutate()}
            disabled={!form.expenseDate || !form.amount || m.isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {m.isPending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
            Registrar gasto
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal agregar participante ────────────────────────────
function AddParticipantModal({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', phone: '', institution: '', role: '' });
  const F = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const m = useMutation({
    mutationFn: () => activitiesService.addParticipant(activityId, {
      name: form.name, email: form.email || undefined,
      phone: form.phone || undefined, institution: form.institution || undefined,
      role: form.role || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activity', activityId] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <h2 className="text-white font-semibold">Registrar participante</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={lbl}>Nombre completo *</label>
            <input value={form.name} onChange={e => F('name', e.target.value)}
              placeholder="Juan Pablo Martínez" className={inp}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.email} onChange={e => F('email', e.target.value)}
                placeholder="juan@email.com" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input value={form.phone} onChange={e => F('phone', e.target.value)}
                placeholder="3001234567" className={inp}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Institución</label>
              <input value={form.institution} onChange={e => F('institution', e.target.value)}
                placeholder="IER El Caníme" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Rol</label>
              <input value={form.role} onChange={e => F('role', e.target.value)}
                placeholder="Docente, Estudiante..." className={inp}/>
            </div>
          </div>
          <button onClick={() => m.mutate()}
            disabled={!form.name || m.isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {m.isPending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
            Agregar participante
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal agregar evidencia ───────────────────────────────
function AddEvidenceModal({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ evidenceType: 'foto_evento', storageUrl: '', caption: '' });
  const F = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const m = useMutation({
    mutationFn: () => activitiesService.addEvidence(activityId, {
      evidenceType: form.evidenceType, storageUrl: form.storageUrl,
      caption: form.caption || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activity', activityId] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <h2 className="text-white font-semibold">Agregar evidencia</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={lbl}>Tipo de evidencia *</label>
            <select value={form.evidenceType} onChange={e => F('evidenceType', e.target.value)} className={inp}>
              {Object.entries(EVIDENCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>URL del archivo (Drive, etc.) *</label>
            <input type="url" value={form.storageUrl} onChange={e => F('storageUrl', e.target.value)}
              placeholder="https://drive.google.com/..." className={inp}/>
            <p className="text-xs text-[#555] mt-1">Sube el archivo a Google Drive y pega el enlace compartible aquí</p>
          </div>
          <div>
            <label className={lbl}>Descripción</label>
            <input value={form.caption} onChange={e => F('caption', e.target.value)}
              placeholder="Fotos de la inauguración, facturas del evento..." className={inp}/>
          </div>
          <button onClick={() => m.mutate()}
            disabled={!form.storageUrl || m.isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {m.isPending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
            Agregar evidencia
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isDecano, isVicerrector } = useAuth();
  const isDirector = isAdmin || isDecano || isVicerrector;

  const [modal, setModal] = useState<'review' | 'expense' | 'participant' | 'evidence' | null>(null);

  const q = useQuery({
    queryKey: ['activity', id],
    queryFn: () => activitiesService.getById(id!),
    enabled: !!id,
  });

  const submitM = useMutation({
    mutationFn: () => activitiesService.submit(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity', id] }),
  });

  const executedM = useMutation({
    mutationFn: () => activitiesService.markExecuted(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity', id] }),
  });

  const deleteExpenseM = useMutation({
    mutationFn: (eid: string) => activitiesService.deleteExpense(eid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity', id] }),
  });

  const deleteParticipantM = useMutation({
    mutationFn: (pid: string) => activitiesService.deleteParticipant(pid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity', id] }),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[#FF6B2B]"/>
      </div>
    );
  }

  const a = q.data as ActivityDetail;
  if (!a) return null;

  const expenses     = a.expenses ?? [];
  const participants = a.participants ?? [];
  const evidence     = a.evidence ?? [];

  const totalExpended = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Viáticos solicitados
  const viaticosItems = [
    { show: a.requiresFood,          label: 'Alimentación',  amount: a.foodAmount },
    { show: a.requiresTransport,     label: 'Transporte',    amount: a.transportAmount },
    { show: a.requiresAccommodation, label: 'Hospedaje',     amount: a.accommodationAmount },
    { show: a.requiresMaterials,     label: 'Materiales',    amount: a.materialsAmount },
    { show: a.requiresOther,         label: a.otherDescription ?? 'Otros', amount: a.otherAmount },
    { show: a.requiresAdvance,       label: 'Anticipo',      amount: a.advanceAmount },
  ].filter(v => v.show);

  const canEdit      = ['borrador','pendiente'].includes(a.status);
  const canAddData   = ['aprobada','en_ejecucion','ejecutada'].includes(a.status);

  return (
    <div className="space-y-6 pb-10 max-w-4xl">
      {/* Header */}
      <button onClick={() => navigate('/actividades')}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors">
        <ArrowLeft size={16}/> Volver a solicitudes
      </button>

      {/* Encabezado de la solicitud */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {a.activityCode && (
                <span className="text-xs font-mono text-[#FF6B2B] bg-[#FF6B2B]/10 px-2.5 py-1 rounded-lg border border-[#FF6B2B]/20 font-semibold">
                  {a.activityCode}
                </span>
              )}
              <StatusBadge status={a.status}/>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">{a.title}</h1>
            {a.description && <p className="text-sm text-[#666]">{a.description}</p>}
          </div>
          {/* Acciones */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {a.status === 'borrador' && (
              <button onClick={() => submitM.mutate()}
                disabled={submitM.isPending}
                className="flex items-center gap-1.5 text-xs bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 text-[#FF6B2B] hover:bg-[#FF6B2B]/20 px-3 py-2 rounded-lg transition-colors">
                {submitM.isPending ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>}
                Enviar para aprobación
              </button>
            )}
            {isDirector && a.status === 'pendiente' && (
              <button onClick={() => setModal('review')}
                className="flex items-center gap-1.5 text-xs bg-green-400/10 border border-green-400/30 text-green-400 hover:bg-green-400/20 px-3 py-2 rounded-lg transition-colors">
                <CheckCircle2 size={12}/> Revisar solicitud
              </button>
            )}
            {['aprobada','en_ejecucion'].includes(a.status) && (
              <button onClick={() => executedM.mutate()}
                disabled={executedM.isPending}
                className="flex items-center gap-1.5 text-xs bg-purple-400/10 border border-purple-400/30 text-purple-400 hover:bg-purple-400/20 px-3 py-2 rounded-lg transition-colors">
                {executedM.isPending ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
                Marcar como ejecutada
              </button>
            )}
          </div>
        </div>

        {/* Info básica */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#1E1E1E]">
          <div>
            <div className="text-xs text-[#555] mb-0.5">Fecha</div>
            <div className="text-sm text-white">{new Date(a.activityDate).toLocaleDateString('es-CO')}</div>
            {a.endDate && <div className="text-xs text-[#666]">→ {new Date(a.endDate).toLocaleDateString('es-CO')}</div>}
          </div>
          <div>
            <div className="text-xs text-[#555] mb-0.5">Lugar</div>
            <div className="text-sm text-white">{a.location ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-[#555] mb-0.5">Participantes esperados</div>
            <div className="text-sm text-white">{a.expectedParticipants}</div>
          </div>
          {a.user && (
            <div>
              <div className="text-xs text-[#555] mb-0.5">Solicitante</div>
              <div className="text-sm text-white">{a.user.name}</div>
            </div>
          )}
        </div>

        {/* Motivo de rechazo */}
        {a.status === 'rechazada' && a.rejectionReason && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-xs text-red-400 font-medium mb-1">Motivo del rechazo:</p>
            <p className="text-sm text-red-300">{a.rejectionReason}</p>
          </div>
        )}
        {a.reviewerNotes && (
          <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-400 font-medium mb-1">Observaciones del revisor:</p>
            <p className="text-sm text-blue-300">{a.reviewerNotes}</p>
          </div>
        )}
      </div>

      {/* Viáticos */}
      {viaticosItems.length > 0 && (
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-[#FF6B2B]"/>
              <span className="text-sm font-semibold text-white">Viáticos solicitados</span>
            </div>
            <span className="text-[#FF6B2B] font-bold text-sm">{formatCOP(a.totalEstimated)} estimado</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {viaticosItems.map(v => (
              <div key={v.label} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3">
                <div className="text-xs text-[#555] mb-1">{v.label}</div>
                <div className="text-sm font-semibold text-white">{formatCOP(v.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gastos reales */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E1E1E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={15} className="text-green-400"/>
            <span className="text-sm font-semibold text-white">Gastos ejecutados</span>
            {totalExpended > 0 && <span className="text-green-400 font-bold text-sm ml-2">{formatCOP(totalExpended)}</span>}
          </div>
          {canAddData && (
            <button onClick={() => setModal('expense')}
              className="flex items-center gap-1.5 text-xs bg-green-400/10 border border-green-400/30 text-green-400 hover:bg-green-400/20 px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={12}/> Registrar gasto
            </button>
          )}
        </div>
        {expenses.length === 0 ? (
          <div className="py-8 text-center text-[#555] text-sm">
            {canAddData ? 'Sin gastos registrados. Agrega los gastos reales de la actividad.' : 'Sin gastos registrados.'}
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {expenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#161616]">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#FF6B2B] bg-[#FF6B2B]/10 px-2 py-0.5 rounded">
                      {EXPENSE_LABELS[e.category] ?? e.category}
                    </span>
                    <span className="text-xs text-[#555]">{new Date(e.expenseDate).toLocaleDateString('es-CO')}</span>
                  </div>
                  {e.description && <div className="text-xs text-[#666] mt-0.5">{e.description}</div>}
                </div>
                <div className="text-sm font-semibold text-white">{formatCOP(Number(e.amount))}</div>
                {e.receiptUrl && (
                  <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#FF6B2B] hover:text-white transition-colors p-1">
                    <ExternalLink size={13}/>
                  </a>
                )}
                {canAddData && (
                  <button onClick={() => deleteExpenseM.mutate(e.id)}
                    className="text-[#444] hover:text-red-400 transition-colors p-1">
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participantes */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E1E1E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-blue-400"/>
            <span className="text-sm font-semibold text-white">Participantes</span>
            <span className="text-xs text-[#555] bg-[#1A1A1A] px-2 py-0.5 rounded-full">{participants.length}</span>
          </div>
          {canAddData && (
            <button onClick={() => setModal('participant')}
              className="flex items-center gap-1.5 text-xs bg-blue-400/10 border border-blue-400/30 text-blue-400 hover:bg-blue-400/20 px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={12}/> Agregar participante
            </button>
          )}
        </div>
        {participants.length === 0 ? (
          <div className="py-8 text-center text-[#555] text-sm">
            {canAddData ? 'Sin participantes. Registra la lista de asistentes.' : 'Sin participantes registrados.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E]">
                  {['Nombre','Email','Institución','Rol',''].map(h => (
                    <th key={h} className="text-left text-xs font-mono text-[#555] uppercase px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participants.map(p => (
                  <tr key={p.id} className="border-b border-[#1A1A1A] hover:bg-[#161616]">
                    <td className="px-4 py-2.5 text-white font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-[#666] text-xs">{p.email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#666] text-xs">{p.institution ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#666] text-xs">{p.role ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {canAddData && (
                        <button onClick={() => deleteParticipantM.mutate(p.id)}
                          className="text-[#444] hover:text-red-400 transition-colors">
                          <Trash2 size={13}/>
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
            <Image size={15} className="text-purple-400"/>
            <span className="text-sm font-semibold text-white">Evidencias y soportes</span>
            <span className="text-xs text-[#555] bg-[#1A1A1A] px-2 py-0.5 rounded-full">{evidence.length}</span>
          </div>
          <button onClick={() => setModal('evidence')}
            className="flex items-center gap-1.5 text-xs bg-purple-400/10 border border-purple-400/30 text-purple-400 hover:bg-purple-400/20 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={12}/> Agregar evidencia
          </button>
        </div>
        {evidence.length === 0 ? (
          <div className="py-8 text-center text-[#555] text-sm">
            Sin evidencias. Agrega fotos, facturas o documentos del evento.
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {evidence.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#161616]">
                <div className="flex-1">
                  <div className="text-xs text-[#888]">{EVIDENCE_LABELS[ev.evidenceType] ?? ev.evidenceType}</div>
                  {ev.caption && <div className="text-sm text-white mt-0.5">{ev.caption}</div>}
                  {ev.fileName && <div className="text-xs text-[#555]">{ev.fileName}</div>}
                </div>
                <a href={ev.storageUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#FF6B2B] hover:text-white transition-colors">
                  <ExternalLink size={13}/> Abrir
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      {modal === 'review'      && <ReviewModal      activityId={id!} onClose={() => setModal(null)}/>}
      {modal === 'expense'     && <AddExpenseModal   activityId={id!} onClose={() => setModal(null)}/>}
      {modal === 'participant' && <AddParticipantModal activityId={id!} onClose={() => setModal(null)}/>}
      {modal === 'evidence'    && <AddEvidenceModal  activityId={id!} onClose={() => setModal(null)}/>}
    </div>
  );
}
