/**
 * WorkPlanDetailPage.tsx — Detalle del plan de trabajo
 *
 * Vista principal que reproduce la estructura del DO-F-002:
 *  ┌─ Header del plan (semestre, horas totales, % avance)
 *  ├─ Barra de progreso general
 *  └─ Acordeón de ejes misionales
 *     ├─ Docencia Directa ─── progreso + tabla de actividades
 *     ├─ Asesoría de Trabajos de Grado ──────────────────────
 *     └─ ...
 *
 * Al hacer clic en cualquier actividad → abre ActivityModal
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, ChevronDown, ChevronRight,
  Loader2, CheckCircle2, Clock, AlertCircle,
  ExternalLink, Download, FileText,
} from 'lucide-react';
import { workPlanService } from '@/services/workplan.service';
import { processesService } from '@/services/processes.service';
import ActivityModal from '@/components/workplan/ActivityModal';
import ExportMenu from '@/components/ui/ExportMenu';
import type { WorkPlan, WorkPlanAxis, AxisActivity, AxisType } from '@/types';
import { AXIS_LABELS, AXIS_ICONS } from '@/types';
import { exportConsolidatedPDF } from '@/utils/pdfProcess';

type LinkedProcess = { id: string; name: string; type: string; status: string };
type LinkedMap = Record<string, LinkedProcess[]>;

// ── Barra de progreso ─────────────────────────────────────
function ProgressBar({ value, max, color = '#FF6B2B' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-[#1A1A1A] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Badge de estado ───────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    pendiente:  { label: 'Pendiente',  cls: 'text-[#666] bg-[#1A1A1A] border-[#333]', Icon: AlertCircle },
    en_proceso: { label: 'En proceso', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', Icon: Clock },
    finalizada: { label: 'Finalizada', cls: 'text-green-400 bg-green-400/10 border-green-400/30', Icon: CheckCircle2 },
  };
  const s = map[status] ?? map['pendiente'];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${s.cls}`}>
      <s.Icon size={9} />
      {s.label}
    </span>
  );
}

// ── Fila de actividad ─────────────────────────────────────
function ActivityRow({
  activity, seqNum, onClick, linkedProcesses,
}: {
  activity: AxisActivity;
  seqNum: number;
  onClick: () => void;
  linkedProcesses: LinkedProcess[];
}) {
  const navigate = useNavigate();
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  const totalH = (activity.weeks && activity.hoursPerWeek)
    ? (activity.weeks * activity.hoursPerWeek)
    : (activity.plannedHours || 0);

  async function handlePDF(proc: LinkedProcess, idx: number, e: React.MouseEvent) {
    e.stopPropagation();
    setGeneratingIdx(idx);
    try {
      const report = await processesService.getReport(proc.id);
      await exportConsolidatedPDF(report);
    } catch (err) {
      console.error('Error generando bitácora:', err);
    } finally {
      setGeneratingIdx(null);
    }
  }

  const hasLinked = linkedProcesses.length > 0;

  return (
    <tr
      onClick={onClick}
      className="border-b border-[#1A1A1A] hover:bg-[#161616] cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3 text-xs text-[#555] font-mono">{seqNum}</td>
      <td className="px-4 py-3">
        <div className="text-sm text-white group-hover:text-[#FF6B2B] transition-colors">
          {activity.name}
        </div>
        {activity.courseCode && (
          <div className="text-xs text-[#555] font-mono mt-0.5">{activity.courseCode}</div>
        )}
        {activity.studentName && (
          <div className="text-xs text-[#666] mt-0.5">👤 {activity.studentName}</div>
        )}
        <div className="flex gap-1 mt-1">
          {activity.dimInclusion  && <span className="text-[10px] text-[#FF6B2B] bg-[#FF6B2B]/10 px-1.5 rounded">Inclusión</span>}
          {activity.dimTerritorial && <span className="text-[10px] text-blue-400 bg-blue-400/10 px-1.5 rounded">Territorial</span>}
          {activity.dimHuman       && <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1.5 rounded">Sentido H.</span>}
        </div>
        {/* Procesos vinculados */}
        {hasLinked && (
          <div className="mt-1.5" onClick={e => e.stopPropagation()}>
            {linkedProcesses.length === 1 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded font-mono">
                  {linkedProcesses[0].name.length > 28 ? linkedProcesses[0].name.slice(0, 28) + '…' : linkedProcesses[0].name}
                </span>
                <button
                  onClick={(e) => handlePDF(linkedProcesses[0], 0, e)}
                  disabled={generatingIdx === 0}
                  title="Descargar bitácora consolidada"
                  className="text-[#FF6B2B] hover:text-white transition-colors disabled:opacity-50"
                >
                  {generatingIdx === 0 ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/procesos/${linkedProcesses[0].id}`); }}
                  title="Ver proceso"
                  className="text-[#555] hover:text-white transition-colors"
                >
                  <FileText size={11} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowList(!showList); }}
                  className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded hover:bg-emerald-400/20 transition-colors"
                >
                  {linkedProcesses.length} procesos vinculados ▾
                </button>
                {showList && (
                  <div className="absolute left-0 top-full mt-1 z-20 bg-[#111] border border-[#2A2A2A] rounded-lg shadow-xl py-1 w-72">
                    {linkedProcesses.map((proc, idx) => (
                      <div key={proc.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#1A1A1A]">
                        <span className="text-xs text-white flex-1 truncate" title={proc.name}>{proc.name}</span>
                        <button
                          onClick={(e) => handlePDF(proc, idx, e)}
                          disabled={generatingIdx === idx}
                          title="Bitácora PDF"
                          className="text-[#FF6B2B] hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {generatingIdx === idx ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/procesos/${proc.id}`); }}
                          title="Ver proceso"
                          className="text-[#555] hover:text-white transition-colors flex-shrink-0"
                        >
                          <FileText size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-white font-mono text-right">{totalH || '—'}</td>
      <td className="px-4 py-3 text-xs text-green-400 font-mono text-right">
        {activity.executedHours || 0}
      </td>
      <td className="px-4 py-3"><StatusPill status={activity.activityStatus} /></td>
      <td className="px-4 py-3">
        {activity.evidenceUrl ? (
          <a
            href={activity.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[#FF6B2B] hover:text-white transition-colors"
          >
            <ExternalLink size={12} />
          </a>
        ) : (
          <span className="text-[#333]">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Acordeón de eje misional ──────────────────────────────
function AxisAccordion({
  axis, planId, planTotalHours, onAddActivity, onEditActivity, linkedMap,
}: {
  axis: WorkPlanAxis;
  planId: string;
  planTotalHours: number;
  onAddActivity: (axisId: string, axisType: AxisType) => void;
  onEditActivity: (activity: AxisActivity, axis: WorkPlanAxis) => void;
  linkedMap: LinkedMap;
}) {
  const [open, setOpen] = useState(false);
  const activities = axis.activities ?? [];
  const executedHours = activities.reduce((s, a) => s + (a.executedHours || 0), 0);
  const plannedHours = axis.plannedHours || 0;
  const plannedPct = planTotalHours > 0 ? (plannedHours / planTotalHours * 100).toFixed(1) : '0';
  const execPct = plannedHours > 0 ? (executedHours / plannedHours * 100).toFixed(1) : '0';
  const hasActivities = activities.length > 0;
  const icon = AXIS_ICONS[axis.axisType as AxisType];
  const label = AXIS_LABELS[axis.axisType as AxisType];

  return (
    <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
      {/* Cabecera del eje */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#161616] transition-colors text-left"
      >
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{label}</span>
            {hasActivities && (
              <span className="text-xs text-[#555] bg-[#1A1A1A] px-1.5 rounded font-mono">
                {activities.length} act.
              </span>
            )}
          </div>
          {/* Mini progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar
                value={executedHours}
                max={plannedHours}
                color={parseFloat(execPct) >= 80 ? '#4ade80' : parseFloat(execPct) >= 40 ? '#FFB830' : '#FF6B2B'}
              />
            </div>
            <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
              <span className="text-[#555]">{plannedHours}h plan ({plannedPct}%)</span>
              <span className="text-green-400">{executedHours}h ejec. ({execPct}%)</span>
            </div>
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-[#555] flex-shrink-0" /> : <ChevronRight size={16} className="text-[#555] flex-shrink-0" />}
      </button>

      {/* Contenido expandido */}
      {open && (
        <div className="border-t border-[#1E1E1E]">
          {activities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E]">
                    {['N°', 'Actividad', 'H. Plan', 'H. Ejec.', 'Estado', 'Soporte'].map(h => (
                      <th key={h} className="text-left text-xs font-mono text-[#555] uppercase px-4 py-2.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act, i) => (
                    <ActivityRow
                      key={act.id}
                      activity={act}
                      seqNum={i + 1}
                      onClick={() => onEditActivity(act, axis)}
                      linkedProcesses={linkedMap[act.id] ?? []}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-[#555] text-sm">
              Sin actividades registradas para este eje
            </div>
          )}

          {/* Botón agregar */}
          <div className="px-5 py-3 border-t border-[#1A1A1A]">
            <button
              onClick={() => onAddActivity(axis.id, axis.axisType as AxisType)}
              className="flex items-center gap-1.5 text-xs text-[#FF6B2B] hover:text-white transition-colors"
            >
              <Plus size={13} />
              Agregar actividad a {label}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function WorkPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modalState, setModalState] = useState<{
    open: boolean;
    activity: AxisActivity | null;
    axis: WorkPlanAxis | null;
    isNew: boolean;
  }>({ open: false, activity: null, axis: null, isNew: false });

  const planQuery = useQuery({
    queryKey: ['workplan', id],
    queryFn: () => workPlanService.getById(id!),
    enabled: !!id,
  });

  const linkedQ = useQuery({
    queryKey: ['workplan-linked', id],
    queryFn: () => workPlanService.getLinkedProcesses(id!),
    enabled: !!id,
  });

  const plan = planQuery.data as (WorkPlan & { summary: Record<string, string> }) | undefined;
  const linkedMap: LinkedMap = linkedQ.data ?? {};

  if (planQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  if (!plan) return null;

  const totalHours = Number(plan.totalHours);
  const executedHours = Number(plan.summary?.total_executed_hours ?? 0);
  const completionPct = Number(plan.summary?.overall_completion_percentage ?? 0);
  const axes = ((plan.axes ?? []) as (WorkPlanAxis & { displayOrder: number })[])
  .sort((a, b) => a.displayOrder - b.displayOrder);

  const openAdd = (axisId: string, axisType: AxisType) => {
    const axis = axes.find(a => a.id === axisId) ?? null;
    setModalState({ open: true, activity: null, axis, isNew: true });
  };
  const openEdit = (activity: AxisActivity, axis: WorkPlanAxis) => {
    setModalState({ open: true, activity, axis, isNew: false });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button onClick={() => navigate('/plan-trabajo')}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors">
        <ArrowLeft size={16} /> Mis planes de trabajo
      </button>

      {/* Plan header */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">
              Plan de Trabajo Profesoral · DO-F-002
            </p>
            <h1 className="text-xl font-bold text-white mb-1">{plan.semester} — {plan.year}</h1>
            {plan.faculty && <p className="text-sm text-[#666]">{plan.faculty}</p>}
            {plan.program && <p className="text-xs text-[#555]">{plan.program}</p>}
            {plan.resolutionNumber && (
              <p className="text-xs text-[#444] font-mono mt-1">Res. {plan.resolutionNumber}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <ExportMenu
              pdfUrl={`/reports/workplan/${id}/pdf`}
              excelUrl={`/reports/workplan/${id}/excel`}
              label="Exportar plan"
            />
            <div className="text-right">
              <div className="text-3xl font-black text-[#FF6B2B]">{completionPct}%</div>
              <div className="text-xs text-[#555] mt-0.5">completado</div>
            </div>
          </div>
        </div>

        {/* Barra de progreso grande */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-[#666] mb-2">
            <span>{executedHours} horas ejecutadas</span>
            <span>{totalHours} horas totales</span>
          </div>
          <div className="w-full bg-[#1A1A1A] rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(completionPct, 100)}%`,
                background: 'linear-gradient(90deg, #FF6B2B, #FFB830)',
              }}
            />
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1E1E1E]">
          {[
            { label: 'Horas planeadas', value: `${totalHours}h`, color: 'text-white' },
            { label: 'Horas ejecutadas', value: `${executedHours}h`, color: 'text-green-400' },
            { label: 'Horas restantes', value: `${Math.max(totalHours - executedHours, 0)}h`, color: 'text-[#FF6B2B]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-xs text-[#555]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ejes misionales */}
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-3">
          // EJES MISIONALES · haz clic para expandir
        </p>
        <div className="space-y-3">
          {axes.map(axis => (
            <AxisAccordion
              key={axis.id}
              axis={axis}
              planId={id!}
              planTotalHours={totalHours}
              onAddActivity={openAdd}
              onEditActivity={openEdit}
              linkedMap={linkedMap}
            />
          ))}
        </div>
      </div>

      {/* Modal de actividad */}
      {modalState.open && modalState.axis && (
        <ActivityModal
          activity={modalState.activity}
          axisType={modalState.axis.axisType as AxisType}
          axisId={modalState.axis.id}
          planId={id!}
          isNew={modalState.isNew}
          onClose={() => setModalState({ open: false, activity: null, axis: null, isNew: false })}
        />
      )}
    </div>
  );
}
