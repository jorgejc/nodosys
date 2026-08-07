/**
 * MonitoriasPage.tsx — Punto de entrada del módulo de Monitorías
 *
 * Según el rol muestra una cosa u otra:
 *   monitor        → su propio plan de trabajo (lo edita)
 *   enlace / admin → la lista de monitoras de su nodo
 *   resto          → mensaje de sin acceso (el backend también responde 403)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, Loader2, ChevronRight, PenLine,
  ShieldOff, Users, Clock,
} from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { useAuth } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/utils/apiError';
import PlanView from '@/components/monitorias/PlanView';
import SignatureModal from '@/components/monitorias/SignatureModal';

export default function MonitoriasPage() {
  const { canViewMonitorias, canManageMonitorias, role, user } = useAuth();

  if (!canViewMonitorias) return <NoAccess />;

  return role === 'monitor'
    ? <MonitorOwnPlan vigenciaHint={user?.nodoName} />
    : <EnlaceMonitorList canManage={canManageMonitorias} />;
}

// ══════════════════════════════════════════════════════════
// Vista de la MONITORA
// ══════════════════════════════════════════════════════════
function MonitorOwnPlan({ vigenciaHint }: { vigenciaHint?: string | null }) {
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['monitor-plan', 'me'],
    queryFn:  () => monitorsService.getMyPlan(),
  });

  if (isLoading) return <Spinner />;
  if (error || !plan) return <ErrorBox message={apiErrorMessage(error)} />;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-mono text-[#555]">
          <GraduationCap size={13} /> MONITORÍAS
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">Mi plan de trabajo</h1>
        <p className="mt-1 text-sm text-[#666]">
          Vigencia {plan.vigencia}
          {vigenciaHint && <> · Nodo {vigenciaHint}</>}
          {' · '}Máximo 12 horas por semana
        </p>
      </header>

      <PlanView plan={plan} canEdit canOverride={false} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Vista del ENLACE — lista de monitoras del nodo
// ══════════════════════════════════════════════════════════
function EnlaceMonitorList({ canManage }: { canManage: boolean }) {
  const [signatureOpen, setSignatureOpen] = useState(false);

  const { data: monitors, isLoading, error } = useQuery({
    queryKey: ['monitors'],
    queryFn:  monitorsService.listMonitors,
  });

  const { data: signature } = useQuery({
    queryKey: ['my-signature'],
    queryFn:  monitorsService.getMySignature,
    enabled:  canManage,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox message={apiErrorMessage(error)} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#555]">
            <GraduationCap size={13} /> MONITORÍAS
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">Monitoras del nodo</h1>
          <p className="mt-1 text-sm text-[#666]">
            Consulta sus planes de trabajo y genera los certificados de horas.
          </p>
        </div>

        {canManage && (
          <button onClick={() => setSignatureOpen(true)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              signature?.signatureUrl
                ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : 'border-[#FF6B2B]/30 bg-[#FF6B2B]/10 text-[#FF6B2B] hover:bg-[#FF6B2B]/20'
            }`}>
            <PenLine size={14} />
            {signature?.signatureUrl ? 'Cambiar mi firma' : 'Subir mi firma'}
          </button>
        )}
      </header>

      {!monitors?.length ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] py-16 text-center">
          <Users size={28} className="mx-auto mb-3 text-[#333]" />
          <p className="text-sm text-[#888]">No hay monitoras registradas en tu nodo.</p>
          <p className="mt-1 text-xs text-[#555]">
            El administrador crea los usuarios con rol monitor y los asigna al nodo.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {monitors.map((m) => (
            <Link key={m.id} to={`/monitorias/${m.id}`}
              className="group rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] p-4 transition-all hover:border-[#FF6B2B]/30 hover:bg-[#111]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#FF6B2B]/30 bg-[#FF6B2B]/10">
                  <span className="text-xs font-bold text-[#FF6B2B]">
                    {m.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{m.name}</div>
                  <div className="truncate text-xs text-[#666]">{m.program ?? m.email}</div>
                </div>
                <ChevronRight size={14}
                  className="mt-1 flex-shrink-0 text-[#333] transition-colors group-hover:text-[#FF6B2B]" />
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-[#151515] pt-3 text-xs text-[#555]">
                <Clock size={11} />
                {m.plans.length
                  ? `${m.plans.length} plan(es) · ${m.plans.map((p) => p.vigencia).join(', ')}`
                  : 'Sin plan de trabajo'}
              </div>
            </Link>
          ))}
        </div>
      )}

      {signatureOpen && <SignatureModal onClose={() => setSignatureOpen(false)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Estados compartidos
// ══════════════════════════════════════════════════════════
function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  );
}

function NoAccess() {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <ShieldOff size={28} className="mb-3 text-[#333]" />
      <h2 className="font-semibold text-white">Sin acceso</h2>
      <p className="mt-1 text-sm text-[#666]">
        El módulo de monitorías es del equipo del nodo: monitoras, enlace y administración.
      </p>
    </div>
  );
}
