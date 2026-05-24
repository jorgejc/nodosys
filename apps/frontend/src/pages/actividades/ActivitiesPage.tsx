/**
 * ActivitiesPage.tsx — Lista de solicitudes de actividades y viáticos
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, ChevronRight, Loader2,
  Clock, CheckCircle2, XCircle, FileText,
  AlertTriangle, PlayCircle, Archive, Send,
  Check, X,
} from 'lucide-react';
import { activitiesService } from '@/services/activities.service';
import { useAuth } from '@/hooks/useAuth';

// ── Tipo local para la actividad en el listado ────────────
// Evita usar Record<string, unknown> que causa errores de TypeScript
interface ActivityListItem {
  id: string;
  title: string;
  description: string | null;
  activityDate: string;
  endDate: string | null;
  location: string | null;
  status: string;
  activityCode: string | null;
  totalEstimated: number;
  requiresFood: boolean;
  foodAmount: number;
  requiresTransport: boolean;
  transportAmount: number;
  requiresAccommodation: boolean;
  accommodationAmount: number;
  requiresMaterials: boolean;
  materialsAmount: number;
  requiresAdvance: boolean;
  advanceAmount: number;
  rejectionReason: string | null;
  user?: { id: string; name: string; email: string };
}

// ── Configuración visual de estados ───────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string;
  icon: typeof FileText;
}> = {
  borrador:     { label: 'Borrador',     color: 'text-[#666]',     bg: 'bg-[#1A1A1A]',     border: 'border-[#333]',         icon: FileText },
  pendiente:    { label: 'Pendiente',    color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30',  icon: Clock },
  aprobada:     { label: 'Aprobada',     color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',   icon: CheckCircle2 },
  rechazada:    { label: 'Rechazada',    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',     icon: XCircle },
  en_ejecucion: { label: 'En ejecución', color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',    icon: PlayCircle },
  ejecutada:    { label: 'Ejecutada',    color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30',  icon: AlertTriangle },
  cerrada:      { label: 'Cerrada',      color: 'text-[#555]',     bg: 'bg-[#111]',        border: 'border-[#222]',         icon: Archive },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['borrador'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(amount);
}

// ── Modal de revisión (aprobar/rechazar) ──────────────────
function ReviewModal({
  activityId, onClose,
}: { activityId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<'aprobada' | 'rechazada' | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => activitiesService.review(activityId, {
      decision: decision!,
      rejectionReason: decision === 'rechazada' ? reason : undefined,
      reviewerNotes: notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities'] }); onClose(); },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Error al procesar la revisión');
    },
  });

  const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <h2 className="text-white font-semibold">Revisar solicitud</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-red-400 text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setDecision('aprobada')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                decision === 'aprobada'
                  ? 'bg-green-400/15 border-green-400/40 text-green-400'
                  : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#666] hover:text-white'
              }`}>
              <Check size={16} /> Aprobar
            </button>
            <button onClick={() => setDecision('rechazada')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                decision === 'rechazada'
                  ? 'bg-red-400/15 border-red-400/40 text-red-400'
                  : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#666] hover:text-white'
              }`}>
              <X size={16} /> Rechazar
            </button>
          </div>

          {decision === 'rechazada' && (
            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Motivo del rechazo *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Explica por qué se rechaza la solicitud..." className={`${inp} resize-none`} />
            </div>
          )}

          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Observaciones (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Comentarios adicionales para el docente..." className={`${inp} resize-none`} />
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={!decision || (decision === 'rechazada' && !reason) || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirmar {decision === 'aprobada' ? 'aprobación' : decision === 'rechazada' ? 'rechazo' : 'decisión'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function ActivitiesPage() {
  const navigate = useNavigate();
  const { isDecano, isVicerrector, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const isDirector = isAdmin || isDecano || isVicerrector;

  const q = useQuery({
    queryKey: ['activities', statusFilter],
    queryFn: () => activitiesService.getAll({ status: statusFilter || undefined }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => activitiesService.submit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });

  // Cast seguro: el backend devuelve estos campos
  const activities = (q.data ?? []) as ActivityListItem[];

  const filtered = activities.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase())
  );

  // Conteo por estado
  const counts: Record<string, number> = {};
  activities.forEach(a => { counts[a.status] = (counts[a.status] ?? 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// ACTIVIDADES Y VIÁTICOS</p>
          <h1 className="text-2xl font-bold text-white">Solicitudes de Actividades</h1>
          <p className="text-[#666] text-sm mt-1">
            Gestión de viáticos · {activities.length} solicitud{activities.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <button onClick={() => navigate('/actividades/nueva')}
          className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
          <Plus size={16} /> Nueva solicitud
        </button>
      </div>

      {/* Pestañas de estado */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setStatusFilter('')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            !statusFilter ? 'bg-[#FF6B2B]/10 border-[#FF6B2B]/30 text-[#FF6B2B]' : 'bg-[#111] border-[#2A2A2A] text-[#666] hover:text-white'
          }`}>
          Todas ({activities.length})
        </button>
        {['pendiente', 'aprobada', 'en_ejecucion', 'ejecutada', 'borrador', 'rechazada'].map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === s ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-[#111] border-[#2A2A2A] text-[#666] hover:text-white'
              }`}>
              {cfg.label}{counts[s] ? ` (${counts[s]})` : ''}
            </button>
          );
        })}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
        <input placeholder="Buscar por título de actividad..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]" />
      </div>

      {/* Lista */}
      {q.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#FF6B2B]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111] border border-dashed border-[#2A2A2A] rounded-xl p-16 text-center">
          <FileText size={40} className="text-[#333] mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Sin solicitudes</p>
          <p className="text-[#555] text-sm mb-5">Crea tu primera solicitud de actividad</p>
          <button onClick={() => navigate('/actividades/nueva')}
            className="bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            Crear solicitud
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(activity => {
            // Viáticos solicitados — ahora con tipado correcto
            const viaticos = [
              { show: activity.requiresFood,          label: 'Alimentación', amount: activity.foodAmount },
              { show: activity.requiresTransport,     label: 'Transporte',   amount: activity.transportAmount },
              { show: activity.requiresAccommodation, label: 'Hospedaje',    amount: activity.accommodationAmount },
              { show: activity.requiresMaterials,     label: 'Materiales',   amount: activity.materialsAmount },
            ].filter(v => v.show);

            const dateStr    = new Date(activity.activityDate).toLocaleDateString('es-CO');
            const endDateStr = activity.endDate
              ? ` → ${new Date(activity.endDate).toLocaleDateString('es-CO')}`
              : '';

            return (
              <div key={activity.id}
                className="bg-[#111] border border-[#2A2A2A] hover:border-[#FF6B2B]/30 rounded-xl p-5 transition-all">

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Código y estado */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {activity.activityCode && (
                        <span className="text-xs font-mono text-[#FF6B2B] bg-[#FF6B2B]/10 px-2 py-0.5 rounded border border-[#FF6B2B]/20">
                          {activity.activityCode}
                        </span>
                      )}
                      <StatusBadge status={activity.status} />
                    </div>

                    {/* Título — clickeable para ver detalle */}
                    <h3
                      onClick={() => navigate(`/actividades/${activity.id}`)}
                      className="text-white font-semibold hover:text-[#FF6B2B] transition-colors cursor-pointer truncate"
                    >
                      {activity.title}
                    </h3>

                    {/* Fecha y lugar — tipado correcto, sin cast problemático */}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#555]">
                      <span>📅 {dateStr}{endDateStr}</span>
                      {activity.location ? (
                        <span>📍 {activity.location}</span>
                      ) : null}
                      {isDirector && activity.user ? (
                        <span>👤 {activity.user.name}</span>
                      ) : null}
                    </div>

                    {/* Motivo de rechazo */}
                    {activity.status === 'rechazada' && activity.rejectionReason && (
                      <div className="mt-2 text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded px-3 py-1.5">
                        Motivo: {activity.rejectionReason}
                      </div>
                    )}

                    {/* Viáticos */}
                    {viaticos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {viaticos.map(v => (
                          <span key={v.label} className="text-xs bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-0.5 rounded text-[#888]">
                            {v.label}: {formatCOP(v.amount)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Acciones según estado */}
                    <div className="flex items-center gap-2 mt-3">
                      {/* Docente puede enviar un borrador */}
                      {activity.status === 'borrador' && (
                        <button
                          onClick={() => submitMutation.mutate(activity.id)}
                          disabled={submitMutation.isPending}
                          className="flex items-center gap-1.5 text-xs bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 text-[#FF6B2B] hover:bg-[#FF6B2B]/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {submitMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                          Enviar para aprobación
                        </button>
                      )}

                      {/* Director puede aprobar/rechazar pendientes */}
                      {isDirector && activity.status === 'pendiente' && (
                        <button
                          onClick={() => setReviewingId(activity.id)}
                          className="flex items-center gap-1.5 text-xs bg-green-400/10 border border-green-400/30 text-green-400 hover:bg-green-400/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <CheckCircle2 size={11} /> Revisar solicitud
                        </button>
                      )}

                      {/* Ver detalle siempre */}
                      <button
                        onClick={() => navigate(`/actividades/${activity.id}`)}
                        className="flex items-center gap-1 text-xs text-[#555] hover:text-white transition-colors ml-auto"
                      >
                        Ver detalle <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Total estimado */}
                  {activity.totalEstimated > 0 && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-white font-bold text-sm">{formatCOP(activity.totalEstimated)}</div>
                      <div className="text-xs text-[#555]">estimado</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de revisión */}
      {reviewingId && (
        <ReviewModal
          activityId={reviewingId}
          onClose={() => setReviewingId(null)}
        />
      )}
    </div>
  );
}
