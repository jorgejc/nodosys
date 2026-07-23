/**
 * ReportesPage.tsx — Módulo central de reportes IU Digital
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { workPlanService } from '@/services/workplan.service';
import { usersService } from '@/services/users.service';
import { useAuth } from '@/hooks/useAuth';
import type { WorkPlan } from '@/types';

// ── Helper de descarga (usado por las tarjetas de plan/inventario que tienen lógica propia) ──
async function downloadFile(url: string, filename: string, params?: Record<string, string>) {
  const response = await api.get(url, { responseType: 'blob', params });
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function DownloadButton({ label, icon: Icon, color, onClick, loading }: {
  label: string; icon: typeof FileDown; color: string; onClick: () => void; loading: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 ${color}`}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {loading ? 'Generando...' : label}
    </button>
  );
}

// ── Selectores reutilizables ──────────────────────────────
const STATUS_OPTS = [
  { value: '',            label: 'Todos los estados' },
  { value: 'borrador',    label: 'Borrador' },
  { value: 'pendiente',   label: 'Pendiente' },
  { value: 'aprobada',    label: 'Aprobada' },
  { value: 'rechazada',   label: 'Rechazada' },
  { value: 'en_ejecucion',label: 'En ejecución' },
  { value: 'ejecutada',   label: 'Ejecutada' },
  { value: 'cerrada',     label: 'Cerrada' },
];

const ROLE_OPTS = [
  { value: '',                      label: 'Todos los roles' },
  { value: 'admin',                 label: 'Administrador' },
  { value: 'vicerrector_extension', label: 'Vicerrector Extensión' },
  { value: 'vicerrector_academico', label: 'Vicerrector Académico' },
  { value: 'equipo_extension',      label: 'Equipo Extensión' },
  { value: 'decano',                label: 'Decano' },
  { value: 'coordinador',           label: 'Coordinador' },
  { value: 'enlace',                label: 'Enlace de Nodo' },
  { value: 'docente',               label: 'Docente' },
  { value: 'monitor',               label: 'Monitor' },
  { value: 'auxiliar',              label: 'Auxiliar' },
];

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[180px]"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function DateInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
    />
  );
}

function SectionCard({ emoji, title, subtitle, children }: {
  emoji: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-[#FF6B2B]/10 border border-[#FF6B2B]/20 rounded-lg flex items-center justify-center">
          <span className="text-xl">{emoji}</span>
        </div>
        <div>
          <h2 className="text-white font-semibold">{title}</h2>
          <p className="text-[#666] text-xs">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ContentPreview({ excel, pdf }: { excel: string[]; pdf: string[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#555]">
      <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
        <div className="text-white font-medium mb-1">📊 Excel incluye:</div>
        <ul className="space-y-0.5">{excel.map(l => <li key={l}>• {l}</li>)}</ul>
      </div>
      <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
        <div className="text-white font-medium mb-1">📄 PDF incluye:</div>
        <ul className="space-y-0.5">{pdf.map(l => <li key={l}>• {l}</li>)}</ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function ReportesPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const {
    canViewInventoryReports,
    canViewPlanReports,
    canViewActivityReports,
    canViewUserReports,
    canViewAllPlans,
    canViewFacultyPlans,
    canViewEnlacePlans,
    isAdmin, isViceExt,
  } = useAuth();

  // ── Filtros plan de trabajo ─────────────────────────────
  const [selectedPlanId,     setSelectedPlanId]     = useState('');
  const [selectedDocenteId,  setSelectedDocenteId]  = useState('');
  // Para vice-ext: filtro nodo → enlace (en lugar de docente genérico)
  const [selectedNodoPlan,   setSelectedNodoPlan]   = useState('');
  const [selectedEnlaceId,   setSelectedEnlaceId]   = useState('');

  // ── Filtros inventario ──────────────────────────────────
  const [invNodoId, setInvNodoId] = useState('');

  // ── Filtros actividades ─────────────────────────────────
  const [actDateFrom, setActDateFrom] = useState('');
  const [actDateTo,   setActDateTo]   = useState('');
  const [actStatus,   setActStatus]   = useState('');
  const [actNodoId,   setActNodoId]   = useState('');

  // ── Filtros usuarios ────────────────────────────────────
  const [userRole,    setUserRole]    = useState('');

  const plansQuery = useQuery({
    queryKey: ['workplans'],
    queryFn:  () => workPlanService.getAll(),
    enabled:  canViewPlanReports,
  });
  const plans = (plansQuery.data ?? []) as WorkPlan[];

  // Nodos disponibles para filtros (vice-ext y admin)
  const nodosQuery = useQuery({
    queryKey: ['nodos'],
    queryFn:  () => usersService.getNodos(),
    enabled:  isViceExt || isAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const nodos = nodosQuery.data ?? [];

  const date = new Date().toISOString().split('T')[0];

  const download = async (key: string, url: string, filename: string, params?: Record<string, string>) => {
    setLoading(key);
    try {
      await downloadFile(url, filename, params);
    } catch {
      alert('Error al generar el reporte. Intenta de nuevo.');
    } finally {
      setLoading(null);
    }
  };

  // Roles que ven planes de otros usuarios → muestran selector cascading
  const isPlanReviewer = canViewAllPlans || canViewFacultyPlans || canViewEnlacePlans;

  // Vice-ext: nodos únicos en los planes cargados (enlace tiene nodoId/nodoName)
  const nodosEnPlanes = useMemo(() => {
    const seen = new Set<string>();
    return plans
      .filter(p => p.user?.nodoName && !seen.has(p.user.nodoName) && seen.add(p.user.nodoName))
      .map(p => ({ nodoName: p.user!.nodoName! }))
      .sort((a, b) => a.nodoName.localeCompare(b.nodoName, 'es'));
  }, [plans]);

  // Vice-ext: enlaces filtrados por nodo seleccionado
  const enlaceOptions = useMemo(() => {
    const seen = new Set<string>();
    return plans
      .filter(p => p.user && (!selectedNodoPlan || p.user.nodoName === selectedNodoPlan)
              && !seen.has(p.userId) && seen.add(p.userId))
      .map(p => ({ userId: p.userId, name: p.user!.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [plans, selectedNodoPlan]);

  function handleNodoPlanChange(nodoName: string) {
    setSelectedNodoPlan(nodoName);
    setSelectedEnlaceId('');
    setSelectedPlanId('');
  }

  function handleEnlaceChange(userId: string) {
    setSelectedEnlaceId(userId);
    setSelectedPlanId('');
  }

  // Docentes únicos derivados de los planes cargados (ya vienen con join de user)
  const docenteOptions = useMemo(() => {
    const seen = new Set<string>();
    return plans
      .filter(p => p.user && !seen.has(p.userId) && seen.add(p.userId))
      .map(p => ({ userId: p.userId, name: p.user!.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [plans]);

  // Planes filtrados por el docente/enlace seleccionado
  const plansByDocente = useMemo(() => {
    if (isViceExt) {
      const byNodo = selectedNodoPlan ? plans.filter(p => p.user?.nodoName === selectedNodoPlan) : plans;
      return selectedEnlaceId ? byNodo.filter(p => p.userId === selectedEnlaceId) : byNodo;
    }
    return selectedDocenteId ? plans.filter(p => p.userId === selectedDocenteId) : plans;
  }, [plans, selectedDocenteId, selectedEnlaceId, selectedNodoPlan, isViceExt]);

  function handleDocenteChange(userId: string) {
    setSelectedDocenteId(userId);
    setSelectedPlanId('');
  }

  const actParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    if (actDateFrom) p.dateFrom = actDateFrom;
    if (actDateTo)   p.dateTo   = actDateTo;
    if (actStatus)   p.status   = actStatus;
    if (actNodoId)   p.nodoId   = actNodoId;
    return p;
  };

  const userParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    if (userRole) p.role = userRole;
    return p;
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// MÓDULO DE REPORTES</p>
        <h1 className="text-2xl font-bold text-white">Reportes y Exportaciones</h1>
        <p className="text-[#666] text-sm mt-1">Genera reportes en PDF y Excel de los módulos que tienes disponibles</p>
      </div>

      {/* ── INVENTARIO ─────────────────────────────────── */}
      {canViewInventoryReports && (
        <SectionCard emoji="📦" title="Inventario del Nodo" subtitle="Reporte completo de equipos, materiales y unidades">
          {/* Filtro de nodo para admin/vice-ext */}
          {(isAdmin || isViceExt) && nodos.length > 0 && (
            <div className="mb-4">
              <select
                value={invNodoId}
                onChange={e => setInvNodoId(e.target.value)}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[200px]"
              >
                <option value="">Todos los nodos</option>
                {nodos.map(n => (
                  <option key={n.nodoId} value={n.nodoId}>{n.nodoName}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <DownloadButton
              label="Descargar Excel (.xlsx)"
              icon={FileSpreadsheet}
              color="text-green-400 border-green-400/30 bg-green-400/5 hover:bg-green-400/10"
              loading={loading === 'inv-excel'}
              onClick={() => download('inv-excel', '/reports/inventory/excel', `inventario-${date}.xlsx`,
                invNodoId ? { nodoId: invNodoId } : undefined)}
            />
            <DownloadButton
              label="Descargar PDF"
              icon={FileText}
              color="text-red-400 border-red-400/30 bg-red-400/5 hover:bg-red-400/10"
              loading={loading === 'inv-pdf'}
              onClick={() => download('inv-pdf', '/reports/inventory/pdf', `inventario-${date}.pdf`,
                invNodoId ? { nodoId: invNodoId } : undefined)}
            />
          </div>
          <ContentPreview
            excel={['Hoja 1: Resumen por ítem (totales, ubicación)', 'Hoja 2: Detalle de todas las unidades físicas', 'Color por condición (bueno/regular/malo)', 'Formato profesional con estilos']}
            pdf={['Formato horizontal (landscape)', 'Agrupado por categoría', 'Columna de ubicación (G3/E2)', 'Numeración de páginas']}
          />
        </SectionCard>
      )}

      {/* ── ACTIVIDADES ────────────────────────────────── */}
      {canViewActivityReports && (
        <SectionCard emoji="📋" title="Actividades y Viáticos" subtitle="Solicitudes de actividades con estado, recursos y municipio">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <DateInput value={actDateFrom} onChange={setActDateFrom} placeholder="Desde" />
            <DateInput value={actDateTo}   onChange={setActDateTo}   placeholder="Hasta" />
            <FilterSelect value={actStatus} onChange={setActStatus} options={STATUS_OPTS} />
            {/* Filtro de nodo para admin y vice-ext */}
            {(isAdmin || isViceExt) && nodos.length > 0 && (
              <select
                value={actNodoId}
                onChange={e => setActNodoId(e.target.value)}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[180px]"
              >
                <option value="">Todos los nodos</option>
                {nodos.map(n => (
                  <option key={n.nodoId} value={n.nodoId}>{n.nodoName}</option>
                ))}
              </select>
            )}
          </div>
          {(actDateFrom || actDateTo || actStatus || actNodoId) && (
            <button
              onClick={() => { setActDateFrom(''); setActDateTo(''); setActStatus(''); setActNodoId(''); }}
              className="text-xs text-[#555] hover:text-[#FF6B2B] transition-colors mb-4 underline"
            >
              Limpiar filtros
            </button>
          )}
          <div className="flex flex-wrap gap-3">
            <DownloadButton
              label="Descargar Excel (.xlsx)"
              icon={FileSpreadsheet}
              color="text-green-400 border-green-400/30 bg-green-400/5 hover:bg-green-400/10"
              loading={loading === 'act-excel'}
              onClick={() => download('act-excel', '/reports/activities/excel', `actividades-${date}.xlsx`, actParams())}
            />
            <DownloadButton
              label="Descargar PDF"
              icon={FileText}
              color="text-red-400 border-red-400/30 bg-red-400/5 hover:bg-red-400/10"
              loading={loading === 'act-pdf'}
              onClick={() => download('act-pdf', '/reports/activities/pdf', `actividades-${date}.pdf`, actParams())}
            />
          </div>
          <ContentPreview
            excel={[
              'Código, título y docente',
              'Fecha, municipio y estrategia',
              'Participantes, total COP y tipo de pago',
              'Estado con color por categoría',
            ]}
            pdf={[
              'Formato horizontal (Legal)',
              'Filtros aplicados en el subtítulo',
              'Colores de estado (aprobada / rechazada / cerrada)',
              'Encabezado y pie institucional IU Digital',
            ]}
          />
        </SectionCard>
      )}

      {/* ── PLAN DE TRABAJO ────────────────────────────── */}
      {canViewPlanReports && (
        <SectionCard emoji="🗂️" title="Plan de Trabajo Profesoral" subtitle="Formato DO-F-002 · Seguimiento de ejes misionales">

          {/* Selector vice-ext: cascada Nodo → Enlace */}
          {isPlanReviewer && isViceExt && (
            <div className="flex flex-wrap gap-3 mb-3">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-[#666] uppercase tracking-wider block mb-2">Nodo</label>
                <select
                  value={selectedNodoPlan}
                  onChange={e => handleNodoPlanChange(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B]"
                >
                  <option value="">— Todos los nodos —</option>
                  {nodosEnPlanes.map(n => (
                    <option key={n.nodoName} value={n.nodoName}>{n.nodoName}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-[#666] uppercase tracking-wider block mb-2">Enlace</label>
                <select
                  value={selectedEnlaceId}
                  onChange={e => handleEnlaceChange(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B]"
                >
                  <option value="">— Todos los enlaces —</option>
                  {enlaceOptions.map(d => (
                    <option key={d.userId} value={d.userId}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Selector de docente — para otros revisores (admin, vice-acad, equipo, decano, coord) */}
          {isPlanReviewer && !isViceExt && (
            <div className="mb-3">
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-2">
                Docente
              </label>
              <select
                value={selectedDocenteId}
                onChange={e => handleDocenteChange(e.target.value)}
                className="w-full max-w-sm bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B]"
              >
                <option value="">— Todos los docentes —</option>
                {docenteOptions.map(d => (
                  <option key={d.userId} value={d.userId}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Selector de plan */}
          <div className="mb-4">
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-2">
              Plan de trabajo
            </label>
            <select
              value={selectedPlanId}
              onChange={e => setSelectedPlanId(e.target.value)}
              className="w-full max-w-sm bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B]"
            >
              <option value="">— Seleccionar plan —</option>
              {plansByDocente.map(p => (
                <option key={p.id} value={p.id}>
                  {isPlanReviewer && !selectedDocenteId
                    ? `${p.user?.name ?? '—'}  ·  `
                    : ''}
                  {p.semester} · {p.year}
                  {p.faculty ? ` · ${p.faculty}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <DownloadButton
              label="Descargar Excel (.xlsx)"
              icon={FileSpreadsheet}
              color="text-green-400 border-green-400/30 bg-green-400/5 hover:bg-green-400/10"
              loading={loading === 'wp-excel'}
              onClick={() => {
                if (!selectedPlanId) { alert('Selecciona un plan de trabajo primero'); return; }
                download('wp-excel', `/reports/workplan/${selectedPlanId}/excel`, `plan-trabajo-${selectedPlanId.slice(0,8)}.xlsx`);
              }}
            />
            <DownloadButton
              label="Descargar PDF (DO-F-002)"
              icon={FileDown}
              color="text-[#FF6B2B] border-[#FF6B2B]/30 bg-[#FF6B2B]/5 hover:bg-[#FF6B2B]/10"
              loading={loading === 'wp-pdf'}
              onClick={() => {
                if (!selectedPlanId) { alert('Selecciona un plan de trabajo primero'); return; }
                download('wp-pdf', `/reports/workplan/${selectedPlanId}/pdf`, `plan-trabajo-DO-F-002-${selectedPlanId.slice(0,8)}.pdf`);
              }}
            />
          </div>
          <ContentPreview
            excel={['Encabezado DO-F-002 completo', 'Una sección por eje misional', 'Tabla de actividades con horas', 'Totales por eje y plan completo']}
            pdf={['Formato horizontal (Legal)', 'Dimensiones de Digitalidad Próxima', 'Estado y fechas por actividad', 'Enlace a soportes/evidencias']}
          />
        </SectionCard>
      )}

      {/* ── USUARIOS (solo admin) ───────────────────────── */}
      {canViewUserReports && (
        <SectionCard emoji="👥" title="Usuarios del Sistema" subtitle="Listado de usuarios con rol, facultad, programa y nodo">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <FilterSelect value={userRole} onChange={setUserRole} options={ROLE_OPTS} />
          </div>
          <div className="flex flex-wrap gap-3">
            <DownloadButton
              label="Descargar Excel (.xlsx)"
              icon={FileSpreadsheet}
              color="text-green-400 border-green-400/30 bg-green-400/5 hover:bg-green-400/10"
              loading={loading === 'usr-excel'}
              onClick={() => download('usr-excel', '/reports/users/excel', `usuarios-${date}.xlsx`, userParams())}
            />
            <DownloadButton
              label="Descargar PDF"
              icon={FileText}
              color="text-red-400 border-red-400/30 bg-red-400/5 hover:bg-red-400/10"
              loading={loading === 'usr-pdf'}
              onClick={() => download('usr-pdf', '/reports/users/pdf', `usuarios-${date}.pdf`, userParams())}
            />
          </div>
          <ContentPreview
            excel={['Nombre, email y documento', 'Rol con color por categoría', 'Facultad, programa y nodo', 'Estado activo/inactivo']}
            pdf={['Agrupado por rol', 'Columna de estado activo resaltada', 'Encabezado y pie institucional IU Digital', 'Numeración de páginas']}
          />
        </SectionCard>
      )}
    </div>
  );
}
