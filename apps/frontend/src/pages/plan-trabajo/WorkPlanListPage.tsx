/**
 * WorkPlanListPage.tsx — Lista de planes de trabajo
 * Filtros por nombre/documento/facultad/programa, agrupación por facultad, paginación.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ClipboardList, Plus, ChevronRight, X, Loader2,
  CheckCircle2, Clock, Archive, FileEdit, Search,
  User as UserIcon, Building2,
} from 'lucide-react';
import { workPlanService } from '@/services/workplan.service';
import { useAuthStore } from '@/stores/auth.store';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/components/ui/Pagination';
import type { WorkPlan } from '@/types';

const planStatusConfig = {
  borrador:   { label: 'Borrador',   cls: 'text-[#666] bg-[#1A1A1A] border-[#333]',            Icon: FileEdit },
  activo:     { label: 'Activo',     cls: 'text-blue-400 bg-blue-400/10 border-blue-400/30',    Icon: Clock },
  completado: { label: 'Completado', cls: 'text-green-400 bg-green-400/10 border-green-400/30', Icon: CheckCircle2 },
  archivado:  { label: 'Archivado',  cls: 'text-[#444] bg-[#111] border-[#222]',                Icon: Archive },
};

// ── Esquema del formulario ────────────────────────────────
const schema = z.object({
  semester:         z.string().min(3, 'Ej: 2026-1'),
  year:             z.coerce.number().int().min(2020),
  totalHours:       z.coerce.number().positive('Debe ser positivo'),
  resolutionNumber: z.string().optional(),
  faculty:          z.string().optional(),
  program:          z.string().optional(),
  fillDate:         z.string().optional(),
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
    mutationFn: (data: FormData) =>
      workPlanService.create({ ...data, status: 'borrador' } as Record<string, unknown>),
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
              💡 Al crear el plan, se generan automáticamente los{' '}
              <strong className="text-white">7 ejes misionales</strong> con 0 horas.
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
              {mutation.isPending
                ? <><Loader2 size={14} className="animate-spin" />Creando...</>
                : 'Crear plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function WorkPlanListPage() {
  const navigate   = useNavigate();
  const { isDecano, isCoord, isViceExt, canViewAllPlans, canViewFacultyPlans, canViewEnlacePlans } = useAuth();
  const [showNew,     setShowNew]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [facFilter,   setFacFilter]   = useState('');
  const [progFilter,  setProgFilter]  = useState('');
  const [nodoFilter,  setNodoFilter]  = useState('');

  const plansQuery = useQuery({
    queryKey: ['workplans'],
    queryFn:  () => workPlanService.getAll(),
  });

  const plans = (plansQuery.data ?? []) as WorkPlan[];

  // Roles que ven planes de otros usuarios → habilita agrupación y filtros completos
  const isReviewer = canViewAllPlans || canViewFacultyPlans || canViewEnlacePlans;
  // Roles que pueden crear planes (decano y coordinador solo revisan, vice-ext solo revisa enlace)
  const canCreate  = !isDecano && !isCoord && !isViceExt;

  // Nodos únicos (para vice-ext que agrupa por nodo)
  const nodos = useMemo(
    () => [...new Set(plans.map(p => p.user?.nodoName).filter((n): n is string => !!n))]
            .sort((a, b) => a.localeCompare(b, 'es')),
    [plans],
  );

  // Facultades únicas extraídas de los planes cargados (texto libre, no catálogo)
  const faculties = useMemo(
    () => [...new Set(plans.map(p => p.faculty).filter((f): f is string => !!f))]
            .sort((a, b) => a.localeCompare(b, 'es')),
    [plans],
  );

  // Programas dependientes de la facultad seleccionada
  const programs = useMemo(
    () => [...new Set(
      plans
        .filter(p => !facFilter || p.faculty === facFilter)
        .map(p => p.program)
        .filter((p): p is string => !!p),
    )].sort((a, b) => a.localeCompare(b, 'es')),
    [plans, facFilter],
  );

  // Lista filtrada (plana)
  const filteredFlat = useMemo(() => {
    const q = search.toLowerCase();
    return plans.filter(p => {
      if (q) {
        const name = (p.user?.name ?? '').toLowerCase();
        const doc  = (p.user?.documentNumber ?? '').toLowerCase();
        if (!name.includes(q) && !doc.includes(q)) return false;
      }
      if (isViceExt) {
        if (nodoFilter && p.user?.nodoName !== nodoFilter) return false;
      } else {
        if (facFilter  && p.faculty !== facFilter)  return false;
        if (progFilter && p.program !== progFilter) return false;
      }
      return true;
    });
  }, [plans, search, facFilter, progFilter, nodoFilter, isViceExt]);

  // Paginación sobre la lista filtrada plana
  const { paginated, PaginationUI } = usePagination(filteredFlat, 20);

  // Agrupación: vice-ext agrupa por nodo; otros por facultad
  const groupedPage = useMemo(() => {
    const map: Record<string, WorkPlan[]> = {};
    for (const plan of paginated) {
      const key = isViceExt
        ? (plan.user?.nodoName ?? 'Sin nodo')
        : (plan.faculty ?? 'Sin facultad');
      if (!map[key]) map[key] = [];
      map[key].push(plan);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [paginated, isViceExt]);

  const hasFilters = isViceExt
    ? !!(search || nodoFilter)
    : !!(search || facFilter || progFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// PLANES DE TRABAJO</p>
          <h1 className="text-2xl font-bold text-white">Plan de Trabajo Profesoral</h1>
          <p className="text-[#666] text-sm mt-1">
            Formato DO-F-002 · {filteredFlat.length} plan{filteredFlat.length !== 1 ? 'es' : ''}
            {hasFilters && <span className="text-[#FF6B2B]"> (filtrado)</span>}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo plan
          </button>
        )}
      </div>

      {/* Barra de filtros — para revisores o cuando hay varios planes */}
      {(isReviewer || plans.length > 3) && (
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isViceExt ? 'Buscar por nombre del enlace...' : isReviewer ? 'Buscar por nombre o documento del docente...' : 'Buscar plan...'}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]"
              />
            </div>

            {/* Vice-ext: filtro de nodo */}
            {isViceExt && nodos.length > 1 && (
              <select
                value={nodoFilter}
                onChange={e => setNodoFilter(e.target.value)}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[210px]"
              >
                <option value="">Todos los nodos</option>
                {nodos.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}

            {/* Otros revisores: filtros de facultad y programa */}
            {!isViceExt && faculties.length > 1 && (
              <select
                value={facFilter}
                onChange={e => { setFacFilter(e.target.value); setProgFilter(''); }}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[210px]"
              >
                <option value="">Todas las facultades</option>
                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}

            {!isViceExt && programs.length > 1 && (
              <select
                value={progFilter}
                onChange={e => setProgFilter(e.target.value)}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[210px]"
              >
                <option value="">Todos los programas</option>
                {programs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}

            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setFacFilter(''); setProgFilter(''); setNodoFilter(''); }}
                className="px-3 py-2 text-xs text-[#555] hover:text-[#FF6B2B] transition-colors border border-[#2A2A2A] rounded-lg whitespace-nowrap"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenido */}
      {plansQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#FF6B2B]" />
        </div>

      ) : filteredFlat.length === 0 ? (
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-16 text-center">
          <ClipboardList size={48} className="text-[#333] mx-auto mb-4" />
          {hasFilters ? (
            <>
              <h2 className="text-white font-semibold mb-2">Sin resultados</h2>
              <p className="text-[#555] text-sm mb-4">Ningún plan coincide con los filtros seleccionados</p>
              <button
                onClick={() => { setSearch(''); setFacFilter(''); setProgFilter(''); }}
                className="text-[#FF6B2B] text-sm hover:underline"
              >
                Limpiar filtros
              </button>
            </>
          ) : (
            <>
              <h2 className="text-white font-semibold mb-2">Sin planes de trabajo</h2>
              <p className="text-[#555] text-sm mb-6">
                {isReviewer
                  ? 'No hay planes de trabajo registrados aún'
                  : 'Crea tu primer plan de trabajo para comenzar el seguimiento'}
              </p>
              {canCreate && (
                <button
                  onClick={() => setShowNew(true)}
                  className="bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
                >
                  Crear primer plan
                </button>
              )}
            </>
          )}
        </div>

      ) : (
        <div className="space-y-6">
          {groupedPage.map(([facultyName, facultyPlans]) => (
            <div key={facultyName}>
              {/* Cabecera de grupo — solo para revisores */}
              {isReviewer && (
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={13} className="text-[#FF6B2B] flex-shrink-0" />
                  <span className="text-xs font-mono text-[#FF6B2B] uppercase tracking-widest">
                    {isViceExt ? `Nodo ${facultyName}` : facultyName}
                  </span>
                  <span className="text-xs text-[#444] font-mono">
                    — {facultyPlans.length} plan{facultyPlans.length !== 1 ? 'es' : ''}
                  </span>
                </div>
              )}

              <div className="grid gap-3">
                {facultyPlans.map(plan => {
                  const cfg  = planStatusConfig[plan.status as keyof typeof planStatusConfig] ?? planStatusConfig.borrador;
                  const Icon = cfg.Icon;

                  return (
                    <button
                      key={plan.id}
                      onClick={() => navigate(`/plan-trabajo/${plan.id}`)}
                      className="bg-[#111] border border-[#2A2A2A] hover:border-[#FF6B2B]/40 rounded-xl p-5 text-left transition-all group w-full"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">

                          {/* Nombre del docente — elemento más visible para revisores */}
                          {isReviewer && plan.user && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <UserIcon size={14} className="text-[#FF6B2B] flex-shrink-0" />
                              <span className="text-white font-semibold text-[15px] group-hover:text-[#FF6B2B] transition-colors leading-tight">
                                {plan.user.name}
                              </span>
                              {plan.user.documentNumber && (
                                <span className="text-xs text-[#555] font-mono flex-shrink-0">
                                  {plan.user.documentType ?? 'CC'} {plan.user.documentNumber}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Semestre/año + status (para docentes propios, es el título principal) */}
                          {!isReviewer && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold group-hover:text-[#FF6B2B] transition-colors">
                                {plan.semester} — {plan.year}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                                <Icon size={10} />{cfg.label}
                              </span>
                            </div>
                          )}

                          {/* Facultad / Programa */}
                          {plan.faculty && (
                            <p className="text-sm text-[#666] truncate">{plan.faculty}</p>
                          )}
                          {plan.program && (
                            <p className="text-xs text-[#555] truncate">{plan.program}</p>
                          )}

                          {/* Fila de metadatos */}
                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-[#555] font-mono">
                            <span className="text-[#888]">{plan.semester} · {plan.year}</span>
                            {isReviewer && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                                <Icon size={9} />{cfg.label}
                              </span>
                            )}
                            <span>{plan.totalHours}h</span>
                            {plan.axes && <span>{plan.axes.length} ejes</span>}
                            {plan.resolutionNumber && <span>Res. {plan.resolutionNumber}</span>}
                          </div>
                        </div>

                        <ChevronRight
                          size={16}
                          className="text-[#555] group-hover:text-[#FF6B2B] transition-colors flex-shrink-0 mt-1"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <PaginationUI />
        </div>
      )}

      {showNew && <NewPlanModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
