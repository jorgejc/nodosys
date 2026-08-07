/**
 * ActivityModal.tsx — Alta/edición de una tarea dentro de una semana
 *
 * La semana ya está elegida (se abre desde la tarjeta de esa semana), así que
 * aquí NO se vuelve a escribir el nombre de la semana. El tope de 12 h lo
 * valida el backend; aquí se proyecta antes de enviar:
 *   - monitora → no puede guardar por encima del tope
 *   - enlace   → puede, pero debe escribir la nota de autorización
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { apiErrorMessage } from '@/utils/apiError';
import { MAX_WEEKLY_HOURS } from '@/types';
import type { MonitorWeekActivity } from '@/types';

interface Props {
  planId:      string;
  weekId:      string;                       // semana destino (tarea nueva)
  weekNumber:  number;                        // solo para mostrar
  activity:    MonitorWeekActivity | null;    // null = nueva
  /** Horas ya registradas en la semana por OTRAS tareas. */
  otherHours:  number;
  /** El enlace/admin puede autorizar semanas por encima del tope. */
  canOverride: boolean;
  onClose:     () => void;
}

export default function ActivityModal({
  planId, weekId, weekNumber, activity, otherHours, canOverride, onClose,
}: Props) {
  const qc = useQueryClient();
  const isNew = !activity;

  const [form, setForm] = useState({
    description:  activity?.description ?? '',
    hours:        activity ? String(activity.hours) : '',
    overrideNote: activity?.overrideNote ?? '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (activity) {
      setForm({
        description:  activity.description,
        hours:        String(activity.hours),
        overrideNote: activity.overrideNote ?? '',
      });
    }
  }, [activity]);

  // ── Proyección del tope ──
  const hours     = Number(form.hours) || 0;
  const projected = Math.round((otherHours + hours) * 10) / 10;
  const exceeds   = projected > MAX_WEEKLY_HOURS;

  const mutation = useMutation({
    mutationFn: () => {
      const overrideNote = canOverride && exceeds ? form.overrideNote.trim() : undefined;
      return isNew
        ? monitorsService.addActivity(planId, {
            weekId,
            description: form.description.trim(),
            hours,
            overrideNote,
          })
        : monitorsService.updateActivity(activity!.id, {
            description: form.description.trim(),
            hours,
            overrideNote,
          });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitor-plan'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = () => {
    setError('');
    if (!form.description.trim()) return setError('Describe la tarea.');
    if (hours <= 0)               return setError('Registra las horas dedicadas.');
    if (exceeds && !canOverride) {
      return setError(
        `La semana ${weekNumber} quedaría en ${projected} h y el tope es de ` +
        `${MAX_WEEKLY_HOURS} h. Ajusta las horas o pide autorización a tu enlace.`,
      );
    }
    if (exceeds && canOverride && !form.overrideNote.trim()) {
      return setError('Para autorizar una semana por encima del tope debes escribir la justificación.');
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-5 py-4">
          <h3 className="text-sm font-semibold text-white">
            {isNew ? 'Nueva tarea' : 'Editar tarea'}
            <span className="ml-2 font-normal text-[#666]">· Semana {weekNumber}</span>
          </h3>
          <button onClick={onClose} className="p-1 text-[#555] transition-colors hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">Descripción de la tarea</label>
            <textarea
              rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Acompañamiento en sala de cómputo, apoyo al taller de robótica..."
              className="w-full resize-none rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#FF6B2B]"
            />
          </div>

          <div className="w-32">
            <label className="mb-1.5 block text-xs font-medium text-[#888]">Horas</label>
            <input
              type="number" min={0} max={60} step={0.5} value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              placeholder="2.5"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#FF6B2B]"
            />
          </div>

          {/* Aviso del tope semanal */}
          {hours > 0 && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
              exceeds
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-[#2A2A2A] bg-[#141414] text-[#888]'
            }`}>
              {exceeds && <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />}
              <span>
                Semana {weekNumber}: <strong>{projected} h</strong> de {MAX_WEEKLY_HOURS} h
                {otherHours > 0 && ` (${otherHours} h ya registradas + ${hours} h)`}
                {exceeds && (canOverride
                  ? ' — supera el tope: requiere tu autorización.'
                  : ' — supera el tope permitido.')}
              </span>
            </div>
          )}

          {/* Nota de autorización: solo el enlace */}
          {exceeds && canOverride && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-amber-300">
                Justificación de la autorización
              </label>
              <textarea
                rows={2} value={form.overrideNote}
                onChange={(e) => setForm({ ...form, overrideNote: e.target.value })}
                placeholder="Motivo por el que se autoriza superar las 12 h esta semana"
                className="w-full resize-none rounded-lg border border-amber-500/30 bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#1E1E1E] px-5 py-4">
          <button onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[#888] transition-colors hover:text-white">
            Cancelar
          </button>
          <button onClick={submit} disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[#FF6B2B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
