/**
 * ActivityModal.tsx — Agregar o editar una actividad del día
 *
 * Sustituye a los dos modales anteriores (registro diario y participación):
 * ahora es una sola cosa. Enganchar la actividad a algo del nodo es
 * opcional; si no se engancha, la descripción es lo que la identifica.
 *
 * La fecha NO se pide aquí: la actividad ya sabe de qué día cuelga.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, Link2, Check } from 'lucide-react';
import { auxiliaryService } from '@/services/auxiliary.service';
import { apiErrorMessage } from '@/utils/apiError';
import type { AuxiliaryActivity } from '@/types';

interface Props {
  dayId:     string;
  dayLabel:  string;
  activity:  AuxiliaryActivity | null;   // null = nueva
  onClose:   () => void;
}

type Enganche = 'ninguno' | 'actividad' | 'proceso';

export default function ActivityModal({ dayId, dayLabel, activity, onClose }: Props) {
  const qc = useQueryClient();
  const isNew = !activity;

  const [description, setDescription] = useState(activity?.description ?? '');
  const [hours, setHours]             = useState<string>(
    activity?.hours !== null && activity?.hours !== undefined ? String(activity.hours) : '',
  );
  const [functionIds, setFunctionIds] = useState<string[]>(
    activity?.functions.map((f) => f.id) ?? [],
  );
  const [typeIds, setTypeIds] = useState<string[]>(
    activity?.types.map((t) => t.id) ?? [],
  );
  const [enganche, setEnganche] = useState<Enganche>(
    activity?.activityId ? 'actividad' : activity?.processId ? 'proceso' : 'ninguno',
  );
  const [origenId, setOrigenId] = useState<string>(
    activity?.activityId ?? activity?.processId ?? '',
  );
  const [error, setError] = useState('');

  const { data: functions } = useQuery({
    queryKey: ['aux-functions'],
    queryFn:  auxiliaryService.listFunctions,
  });
  const { data: types } = useQuery({
    queryKey: ['aux-types'],
    queryFn:  auxiliaryService.listParticipationTypes,
  });
  // Solo se consulta si de verdad se va a enganchar algo
  const { data: linkable, isLoading: cargandoEnganches } = useQuery({
    queryKey: ['aux-linkable'],
    queryFn:  auxiliaryService.listLinkable,
    enabled:  enganche !== 'ninguno',
  });

  useEffect(() => {
    if (enganche === 'ninguno') setOrigenId('');
  }, [enganche]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        description: description.trim(),
        hours: hours.trim() === '' ? undefined : Number(hours),
        functionIds,
        typeIds,
        ...(enganche === 'actividad' && origenId ? { activityId: origenId } : {}),
        ...(enganche === 'proceso'   && origenId ? { processId:  origenId } : {}),
      };
      return isNew
        ? auxiliaryService.addActivity(dayId, payload)
        // El enganche no se cambia al editar: se borra y se crea de nuevo
        : auxiliaryService.updateActivity(activity!.id, {
            description: payload.description,
            hours:       payload.hours,
            functionIds,
            typeIds,
          });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auxiliary-days'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = () => {
    setError('');
    if (!description.trim()) return setError('Describe qué hiciste.');
    if (functionIds.length === 0) return setError('Marca al menos una función.');
    if (hours.trim() !== '') {
      const n = Number(hours);
      if (Number.isNaN(n) || n < 0 || n > 24) return setError('Las horas deben ir entre 0 y 24.');
    }
    if (enganche !== 'ninguno' && !origenId) {
      return setError('Elige a qué se engancha, o cambia a "Sin enganchar".');
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">
              {isNew ? 'Nueva actividad' : 'Editar actividad'}
            </h3>
            <p className="mt-0.5 text-xs text-[#666]">{dayLabel}</p>
          </div>
          <button onClick={onClose} className="p-1 text-[#555] transition-colors hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {/* ── Qué hizo ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              ¿Qué hiciste? <span className="text-[#FF6B2B]">*</span>
            </label>
            <textarea
              rows={3} maxLength={2000} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Acompañamiento a usuarios en sala y registro de asistencia"
              className="w-full resize-none rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            />
          </div>

          {/* ── Horas ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              Horas <span className="text-[#555]">(opcional)</span>
            </label>
            <input
              type="number" min={0} max={24} step={0.5} value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Sin registrar"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B] sm:w-40"
            />
            <p className="mt-1 text-xs text-[#555]">
              Dejarlo vacío no es lo mismo que poner 0: significa que no se registró.
            </p>
          </div>

          {/* ── Funciones (N a N) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              Funciones que desempeñaste <span className="text-[#FF6B2B]">*</span>
              <span className="ml-1 text-[#555]">(puedes marcar varias)</span>
            </label>
            <div className="space-y-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] p-2">
              {(functions ?? []).map((f) => (
                <Chip key={f.id} label={f.name}
                  active={functionIds.includes(f.id)}
                  onClick={() => toggle(functionIds, setFunctionIds, f.id)} />
              ))}
            </div>
          </div>

          {/* ── Enganche ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              ¿Aporta a una actividad del nodo?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['ninguno',   'Sin enganchar'],
                ['actividad', 'A una actividad'],
                ['proceso',   'A un proceso'],
              ] as [Enganche, string][]).map(([valor, texto]) => (
                <button key={valor} type="button"
                  onClick={() => setEnganche(valor)}
                  disabled={!isNew}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    enganche === valor
                      ? 'border-[#FF6B2B] bg-[#FF6B2B]/10 text-[#FF6B2B]'
                      : 'border-[#2A2A2A] text-[#888] hover:text-white'
                  }`}>
                  {texto}
                </button>
              ))}
            </div>

            {!isNew && (
              <p className="mt-1.5 text-xs text-[#555]">
                El enganche no se cambia al editar. Si te equivocaste, borra la
                actividad y créala de nuevo.
              </p>
            )}

            {isNew && enganche !== 'ninguno' && (
              <div className="mt-2">
                {cargandoEnganches ? (
                  <div className="flex items-center gap-2 text-xs text-[#666]">
                    <Loader2 size={13} className="animate-spin" /> Cargando…
                  </div>
                ) : (
                  <select value={origenId} onChange={(e) => setOrigenId(e.target.value)}
                    className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]">
                    <option value="">Elige una opción…</option>
                    {enganche === 'actividad'
                      ? (linkable?.activities ?? []).map((a) => (
                          <option key={a.id} value={a.id}>{a.title}</option>
                        ))
                      : (linkable?.processes ?? []).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                  </select>
                )}
                {!cargandoEnganches &&
                  (enganche === 'actividad'
                    ? linkable?.activities.length === 0
                    : linkable?.processes.length === 0) && (
                  <p className="mt-1 text-xs text-[#666]">
                    Tu nodo no tiene {enganche === 'actividad' ? 'actividades' : 'procesos'} registrados todavía.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Tipos de participación ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              Tipo de participación <span className="text-[#555]">(opcional)</span>
            </label>
            <div className="space-y-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] p-2">
              {(types ?? []).map((t) => (
                <Chip key={t.id} label={t.name}
                  active={typeIds.includes(t.id)}
                  onClick={() => toggle(typeIds, setTypeIds, t.id)} />
              ))}
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
            {isNew ? 'Agregar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Casilla de selección múltiple, con el estilo de las tarjetas del sistema. */
function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
        active ? 'bg-[#FF6B2B]/10 text-[#FF6B2B]' : 'text-[#888] hover:bg-[#1A1A1A] hover:text-white'
      }`}>
      <span className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
        active ? 'border-[#FF6B2B] bg-[#FF6B2B]' : 'border-[#3A3A3A]'
      }`}>
        {active && <Check size={10} className="text-white" />}
      </span>
      <span className="leading-snug">{label}</span>
      {active && <Link2 size={11} className="ml-auto mt-0.5 flex-shrink-0 opacity-0" />}
    </button>
  );
}
