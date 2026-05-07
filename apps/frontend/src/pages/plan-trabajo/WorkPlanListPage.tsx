/**
 * WorkPlanListPage.tsx — Lista de planes de trabajo
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ClipboardList, Plus, ChevronRight, X, Loader2,
  CheckCircle2, Clock, Archive, FileEdit,
} from 'lucide-react';
import { workPlanService } from '@/services/workplan.service';
import { useAuthStore } from '@/stores/auth.store';
import type { WorkPlan } from '@/types';

const planStatusConfig = {
  borrador:   { label: 'Borrador',    cls: 'text-[#666] bg-[#1A1A1A] border-[#333]',       Icon: FileEdit },
  activo:     { label: 'Activo',      cls: 'text-blue-400 bg-blue-400/10 border-blue-400/30', Icon: Clock },
  completado: { label: 'Completado',  cls: 'text-green-400 bg-green-400/10 border-green-400/30', Icon: CheckCircle2 },
  archivado:  { label: 'Archivado',   cls: 'text-[#444] bg-[#111] border-[#222]',            Icon: Archive },
};

// ── Esquema del formulario ────────────────────────────────
const schema = z.object({
  semester:          z.string().min(3, 'Ej: 2026-1'),
  year:              z.coerce.number().int().min(2020),
  totalHours:        z.coerce.number().positive('Debe ser positivo'),
  resolutionNumber:  z.string().optional(),
  faculty:           z.string().optional(),
  program:           z.string().optional(),
  fillDate:          z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ── Modal de nuevo plan ───────────────────────────────────
function NewPlanModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      year: new Date().getFullYear(),
      totalHours: 900,
      faculty: user?.faculty ?? '',
      program: user?.program ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => workPlanService.create({ ...data, status: 'borrador' } as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workplans'] }); onClose(); },
  });

  const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors";
  const lbl = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <div>
            <div className="text-xs font-mono text-[#555] uppercase tracking-widest mb-0.5">Nuevo Plan</div>
            <h2 className="text-white font-semibold">Plan de Trabajo Profesoral</h2>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
          {mutation.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-red-400 text-xs">
              {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al crear'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Semestre *</label>
              <input {...register('semester')} placeholder="2026-1" className={inp} />
              {errors.semester && <p className="text-red-400 text-xs mt-1">{errors.semester.message}</p>}
            </div>
            <div>
              <label className={lbl}>Año *</label>
              <input {...register('year')} type="number" className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Total de horas del plan *</label>
            <input {...register('totalHours')} type="number" placeholder="900" className={inp} />
            <p className="text-xs text-[#555] mt-1">Puede variar cada semestre (900, 1000...)</p>
            {errors.totalHours && <p className="text-red-400 text-xs mt-1">{errors.totalHours.message}</p>}
          </div>

          <div>
            <label className={lbl}>Resolución Rectoral</label>
            <input {...register('resolutionNumber')} placeholder="202502730" className={inp} />
          </div>

          <div>
            <label className={lbl}>Facultad / Dependencia</label>
            <input {...register('faculty')} placeholder="Ingeniería y Ciencias Agropecuarias" className={inp} />
          </div>

          <div>
            <label className={lbl}>Área / Programa</label>
            <input {...register('program')} placeholder="Tecnología en Desarrollo de Software" className={inp} />
          </div>

          <div>
            <label className={lbl}>Fecha de diligenciamiento</label>
            <input {...register('fillDate')} type="date" className={inp} />
          </div>

          <div className="bg-[#FF6B2B]/5 border border-[#FF6B2B]/15 rounded-lg px-4 py-3">
            <p className="text-xs text-[#888]">
              💡 Al crear el plan, se generan automáticamente los <strong className="text-white">7 ejes misionales</strong> con 0 horas.
              Luego configuras las horas de cada eje y agregas las actividades.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 text-sm text-[#666] hover:text-white py-2.5 border border-[#2A2A2A] rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              {mutation.isPending ? <><Loader2 size={14} className="animate-spin" />Creando...</> : 'Crear plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function WorkPlanListPage() {
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);

  const plansQuery = useQuery({
    queryKey: ['workplans'],
    queryFn: () => workPlanService.getAll(),
  });

  const plans = (plansQuery.data ?? []) as WorkPlan[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// PLANES DE TRABAJO</p>
          <h1 className="text-2xl font-bold text-white">Plan de Trabajo Profesoral</h1>
          <p className="text-[#666] text-sm mt-1">Formato DO-F-002 · Seguimiento de ejes misionales</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nuevo plan
        </button>
      </div>

      {plansQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#FF6B2B]" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-16 text-center">
          <ClipboardList size={48} className="text-[#333] mx-auto mb-4" />
          <h2 className="text-white font-semibold mb-2">Sin planes de trabajo</h2>
          <p className="text-[#555] text-sm mb-6">Crea tu primer plan de trabajo para comenzar el seguimiento</p>
          <button onClick={() => setShowNew(true)}
            className="bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
            Crear primer plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {plans.map(plan => {
            const cfg = planStatusConfig[plan.status] ?? planStatusConfig.borrador;
            const Icon = cfg.Icon;
            return (
              <button
                key={plan.id}
                onClick={() => navigate(`/plan-trabajo/${plan.id}`)}
                className="bg-[#111] border border-[#2A2A2A] hover:border-[#FF6B2B]/40 rounded-xl p-5 text-left transition-all group w-full"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{plan.semester} — {plan.year}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                        <Icon size={10} />{cfg.label}
                      </span>
                    </div>
                    {plan.faculty && <p className="text-sm text-[#666] truncate">{plan.faculty}</p>}
                    {plan.program && <p className="text-xs text-[#555] truncate">{plan.program}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-[#555] font-mono">
                      <span>{plan.totalHours}h totales</span>
                      {plan.axes && <span>{plan.axes.length} ejes</span>}
                      {plan.resolutionNumber && <span>Res. {plan.resolutionNumber}</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#555] group-hover:text-[#FF6B2B] transition-colors flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showNew && <NewPlanModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
