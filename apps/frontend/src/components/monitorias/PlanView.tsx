/**
 * PlanView.tsx — Plan de trabajo de una monitora, semana por semana
 *
 * Lo comparten la vista de la monitora y la del enlace. Lo que cambia entre
 * ambas es quién puede editar y quién puede autorizar semanas por encima del
 * tope, así que eso llega por props.
 *
 * Diseño: cada semana es una tarjeta con encabezado (Semana N · fechas) y una
 * barra de progreso de horas hacia el tope de 12 h (verde → ámbar → rojo).
 * Dentro, las tareas como filas limpias, con sus evidencias como chips.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, AlertTriangle, ExternalLink, FileSpreadsheet,
  Loader2, Paperclip, CalendarPlus, Pencil, CalendarRange, ClipboardList,
} from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { apiErrorMessage } from '@/utils/apiError';
import { MAX_WEEKLY_HOURS } from '@/types';
import type { MonitorWorkPlan, MonitorWeek, MonitorWeekActivity } from '@/types';
import WeekModal from './WeekModal';
import ActivityModal from './ActivityModal';
import EvidenceModal from './EvidenceModal';

interface Props {
  plan:        MonitorWorkPlan;
  canEdit:     boolean;
  canOverride: boolean;
}

// ── Helpers de presentación ─────────────────────────────────
const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

function dateRange(start: string | null, end: string | null): string {
  if (start && end) return `${fmtDay(start)} – ${fmtDay(end)}`;
  if (start || end) return fmtDay((start || end)!);
  return 'Sin fechas';
}

/** Color del indicador de horas: verde bajo tope, ámbar al acercarse, rojo si excede. */
function hoursColor(hours: number): string {
  if (hours > MAX_WEEKLY_HOURS) return '#F87171'; // rojo
  if (hours >= 10)              return '#FBBF24'; // ámbar
  return '#4ADE80';                                // verde
}

