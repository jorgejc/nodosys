/**
 * WeekModal.tsx — Crear o editar una semana del plan
 *
 * La semana es ahora una entidad propia: número + rango de fechas. Se crea
 * una vez y luego las tareas se agregan a ella sin volver a escribir el
 * nombre.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, CalendarRange } from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { apiErrorMessage } from '@/utils/apiError';
import type { MonitorWeek } from '@/types';

interface Props {
  planId:     string;
  week:       MonitorWeek | null;   // null = nueva
  suggestNum: number;               // número sugerido para una semana nueva
  onClose:    () => void;
}

export default function WeekModal({ planId, week, suggestNum, onClose }: Props) {
  const qc = useQueryClient();
  const isNew = !week;

  const [form, setForm] = useState({
    weekNumber: week?.weekNumber ?? suggestNum,
    startDate:  week?.startDate ?? '',
    endDate:    week?.endDate ?? '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (week) {
      setForm({
        weekNumber: week.weekNumber,
        startDate:  week.startDate ?? '',
        endDate:    week.endDate ?? '',
      });
    }
  }, [week]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        weekNumber: form.weekNumber,
        startDate:  form.startDate,
        endDate:    form.endDate,
      };
      return isNew
        ? monitorsService.createWeek(planId, payload)
        : monitorsService.updateWeek(week!.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitor-plan'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = () => {
    setError('');
    if (!form.weekNumber || form.weekNumber < 1) return setError('Indica el número de semana.');
    if (!form.startDate) return setError('Elige la fecha de inicio.');
    if (!form.endDate)   return setError('Elige la fecha de fin.');
    if (form.endDate < form.startDate) return setError('La fecha de fin no puede ser anterior a la de inicio.');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarRange size={15} className="text-[#FF6B2B]" />
            {isNew ? 'Nueva semana' : `Editar semana ${week!.weekNumber}`}
          </h3>
          <button onClick={onClose} className="p-1 text-[#555] transition-colors hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">Número de semana</label>
            <input
              type="number" min={1} max={60} value={form.weekNumber}
              onChange={(e) => setForm({ ...form, weekNumber: Number(e.target.value) })}
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#FF6B2B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Fecha de inicio</label>
              <input
                type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#FF6B2B] [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Fecha de fin</label>
              <input
                type="date" value={form.endDate} min={form.startDate || undefined}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#FF6B2B] [color-scheme:dark]"
              />
            </div>
          </div>

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
            {isNew ? 'Crear semana' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
