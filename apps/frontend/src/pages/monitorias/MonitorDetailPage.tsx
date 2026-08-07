/**
 * MonitorDetailPage.tsx — El enlace entra al plan de una monitora
 *
 * Ve el plan completo y las evidencias, puede autorizar semanas por encima
 * del tope y genera el certificado de horas para el trámite de pago.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, FileText, PenLine, GraduationCap, ShieldOff,
} from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { useAuth } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/utils/apiError';
import PlanView from '@/components/monitorias/PlanView';
import CertificateModal from '@/components/monitorias/CertificateModal';
import SignatureModal from '@/components/monitorias/SignatureModal';

export default function MonitorDetailPage() {
  const { monitorId } = useParams<{ monitorId: string }>();
  const { canManageMonitorias, canSignCertificates } = useAuth();

  const [certificateOpen, setCertificateOpen] = useState(false);
  const [signatureOpen,   setSignatureOpen]   = useState(false);

  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['monitor-plan', monitorId],
    queryFn:  () => monitorsService.getMonitorPlan(monitorId!),
    enabled:  !!monitorId && canManageMonitorias,
  });

  const { data: signature } = useQuery({
    queryKey: ['my-signature'],
    queryFn:  monitorsService.getMySignature,
    enabled:  canSignCertificates,
  });

  if (!canManageMonitorias) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <ShieldOff size={28} className="mb-3 text-[#333]" />
        <h2 className="font-semibold text-white">Sin acceso</h2>
        <p className="mt-1 text-sm text-[#666]">
          Solo el enlace del nodo puede consultar el plan de una monitora.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {apiErrorMessage(error, 'Esta monitora aún no tiene plan de trabajo')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono text-[#555]">
            <GraduationCap size={13} /> MONITORÍA · VIGENCIA {plan.vigencia}
          </div>
          <h1 className="mt-1 truncate text-2xl font-bold text-white">
            {plan.monitor?.name ?? 'Monitor(a)'}
          </h1>
          <p className="mt-1 text-sm text-[#666]">
            {[
              plan.monitor?.program,
              plan.monitor?.documentNumber
                ? `${plan.monitor.documentType ?? 'CC'} ${plan.monitor.documentNumber}`
                : null,
              plan.monitor?.nodoName ? `Nodo ${plan.monitor.nodoName}` : null,
            ].filter(Boolean).join(' · ') || plan.monitor?.email}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canSignCertificates && !signature?.signatureUrl && (
            <button onClick={() => setSignatureOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-4 py-2.5 text-sm font-medium text-[#888] transition-colors hover:border-[#FF6B2B]/40 hover:text-[#FF6B2B]">
              <PenLine size={14} /> Subir mi firma
            </button>
          )}
          {canSignCertificates && (
            <button onClick={() => setCertificateOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#FF6B2B] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
              <FileText size={14} /> Generar certificado de horas
            </button>
          )}
        </div>
      </header>

      {/* El enlace puede editar y autorizar semanas por encima del tope */}
      <PlanView plan={plan} canEdit={canManageMonitorias} canOverride={canSignCertificates} />

      {certificateOpen && (
        <CertificateModal
          plan={plan}
          hasSignature={!!signature?.signatureUrl}
          onClose={() => setCertificateOpen(false)}
        />
      )}
      {signatureOpen && <SignatureModal onClose={() => setSignatureOpen(false)} />}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/monitorias"
      className="inline-flex items-center gap-1.5 text-sm text-[#666] transition-colors hover:text-white">
      <ArrowLeft size={14} /> Monitoras del nodo
    </Link>
  );
}