export default function PlanView({ plan, canEdit, canOverride }: Props) {
  const qc = useQueryClient();
  const [weekModal, setWeekModal] = useState<{ week: MonitorWeek | null } | null>(null);
  const [activityModal, setActivityModal] = useState<
    { weekId: string; weekNumber: number; otherHours: number; activity: MonitorWeekActivity | null } | null
  >(null);
  const [evidenceModal, setEvidenceModal] = useState<{ activityId: string; label: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['monitor-plan'] });
  const onError = (e: unknown) => setError(apiErrorMessage(e));

  const deleteActivity = useMutation({ mutationFn: monitorsService.deleteActivity, onSuccess: invalidate, onError });
  const deleteEvidence = useMutation({ mutationFn: monitorsService.deleteEvidence, onSuccess: invalidate, onError });
  const deleteWeek     = useMutation({ mutationFn: monitorsService.deleteWeek,     onSuccess: invalidate, onError });

  const totalTasks = plan.weeks.reduce((s, w) => s + w.activityCount, 0);
  const nextWeekNumber = plan.weeks.length
    ? Math.max(...plan.weeks.map((w) => w.weekNumber)) + 1
    : 1;

  const downloadExcel = async () => {
    setError('');
    setDownloading(true);
    try {
      await monitorsService.downloadPlanExcel(plan.id, plan.monitor?.name);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Dashboard del plan ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Horas acumuladas" value={plan.totalHours} accent big />
        <StatCard label="Semanas"          value={plan.weeks.length} />
        <StatCard label="Tareas"           value={totalTasks} />
        <StatCard label="Vigencia"         value={plan.vigencia} mono />
      </div>

      {/* ── Acciones ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={downloadExcel} disabled={downloading}
          className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3.5 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50">
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
          {downloading ? 'Generando…' : 'Exportar plan (Excel)'}
        </button>

        {canEdit && (
          <button onClick={() => setWeekModal({ week: null })}
            className="ml-auto flex items-center gap-2 rounded-lg bg-[#FF6B2B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            <CalendarPlus size={14} /> Agregar semana
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ── Semanas ── */}
      {plan.weeks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2A2A2A] bg-[#0D0D0D] py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#141414] border border-[#2A2A2A]">
            <CalendarRange size={22} className="text-[#444]" />
          </div>
          <p className="text-sm text-[#888]">Todavía no hay semanas en este plan.</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-[#555]">
            Crea la primera semana con su rango de fechas y empieza a registrar las tareas.
          </p>
          {canEdit && (
            <button onClick={() => setWeekModal({ week: null })}
              className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-[#FF6B2B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              <CalendarPlus size={14} /> Crear primera semana
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {plan.weeks.map((week) => {
            const color = hoursColor(week.hours);
            const pct   = Math.min(week.hours / MAX_WEEKLY_HOURS, 1) * 100;

            return (
              <section key={week.id}
                className={`overflow-hidden rounded-2xl border bg-[#0D0D0D] transition-colors ${
                  week.exceedsCap ? 'border-amber-500/40' : 'border-[#1E1E1E] hover:border-[#2A2A2A]'
                }`}>
                {/* Encabezado */}
                <div className="px-4 pt-4 pb-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#FF6B2B]/20 bg-[#FF6B2B]/10 font-mono text-sm font-bold text-[#FF6B2B]">
                      {week.weekNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">Semana {week.weekNumber}</div>
                      <div className="flex items-center gap-1.5 text-xs text-[#666]">
                        <CalendarRange size={11} /> {dateRange(week.startDate, week.endDate)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold" style={{ color }}>
                        {week.hours}
                        <span className="text-[#555]"> / {MAX_WEEKLY_HOURS} h</span>
                      </div>
                      <div className="text-[11px] text-[#555]">
                        {week.activityCount} tarea{week.activityCount !== 1 ? 's' : ''}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button onClick={() => setActivityModal({ weekId: week.id, weekNumber: week.weekNumber, otherHours: week.hours, activity: null })}
                          className="flex items-center gap-1 rounded-md border border-[#2A2A2A] px-2.5 py-1.5 text-xs font-medium text-[#888] transition-colors hover:border-[#FF6B2B]/40 hover:text-[#FF6B2B]"
                          title="Agregar tarea a esta semana">
                          <Plus size={13} /> Tarea
                        </button>
                        <button onClick={() => setWeekModal({ week })}
                          className="rounded-md border border-[#2A2A2A] p-1.5 text-[#666] transition-colors hover:border-[#444] hover:text-white"
                          title="Editar semana">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteWeek.mutate(week.id)}
                          className="rounded-md border border-[#2A2A2A] p-1.5 text-[#666] transition-colors hover:border-red-500/40 hover:text-red-400"
                          title="Eliminar semana">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Barra de progreso hacia el tope */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#1A1A1A]">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>

                {/* Aviso de tope superado */}
                {week.exceedsCap && (
                  <div className="flex items-start gap-2 border-t border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-300 sm:px-5">
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                    <span>
                      Supera el tope de {MAX_WEEKLY_HOURS} h.
                      {week.activities.some((a) => a.overrideNote)
                        ? ' Autorizada por el enlace.'
                        : ' Requiere autorización del enlace.'}
                    </span>
                  </div>
                )}

                {/* Tareas */}
                {week.activities.length === 0 ? (
                  <div className="border-t border-[#1E1E1E] px-4 py-8 text-center sm:px-5">
                    <p className="text-sm text-[#666]">Esta semana aún no tiene tareas.</p>
                    {canEdit && (
                      <button onClick={() => setActivityModal({ weekId: week.id, weekNumber: week.weekNumber, otherHours: 0, activity: null })}
                        className="mt-2 text-sm font-medium text-[#FF6B2B] transition-opacity hover:opacity-80">
                        + Agregar la primera tarea
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-[#151515] border-t border-[#1E1E1E]">
                    {week.activities.map((act) => (
                      <div key={act.id} className="group px-4 py-3 transition-colors hover:bg-[#101010] sm:px-5">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#DDD]">
                              {act.description}
                            </p>
                            {act.overrideNote && (
                              <p className="mt-1.5 text-xs italic text-amber-400/80">
                                Autorización: {act.overrideNote}
                              </p>
                            )}

                            {/* Evidencias de la tarea */}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {act.evidences.map((ev) => (
                                <span key={ev.id}
                                  className="group/ev inline-flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#141414] px-2 py-1 text-xs text-[#38BDF8] transition-colors hover:border-[#38BDF8]/40">
                                  <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer"
                                     className="inline-flex items-center gap-1.5 hover:underline">
                                    <Paperclip size={11} />
                                    {ev.caption || 'Evidencia'}
                                  </a>
                                  {canEdit && (
                                    <button onClick={() => deleteEvidence.mutate(ev.id)}
                                      className="text-[#555] opacity-0 transition-opacity hover:text-red-400 group-hover/ev:opacity-100"
                                      title="Eliminar evidencia">
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {canEdit && (
                                <button onClick={() => setEvidenceModal({ activityId: act.id, label: act.description })}
                                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#2A2A2A] px-2 py-1 text-xs text-[#666] transition-colors hover:border-[#38BDF8]/40 hover:text-[#38BDF8]">
                                  <Plus size={11} /> Evidencia
                                </button>
                              )}
                            </div>
                          </div>

                          <span className="mt-0.5 flex-shrink-0 font-mono text-sm font-medium text-[#FF6B2B]">
                            {act.hours} h
                          </span>

                          {canEdit && (
                            <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => setActivityModal({ weekId: week.id, weekNumber: week.weekNumber, otherHours: Math.round((week.hours - act.hours) * 10) / 10, activity: act })}
                                className="p-1 text-[#555] transition-colors hover:text-white" title="Editar tarea">
                                <ExternalLink size={13} />
                              </button>
                              <button onClick={() => deleteActivity.mutate(act.id)}
                                className="p-1 text-[#555] transition-colors hover:text-red-400" title="Eliminar tarea">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Evidencias viejas sin tarea (compatibilidad) ── */}
      {plan.looseEvidences.length > 0 && (
        <div className="rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#666]">
            <ClipboardList size={13} /> Evidencias generales (sin tarea)
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.looseEvidences.map((ev) => (
              <span key={ev.id}
                className="group/ev inline-flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#141414] px-2.5 py-1 text-xs text-[#38BDF8]">
                <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 hover:underline">
                  <Paperclip size={11} /> {ev.caption || 'Evidencia'}
                </a>
                {canEdit && (
                  <button onClick={() => deleteEvidence.mutate(ev.id)}
                    className="text-[#555] opacity-0 transition-opacity hover:text-red-400 group-hover/ev:opacity-100">
                    <Trash2 size={11} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      {weekModal && (
        <WeekModal
          planId={plan.id}
          week={weekModal.week}
          suggestNum={nextWeekNumber}
          onClose={() => setWeekModal(null)}
        />
      )}

      {activityModal && (
        <ActivityModal
          planId={plan.id}
          weekId={activityModal.weekId}
          weekNumber={activityModal.weekNumber}
          activity={activityModal.activity}
          otherHours={activityModal.otherHours}
          canOverride={canOverride}
          onClose={() => setActivityModal(null)}
        />
      )}

      {evidenceModal && (
        <EvidenceModal
          planId={plan.id}
          activityId={evidenceModal.activityId}
          activityLabel={evidenceModal.label}
          onClose={() => setEvidenceModal(null)}
        />
      )}
    </div>
  );
}

// ── Tarjeta del mini-dashboard ──────────────────────────────
function StatCard({
  label, value, accent, big, mono,
}: { label: string; value: string | number; accent?: boolean; big?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[#666]">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-2xl' : 'text-xl'} ${accent ? 'text-[#FF6B2B]' : 'text-white'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}
