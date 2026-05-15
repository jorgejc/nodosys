/**
 * DashboardPage.tsx — Panel de control con datos reales
 * Vista diferente según el rol del usuario autenticado
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package, ClipboardList, FileText, AlertTriangle,
  CheckCircle2, ChevronRight, Users,
  Search, ArrowUpRight, Loader2,
} from 'lucide-react';
import { inventoryItemService } from '@/services/inventory.service';
import { workPlanService } from '@/services/workplan.service';
import { usersService } from '@/services/users.service';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import type { WorkPlan } from '@/types';

// ── Barra de progreso ─────────────────────────────────────
function ProgressBar({ value, max, color = '#FF6B2B', h = 'h-2' }: {
  value: number; max: number; color?: string; h?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`w-full bg-[#1A1A1A] rounded-full ${h} overflow-hidden`}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ── Tarjeta de métrica ────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, color, bg, border, onClick }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Package; color: string; bg: string; border: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`bg-[#111] border ${border} rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-[#FF6B2B]/40' : ''} transition-colors`}>
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-4`}>
        <Icon size={18} className={color} />
      </div>
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-sm text-white font-medium">{label}</div>
      {sub && <div className="text-xs text-[#555] mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Gauge inline para lista de docentes ───────────────────
function DocPlanProgress({ planId, totalHours }: { planId: string; totalHours: number }) {
  const q = useQuery({
    queryKey: ['workplan-summary', planId],
    queryFn: () => workPlanService.getSummary(planId),
  });
  const s = q.data as Record<string, number | string> | undefined;
  if (!s) return <Loader2 size={12} className="animate-spin text-[#555]" />;
  const pct   = Number(s.overall_completion_percentage ?? 0);
  const color = pct >= 80 ? '#4ADE80' : pct >= 50 ? '#FFB830' : '#FF6B2B';
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-20 bg-[#1A1A1A] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── Dashboard para Docente / Enlace / Admin ───────────────
function TeacherDashboard() {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);

  const invQ  = useQuery({ queryKey: ['inventory-summary'], queryFn: () => inventoryItemService.getSummary() });
  const planQ = useQuery({ queryKey: ['workplans'],         queryFn: () => workPlanService.getAll() });

  const inv     = invQ.data as Record<string, string> | undefined;
  const plans   = (planQ.data ?? []) as WorkPlan[];
  const plan    = plans.find(p => p.status === 'activo') ?? plans[0];

  const damaged  = parseInt(inv?.malo ?? '0') + parseInt(inv?.dado_de_baja ?? '0');
  const onLoan   = parseInt(inv?.en_prestamo ?? '0');
  const total    = parseInt(inv?.total_units ?? '0');
  const available = parseInt(inv?.disponible ?? '0');

  const alerts: { msg: string; type: 'error' | 'warning' | 'info' }[] = [];
  if (damaged > 0) alerts.push({ msg: `${damaged} equipo${damaged > 1 ? 's' : ''} en mal estado o dado de baja`, type: 'error' });
  if (onLoan > 0)  alerts.push({ msg: `${onLoan} equipo${onLoan > 1 ? 's' : ''} actualmente en préstamo fuera del nodo`, type: 'info' });
  if (total > 0 && available / total < 0.3) alerts.push({ msg: 'Atención: menos del 30% del inventario disponible', type: 'warning' });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// PANEL PRINCIPAL</p>
        <h1 className="text-2xl font-bold text-white">Hola, {user?.name.split(' ')[0]} 👋</h1>
        <p className="text-[#666] text-sm mt-1">Nodo Arboletes · IU Digital</p>
      </div>

      {/* Alertas del inventario */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} onClick={() => navigate('/inventario')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm cursor-pointer hover:opacity-90 transition-opacity ${
                a.type === 'error'   ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                a.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                       'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}>
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span className="flex-1">{a.msg}</span>
              <ArrowUpRight size={12} className="flex-shrink-0 opacity-60" />
            </div>
          ))}
        </div>
      )}

      {/* Plan de trabajo */}
      {plan ? (
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// PLAN DE TRABAJO</p>
              <h2 className="text-lg font-bold text-white">{plan.semester} · {plan.year}</h2>
              <p className="text-xs text-[#666] mt-0.5">{plan.faculty ?? ''} {plan.program ? `· ${plan.program}` : ''}</p>
            </div>
            <button onClick={() => navigate(`/plan-trabajo/${plan.id}`)}
              className="text-xs text-[#FF6B2B] hover:text-white flex items-center gap-1 transition-colors">
              Ver detalle <ArrowUpRight size={11} />
            </button>
          </div>
          <PlanGauge planId={plan.id} totalHours={Number(plan.totalHours)} />
        </div>
      ) : !planQ.isLoading ? (
        <div className="bg-[#111] border border-dashed border-[#2A2A2A] rounded-xl p-8 text-center">
          <ClipboardList size={36} className="text-[#333] mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Sin plan de trabajo activo</p>
          <p className="text-[#555] text-sm mb-4">Crea tu plan de trabajo para este semestre</p>
          <button onClick={() => navigate('/plan-trabajo')}
            className="bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            Crear plan →
          </button>
        </div>
      ) : null}

      {/* Inventario */}
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-3">// INVENTARIO DEL NODO</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Total unidades" value={inv?.total_units ?? '—'} sub={`${inv?.total_items ?? 0} modelos`}
            icon={Package} color="text-white" bg="bg-[#1A1A1A]" border="border-[#2A2A2A]"
            onClick={() => navigate('/inventario')} />
          <MetricCard label="Disponibles"   value={inv?.disponible ?? '—'}
            icon={CheckCircle2} color="text-green-400" bg="bg-green-400/10" border="border-green-400/20"
            onClick={() => navigate('/inventario')} />
          <MetricCard label="En préstamo"   value={inv?.en_prestamo ?? '—'}
            icon={ArrowUpRight} color="text-blue-400" bg="bg-blue-400/10" border="border-blue-400/20"
            onClick={() => navigate('/inventario')} />
          <MetricCard label="Con problemas" value={damaged}
            icon={AlertTriangle} color={damaged > 0 ? 'text-red-400' : 'text-[#555]'}
            bg={damaged > 0 ? 'bg-red-400/10' : 'bg-[#1A1A1A]'} border={damaged > 0 ? 'border-red-400/20' : 'border-[#2A2A2A]'}
            onClick={() => navigate('/inventario')} />
        </div>
      </div>

      {/* Acciones rápidas */}
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-3">// ACCIONES RÁPIDAS</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Agregar ítem al inventario',    icon: Package,       path: '/inventario/nuevo' },
            { label: 'Registrar sesión de actividad', icon: ClipboardList, path: '/plan-trabajo' },
            { label: 'Generar reporte',               icon: FileText,      path: '/reportes' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)}
              className="bg-[#111] border border-[#2A2A2A] hover:border-[#FF6B2B]/30 rounded-xl p-4 text-left transition-colors group flex items-center gap-3">
              <div className="w-9 h-9 bg-[#FF6B2B]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <a.icon size={16} className="text-[#FF6B2B]" />
              </div>
              <div>
                <div className="text-sm text-white group-hover:text-[#FF6B2B] transition-colors">{a.label}</div>
                <div className="flex items-center gap-1 text-xs text-[#555] mt-0.5">Ir ahora <ChevronRight size={10} /></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Gauge del plan de trabajo ─────────────────────────────
function PlanGauge({ planId, totalHours }: { planId: string; totalHours: number }) {
  const q = useQuery({ queryKey: ['workplan-summary', planId], queryFn: () => workPlanService.getSummary(planId) });
  const s = q.data as Record<string, string | number> | undefined;
  if (!s) return <div className="animate-pulse h-16 bg-[#1A1A1A] rounded-lg" />;
  const executed  = Number(s.total_executed_hours ?? 0);
  const pct       = Number(s.overall_completion_percentage ?? 0);
  const remaining = Math.max(totalHours - executed, 0);
  const finished  = Number(s.finished_activities ?? 0);
  const totalActs = Number(s.total_activities ?? 0);
  const color     = pct >= 80 ? '#4ADE80' : pct >= 50 ? '#FFB830' : '#FF6B2B';
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-4xl font-black" style={{ color }}>{pct}%</span>
          <span className="text-[#555] text-sm ml-2">completado</span>
        </div>
        <div className="text-right text-xs text-[#666] space-y-0.5">
          <div className="text-white font-medium">{executed}h ejecutadas</div>
          <div className="text-[#555]">{remaining}h restantes de {totalHours}h</div>
        </div>
      </div>
      <ProgressBar value={executed} max={totalHours} color={color} h="h-3" />
      <div className="flex justify-between text-xs text-[#555]">
        <span>{finished} de {totalActs} actividades finalizadas</span>
        <span className="text-[#444] font-mono">{totalHours}h totales</span>
      </div>
    </div>
  );
}

