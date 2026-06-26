import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, BookOpen, Calendar, Users, Clock, Trash2, ChevronRight } from 'lucide-react';
import { sessionsService, type CourseSession } from '@/services/sessions.service';
import { useAuth } from '@/hooks/useAuth';

const MOMENT_LABELS = { explorar: '1. Explorar', crear: '2. Crear', consolidar: '3. Consolidar' };

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function SessionCard({ session, activityId, canDelete, onDelete }: {
  session: CourseSession;
  activityId: string;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const filledMoments = session.moments?.filter(
    (m) => m.objective || m.methodology || m.materials,
  ).length ?? 0;

  return (
    <div
      onClick={() => navigate(`/actividades/${activityId}/sesiones/${session.id}`)}
      className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 hover:border-[#FF6B2B]/40 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FF6B2B]/10 border border-[#FF6B2B]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[#FF6B2B] font-bold text-sm">{session.sessionNumber}</span>
          </div>
          <div>
            <h3 className="text-white font-medium text-sm group-hover:text-[#FF6B2B] transition-colors">
              {session.topic ?? `Sesión ${session.sessionNumber}`}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-[#666]">
                <Calendar size={11} /> {formatDate(session.date)}
              </span>
              {session.startTime && (
                <span className="flex items-center gap-1 text-xs text-[#666]">
                  <Clock size={11} /> {session.startTime}{session.endTime ? ` — ${session.endTime}` : ''}
                </span>
              )}
              {session.totalRegistered > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#666]">
                  <Users size={11} /> {session.totalRegistered}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Indicador de momentos completados */}
          <div className="hidden sm:flex items-center gap-1">
            {(['explorar', 'crear', 'consolidar'] as const).map((mt) => {
              const m = session.moments?.find((mo) => mo.momentType === mt);
              const filled = !!(m?.objective || m?.methodology || m?.materials);
              return (
                <div
                  key={mt}
                  title={MOMENT_LABELS[mt]}
                  className={`w-2 h-2 rounded-full ${filled ? 'bg-[#FF6B2B]' : 'bg-[#2A2A2A]'}`}
                />
              );
            })}
            <span className="text-xs text-[#555] ml-1">{filledMoments}/3</span>
          </div>
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
              className="opacity-0 group-hover:opacity-100 text-[#444] hover:text-red-400 transition-all p-1"
            >
              <Trash2 size={14} />
            </button>
          )}
          <ChevronRight size={16} className="text-[#444] group-hover:text-[#FF6B2B] transition-colors" />
        </div>
      </div>

      {session.location && (
        <p className="text-xs text-[#555] mt-2 pl-12">{session.location}</p>
      )}
    </div>
  );
}

interface Props {
  activityId: string;
  activityTitle: string;
}

export default function SessionsTab({ activityId, activityTitle }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isVicerrector } = useAuth();
  const isDirector = isAdmin || isVicerrector;

  const q = useQuery({
    queryKey: ['sessions', activityId],
    queryFn: () => sessionsService.getByActivity(activityId),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => sessionsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions', activityId] }),
  });

  const sessions = q.data ?? [];

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header de la pestaña */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-sm">Bitácora de sesiones</h2>
          <p className="text-xs text-[#555] mt-0.5">
            {sessions.length === 0
              ? 'Registra la primera sesión de esta actividad'
              : `${sessions.length} sesión${sessions.length !== 1 ? 'es' : ''} registrada${sessions.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => navigate(`/actividades/${activityId}/sesiones/nueva`)}
          className="flex items-center gap-1.5 text-xs bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 text-[#FF6B2B] hover:bg-[#FF6B2B]/20 px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={13} /> Nueva sesión
        </button>
      </div>

      {/* Lista de sesiones */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[#111] border border-[#2A2A2A] rounded-xl">
          <BookOpen size={36} className="text-[#333] mb-3" />
          <p className="text-[#555] text-sm">Sin sesiones registradas</p>
          <p className="text-xs text-[#444] mt-1 max-w-xs">
            Documenta cada encuentro con los 3 momentos pedagógicos: Explorar, Crear y Consolidar.
          </p>
          <button
            onClick={() => navigate(`/actividades/${activityId}/sesiones/nueva`)}
            className="mt-4 text-[#FF6B2B] text-sm hover:underline"
          >
            Registrar primera sesión →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              activityId={activityId}
              canDelete={isDirector}
              onDelete={(id) => deleteM.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Enlace al reporte de asistencia */}
      {sessions.length > 0 && (
        <div className="pt-2 border-t border-[#1E1E1E]">
          <button
            onClick={() => navigate(`/actividades/${activityId}/sesiones/asistencia`)}
            className="flex items-center gap-2 text-xs text-[#666] hover:text-white transition-colors"
          >
            <Users size={13} /> Ver reporte consolidado de asistencia
          </button>
        </div>
      )}
    </div>
  );
}
