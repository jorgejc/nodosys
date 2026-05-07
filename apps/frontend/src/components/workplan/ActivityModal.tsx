/**
 * ActivityModal.tsx — Modal de detalle/edición de actividad
 *
 * Este modal muestra y permite editar todos los campos de la Hoja 2
 * del Plan de Trabajo (DO-F-002). Diseño en pestañas para no abrumar.
 *
 * Pestaña 1 → Planificación (Hoja 1: nombre, horas, curso...)
 * Pestaña 2 → Seguimiento  (Hoja 2: dimensiones, estado, fechas...)
 * Pestaña 3 → Evidencias   (soporte, URL, observaciones)
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Save, Trash2, ExternalLink, CheckCircle2,
  Clock, AlertCircle, Loader2,
} from 'lucide-react';
import { workPlanService } from '@/services/workplan.service';
import type { AxisActivity, AxisType } from '@/types';
import { AXIS_LABELS } from '@/types';

// ── Helpers de UI ─────────────────────────────────────────
const statusConfig = {
  pendiente:  { label: 'Pendiente',  icon: AlertCircle, color: 'text-[#666]',     bg: 'bg-[#1A1A1A]', border: 'border-[#333]' },
  en_proceso: { label: 'En proceso', icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  finalizada: { label: 'Finalizada', icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30' },
};

interface Props {
  activity: AxisActivity | null;
  axisType: AxisType;
  axisId: string;
  planId: string;
  isNew?: boolean;
  onClose: () => void;
}

type TabId = 'plan' | 'seguimiento' | 'evidencias';

export default function ActivityModal({ activity, axisType, axisId, planId, isNew = false, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('plan');
  const [form, setForm] = useState({
    name: '', plannedHours: 0, executedHours: 0,
    courseCode: '', groupCode: '', numStudents: '', level: '',
    courseType: '', weeks: '', hoursPerWeek: '',
    thesisModality: '', studentName: '',
    specificDescription: '',
    dimInclusion: false, dimTerritorial: false, dimHuman: false,
    dimensionJustification: '',
    activityStatus: 'pendiente',
    startDate: '', endDate: '',
    evidenceType: '', evidenceUrl: '',
    teacherObservations: '', deanObservations: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (activity) {
      setForm({
        name: activity.name ?? '',
        plannedHours: activity.plannedHours ?? 0,
        executedHours: activity.executedHours ?? 0,
        courseCode: activity.courseCode ?? '',
        groupCode: activity.groupCode ?? '',
        numStudents: activity.numStudents?.toString() ?? '',
        level: activity.level ?? '',
        courseType: activity.courseType ?? '',
        weeks: activity.weeks?.toString() ?? '',
        hoursPerWeek: activity.hoursPerWeek?.toString() ?? '',
        thesisModality: activity.thesisModality ?? '',
        studentName: activity.studentName ?? '',
        specificDescription: activity.specificDescription ?? '',
        dimInclusion: activity.dimInclusion ?? false,
        dimTerritorial: activity.dimTerritorial ?? false,
        dimHuman: activity.dimHuman ?? false,
        dimensionJustification: activity.dimensionJustification ?? '',
        activityStatus: activity.activityStatus ?? 'pendiente',
        startDate: activity.startDate ? activity.startDate.split('T')[0] : '',
        endDate: activity.endDate ? activity.endDate.split('T')[0] : '',
        evidenceType: activity.evidenceType ?? '',
        evidenceUrl: activity.evidenceUrl ?? '',
        teacherObservations: activity.teacherObservations ?? '',
        deanObservations: activity.deanObservations ?? '',
      });
    }
  }, [activity]);

  // Calcular horas automáticamente para docencia directa
  const calculatedHours = form.weeks && form.hoursPerWeek
    ? parseInt(form.weeks) * parseFloat(form.hoursPerWeek)
    : null;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        plannedHours: (calculatedHours ?? parseFloat(form.plannedHours.toString())) || 0,
        executedHours: form.executedHours.toString(),
        specificDescription: form.specificDescription || null,
        dimInclusion: form.dimInclusion,
        dimTerritorial: form.dimTerritorial,
        dimHuman: form.dimHuman,
        dimensionJustification: form.dimensionJustification || null,
        activityStatus: form.activityStatus,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        evidenceType: form.evidenceType || null,
        evidenceUrl: form.evidenceUrl || null,
        teacherObservations: form.teacherObservations || null,
        deanObservations: form.deanObservations || null,
      };

      if (axisType === 'docencia_directa') {
        Object.assign(payload, {
          courseCode: form.courseCode || null,
          groupCode: form.groupCode || null,
          numStudents: form.numStudents ? parseInt(form.numStudents) : null,
          level: form.level || null,
          courseType: form.courseType || null,
          weeks: form.weeks ? parseInt(form.weeks) : null,
          hoursPerWeek: form.hoursPerWeek ? parseFloat(form.hoursPerWeek) : null,
        });
      }
      if (axisType === 'trabajos_de_grado') {
        Object.assign(payload, {
          thesisModality: form.thesisModality || null,
          studentName: form.studentName || null,
          weeks: form.weeks ? parseInt(form.weeks) : null,
          hoursPerWeek: form.hoursPerWeek ? parseFloat(form.hoursPerWeek) : null,
        });
      }

      if (isNew || !activity) {
        return workPlanService.createActivity(axisId, payload);
      }
      return workPlanService.updateActivity(activity.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workplan', planId] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Error al guardar'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => workPlanService.deleteActivity(activity!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workplan', planId] });
      onClose();
    },
  });

  const tabs: { id: TabId; label: string; dot?: boolean }[] = [
    { id: 'plan', label: '1. Planificación' },
    { id: 'seguimiento', label: '2. Seguimiento', dot: form.dimInclusion || form.dimTerritorial || form.dimHuman },
    { id: 'evidencias', label: '3. Evidencias', dot: !!form.evidenceUrl },
  ];

  const F = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-xs font-mono text-[#555] uppercase tracking-widest mb-0.5">
              {AXIS_LABELS[axisType]}
            </div>
            <h2 className="text-white font-semibold text-sm truncate max-w-md">
              {isNew ? 'Nueva actividad' : (form.name || 'Editar actividad')}
            </h2>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white p-1 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Status badge */}
        {!isNew && (
          <div className="px-6 pt-3 flex items-center gap-2 flex-shrink-0">
            {Object.entries(statusConfig).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const active = form.activityStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => F('activityStatus', key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-all ${
                    active ? `${cfg.color} ${cfg.bg} ${cfg.border}` : 'text-[#555] border-transparent hover:border-[#333]'
                  }`}
                >
                  <Icon size={11} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 flex gap-0 border-b border-[#1E1E1E] flex-shrink-0 mt-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-[#FF6B2B] text-[#FF6B2B]'
                  : 'border-transparent text-[#666] hover:text-white'
              }`}
            >
              {t.label}
              {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B2B]" />}
            </button>
          ))}
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* ── PESTAÑA 1: PLANIFICACIÓN ─────────────────── */}
          {tab === 'plan' && (
            <div className="space-y-4">
              <Field label="Nombre de la actividad *">
                <input
                  value={form.name}
                  onChange={e => F('name', e.target.value)}
                  placeholder="Ej: Implementación de Métricas para la Calidad de Software"
                  className={input}
                />
              </Field>

              {/* Docencia directa */}
              {axisType === 'docencia_directa' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Código de grupo">
                      <input value={form.courseCode} onChange={e => F('courseCode', e.target.value)}
                        placeholder="PREICA2502B010017" className={input} />
                    </Field>
                    <Field label="N° Estudiantes">
                      <input type="number" value={form.numStudents} onChange={e => F('numStudents', e.target.value)}
                        placeholder="35" className={input} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nivel">
                      <select value={form.level} onChange={e => F('level', e.target.value)} className={input}>
                        <option value="">Seleccionar...</option>
                        {[['pregrado','Pregrado'],['posgrado','Posgrado'],['tecnico','Técnico'],['tecnologia','Tecnología']].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tipo de asignatura">
                      <select value={form.courseType} onChange={e => F('courseType', e.target.value)} className={input}>
                        <option value="">Seleccionar...</option>
                        {[['teorico','Teórico'],['teorico_practica','Teórico-práctica'],['practica','Práctica'],['laboratorio','Laboratorio']].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="N° Semanas">
                      <input type="number" value={form.weeks} onChange={e => F('weeks', e.target.value)}
                        placeholder="9" className={input} />
                    </Field>
                    <Field label="Horas/semana">
                      <input type="number" value={form.hoursPerWeek} onChange={e => F('hoursPerWeek', e.target.value)}
                        placeholder="4" className={input} />
                    </Field>
                  </div>
                  {calculatedHours !== null && (
                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/5 border border-green-400/20 rounded-lg px-3 py-2">
                      <CheckCircle2 size={12} />
                      Total horas semestre: <strong>{calculatedHours} horas</strong>
                    </div>
                  )}
                </>
              )}

              {/* Trabajos de grado */}
              {axisType === 'trabajos_de_grado' && (
                <>
                  <Field label="Modalidad">
                    <input value={form.thesisModality} onChange={e => F('thesisModality', e.target.value)}
                      placeholder="Asesoría de prácticas / Proyecto de grado..." className={input} />
                  </Field>
                  <Field label="Nombre del estudiante">
                    <input value={form.studentName} onChange={e => F('studentName', e.target.value)}
                      placeholder="Juan Pérez García" className={input} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="N° Semanas">
                      <input type="number" value={form.weeks} onChange={e => F('weeks', e.target.value)} className={input} />
                    </Field>
                    <Field label="Horas/semana">
                      <input type="number" value={form.hoursPerWeek} onChange={e => F('hoursPerWeek', e.target.value)} className={input} />
                    </Field>
                  </div>
                  {calculatedHours !== null && (
                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/5 border border-green-400/20 rounded-lg px-3 py-2">
                      <CheckCircle2 size={12} />
                      Total horas: <strong>{calculatedHours} horas</strong>
                    </div>
                  )}
                </>
              )}

              {/* Otros ejes: solo horas */}
              {!['docencia_directa','trabajos_de_grado'].includes(axisType) && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Horas planeadas">
                    <input type="number" value={form.plannedHours} onChange={e => F('plannedHours', e.target.value)} className={input} />
                  </Field>
                  <Field label="Horas ejecutadas">
                    <input type="number" value={form.executedHours} onChange={e => F('executedHours', e.target.value)} className={input} />
                  </Field>
                </div>
              )}

              {/* Estado (solo si es nuevo) */}
              {isNew && (
                <Field label="Estado inicial">
                  <select value={form.activityStatus} onChange={e => F('activityStatus', e.target.value)} className={input}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="finalizada">Finalizada</option>
                  </select>
                </Field>
              )}
            </div>
          )}

          {/* ── PESTAÑA 2: SEGUIMIENTO ───────────────────── */}
          {tab === 'seguimiento' && (
            <div className="space-y-4">
              <Field label="Descripción de la relación entre el eje misional y esta actividad">
                <textarea
                  value={form.specificDescription}
                  onChange={e => F('specificDescription', e.target.value)}
                  rows={3}
                  placeholder="Explica cómo esta actividad se relaciona con el eje misional..."
                  className={`${input} resize-none`}
                />
              </Field>

              {/* Dimensiones de la Digitalidad Próxima */}
              <div>
                <label className={label}>Dimensiones de la Digitalidad Próxima (marque las que aplican)</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[
                    { key: 'dimInclusion', label: 'Inclusión', icon: '🤝' },
                    { key: 'dimTerritorial', label: 'Enfoque Territorial', icon: '🗺️' },
                    { key: 'dimHuman', label: 'Sentido Humano', icon: '💡' },
                  ].map(({ key, label: lbl, icon }) => {
                    const val = form[key as keyof typeof form] as boolean;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => F(key, !val)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                          val
                            ? 'bg-[#FF6B2B]/10 border-[#FF6B2B]/40 text-[#FF6B2B]'
                            : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#666] hover:border-[#444]'
                        }`}
                      >
                        <span className="text-xl">{icon}</span>
                        <span>{lbl}</span>
                        {val && <span className="text-[10px]">✓ Marcada</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(form.dimInclusion || form.dimTerritorial || form.dimHuman) && (
                <Field label="Justificación de las dimensiones marcadas">
                  <textarea
                    value={form.dimensionJustification}
                    onChange={e => F('dimensionJustification', e.target.value)}
                    rows={4}
                    placeholder="Explica cómo esta actividad aporta a las dimensiones marcadas..."
                    className={`${input} resize-none`}
                  />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha inicio">
                  <input type="date" value={form.startDate} onChange={e => F('startDate', e.target.value)} className={input} />
                </Field>
                <Field label="Fecha fin">
                  <input type="date" value={form.endDate} onChange={e => F('endDate', e.target.value)} className={input} />
                </Field>
              </div>

              {/* Horas ejecutadas para ejes calculables */}
              {['docencia_directa','trabajos_de_grado'].includes(axisType) && (
                <Field label="Horas ejecutadas">
                  <input
                    type="number" min={0}
                    value={form.executedHours}
                    onChange={e => F('executedHours', e.target.value)}
                    className={input}
                    placeholder="0"
                  />
                </Field>
              )}
            </div>
          )}

          {/* ── PESTAÑA 3: EVIDENCIAS ────────────────────── */}
          {tab === 'evidencias' && (
            <div className="space-y-4">
              <Field label="Tipo de entregable / soporte">
                <select value={form.evidenceType} onChange={e => F('evidenceType', e.target.value)} className={input}>
                  <option value="">Seleccionar...</option>
                  {[['documento','Documento'],['informe','Informe'],['presentacion','Presentación'],['video','Video'],['otro','Otro']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>

              <Field label="Enlace de soportes (URL Google Drive u otro)">
                <div className="relative">
                  <input
                    type="url"
                    value={form.evidenceUrl}
                    onChange={e => F('evidenceUrl', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${input} pr-10`}
                  />
                  {form.evidenceUrl && (
                    <a href={form.evidenceUrl} target="_blank" rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FF6B2B] hover:text-white transition-colors">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </Field>

              <Field label="Observaciones del docente">
                <textarea
                  value={form.teacherObservations}
                  onChange={e => F('teacherObservations', e.target.value)}
                  rows={3} className={`${input} resize-none`}
                  placeholder="Observaciones o comentarios propios..."
                />
              </Field>

              <Field label="Observaciones del decano">
                <textarea
                  value={form.deanObservations}
                  onChange={e => F('deanObservations', e.target.value)}
                  rows={3} className={`${input} resize-none`}
                  placeholder="Campo para que el decano registre sus observaciones..."
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer acciones */}
        <div className="px-6 py-4 border-t border-[#1E1E1E] flex items-center justify-between flex-shrink-0">
          <div>
            {!isNew && activity && (
              <button
                onClick={() => { if (confirm('¿Eliminar esta actividad?')) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={13} />
                Eliminar
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-[#666] hover:text-white transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name}
              className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isNew ? 'Crear actividad' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────
const input = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors";
const label = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";
function Field({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={label}>{lbl}</label>
      {children}
    </div>
  );
}