// ── Dashboard Decano / Vicerrector ────────────────────────
function DirectorDashboard() {
  const navigate    = useNavigate();
  const { isVicerrector } = useAuth();
  const user        = useAuthStore(s => s.user);
  const [search, setSearch]           = useState('');
  const [facultyFilter, setFaculty]   = useState(!isVicerrector ? (user?.faculty ?? '') : '');

  const usersQ = useQuery({
    queryKey: ['users', 'docente', facultyFilter],
    queryFn:  () => usersService.getAll({ role: 'docente', faculty: facultyFilter || undefined }),
  });
  const plansQ = useQuery({ queryKey: ['workplans'], queryFn: () => workPlanService.getAll() });

  const docentes = (usersQ.data ?? []) as { id: string; name: string; email: string; faculty: string | null; program: string | null }[];
  const plans    = (plansQ.data ?? []) as WorkPlan[];
  const getplan  = (uid: string) => plans.find(p => p.userId === uid && p.status === 'activo') ?? plans.find(p => p.userId === uid);
  const filtered = docentes.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// PANEL DIRECTIVO</p>
        <h1 className="text-2xl font-bold text-white">
          {isVicerrector ? 'Todos los Docentes' : `Facultad: ${user?.faculty ?? 'Sin asignar'}`}
        </h1>
        <p className="text-[#666] text-sm mt-1">{docentes.length} docente{docentes.length !== 1 ? 's' : ''} · Seguimiento de planes de trabajo</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input placeholder="Buscar docente..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]" />
        </div>
        {isVicerrector && (
          <input placeholder="Filtrar por facultad..." value={facultyFilter} onChange={e => setFaculty(e.target.value)}
            className="bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] min-w-[220px]" />
        )}
      </div>

      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="border-b border-[#1E1E1E] px-5 py-3">
          <span className="text-xs font-mono text-[#555] uppercase tracking-widest">// PLANES DE TRABAJO POR DOCENTE</span>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users size={36} className="text-[#333] mb-3" />
            <p className="text-[#555] text-sm">No hay docentes {search ? 'que coincidan' : 'registrados'}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {filtered.map(doc => {
              const plan = getplan(doc.id);
              return (
                <div key={doc.id}
                  onClick={() => plan && navigate(`/plan-trabajo/${plan.id}`)}
                  className="px-5 py-4 hover:bg-[#161616] transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#666] text-xs font-bold">
                        {doc.name.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium group-hover:text-[#FF6B2B] transition-colors truncate">{doc.name}</div>
                      <div className="text-xs text-[#555] truncate">{doc.program ?? doc.faculty ?? doc.email}</div>
                    </div>
                    {plan ? (
                      <DocPlanProgress planId={plan.id} totalHours={Number(plan.totalHours)} />
                    ) : (
                      <span className="text-xs text-[#444] italic flex-shrink-0">Sin plan</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Monitor / Auxiliar ──────────────────────────
function OperativeDashboard() {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);
  const invQ     = useQuery({ queryKey: ['inventory-summary'], queryFn: () => inventoryItemService.getSummary() });
  const inv      = invQ.data as Record<string, string> | undefined;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// PANEL</p>
        <h1 className="text-2xl font-bold text-white">Hola, {user?.name.split(' ')[0]} 👋</h1>
        <p className="text-[#666] text-sm mt-1">{user?.role === 'monitor' ? 'Monitor' : 'Auxiliar'} · Nodo Arboletes</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total unidades" value={inv?.total_units ?? '—'} icon={Package}
          color="text-white" bg="bg-[#1A1A1A]" border="border-[#2A2A2A]" onClick={() => navigate('/inventario')} />
        <MetricCard label="Disponibles" value={inv?.disponible ?? '—'} icon={CheckCircle2}
          color="text-green-400" bg="bg-green-400/10" border="border-green-400/20" onClick={() => navigate('/inventario')} />
      </div>
      <button onClick={() => navigate('/inventario/nuevo')}
        className="w-full bg-[#FF6B2B] hover:bg-[#e55c20] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
        <Package size={16} /> Registrar nuevo ítem en inventario
      </button>
    </div>
  );
}

// ── Export principal ──────────────────────────────────────
export default function DashboardPage() {
  const { isDecano, isVicerrector, isMonitorOrAuxiliar } = useAuth();
  if (isDecano || isVicerrector) return <DirectorDashboard />;
  if (isMonitorOrAuxiliar) return <OperativeDashboard />;
  return <TeacherDashboard />;
}
