import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Loader2, BookOpen,
  Zap, Calendar, User, Tag, Download,
} from 'lucide-react';
import { processesService } from '@/services/processes.service';
import { activitiesService } from '@/services/activities.service';
import { useAuth } from '@/hooks/useAuth';
import SessionsTab from '@/pages/actividades/SessionsTab';
import type { ProcessType, ProcessStatus } from '@/types';
import { exportConsolidatedPDF } from '@/utils/pdfProcess';

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
