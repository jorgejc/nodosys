import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Loader2, Layers, BookOpen, Zap } from 'lucide-react';
import { processesService } from '@/services/processes.service';
import { useAuth } from '@/hooks/useAuth';
import type { Process, ProcessType, ProcessStatus } from '@/types';

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

type FilterStatus = 'todos' | ProcessStatus;

function ProcessCard({ process }: { process: Process }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/procesos/${process.id}`)}
      className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 hover:border-[#FF6B2B]/40 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FF6B2B]/10 border border-[#FF6B2B]/20 flex items-center justify-center flex-shrink-0">
            <Layers size={16} className="text-[#FF6B2B]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-medium text-sm group-hover:text-[#FF6B2B] transition-colors truncate">
              {process.name}
            </h3>
            {process.description && (
              <p className="text-xs text-[#555] mt-0.5 truncate">{process.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[process.type]}`}>
            {TYPE_LABELS[process.type]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[process.status]}`}>
            {STATUS_LABELS[process.status]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 pl-12">
        <span className="flex items-center gap-1.5 text-xs text-[#555]">
          <BookOpen size={12} />
          Sesiones
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#555]">
          <Zap size={12} />
          Actividades
        </span>
        <span className="text-xs text-[#444] ml-auto">
          {process.creator?.name ?? '—'}
        </span>
      </div>
    </div>
  );
}

export default function ProcesosPage() {
  const navigate = useNavigate();
  const { canCreateProceso } = useAuth();
  const [filter, setFilter] = useState<FilterStatus>('todos');

  const q = useQuery({
    queryKey: ['processes'],
    queryFn:  () => processesService.getAll(),
  });

  const all = q.data ?? [];
  const visible = filter === 'todos' ? all : all.filter((p) => p.status === filter);

  const tabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'todos',     label: 'Todos',      count: all.length },
    { key: 'activo',    label: 'Activos',    count: all.filter((p) => p.status === 'activo').length },
    { key: 'finalizado',label: 'Finalizados',count: all.filter((p) => p.status === 'finalizado').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">Procesos</h1>
          <p className="text-[#555] text-xs mt-0.5">Cursos, clubes, talleres y procesos formativos</p>
        </div>
        {canCreateProceso && (
          <button
            onClick={() => navigate('/procesos/nuevo')}
            className="flex items-center gap-2 text-sm bg-[#FF6B2B] hover:bg-[#e55a1f] text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Nuevo proceso
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1 border-b border-[#1E1E1E]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              filter === t.key
                ? 'border-[#FF6B2B] text-[#FF6B2B]'
                : 'border-transparent text-[#666] hover:text-white'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              filter === t.key ? 'bg-[#FF6B2B]/20 text-[#FF6B2B]' : 'bg-[#1E1E1E] text-[#555]'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      {q.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#111] border border-[#2A2A2A] rounded-xl">
          <Layers size={40} className="text-[#333] mb-3" />
          <p className="text-[#555] text-sm">Sin procesos {filter !== 'todos' ? STATUS_LABELS[filter as ProcessStatus].toLowerCase() + 's' : ''}</p>
          {canCreateProceso && filter === 'todos' && (
            <button
              onClick={() => navigate('/procesos/nuevo')}
              className="mt-4 text-[#FF6B2B] text-sm hover:underline"
            >
              Crear primer proceso →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <ProcessCard key={p.id} process={p} />
          ))}
        </div>
      )}
    </div>
  );
}
