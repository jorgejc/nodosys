/**
 * CertificateModal.tsx — Generar el certificado de horas para pago
 *
 * El enlace elige el rango de semanas; el backend suma las horas de ese
 * rango y arma el PDF con su firma. Aquí se consulta el total antes de
 * generar para que pueda revisarlo.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { apiErrorMessage } from '@/utils/apiError';
import type { MonitorWorkPlan } from '@/types';

interface Props {
  plan:         MonitorWorkPlan;
  hasSignature: boolean;
  onClose:      () => void;
}

export default function CertificateModal({ plan, hasSignature, onClose }: Props) {
  const weekNumbers = plan.weeks.map((w) => w.weekNumber);
  const [from, setFrom] = useState(weekNumbers.length ? Math.min(...weekNumbers) : 1);
  const [to,   setTo]   = useState(weekNumbers.length ? Math.max(...weekNumbers) : 1);
  const [observaciones, setObservaciones] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const validRange = from <= to;

  // Total del rango: lo calcula el backend, que es el que certifica
  const { data: range, isFetching } = useQuery({
    queryKey: ['monitor-hours', plan.id, from, to],
    queryFn:  () => monitorsService.getHours(plan.id, from, to),
    enabled:  validRange,
  });

  const generate = async () => {
    setError('');
    if (!validRange) return setError('La semana inicial no puede ser mayor que la final.');
    setGenerating(true);
    try {
      await monitorsService.downloadCertificate(
        plan.id, from, to, observaciones, plan.monitor?.name,
      );
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-5 py-4">
          <h3 className="flex items-center gap-2 text-white font-semibold text-sm">
            <FileText size={15} className="text-[#FF6B2B]" /> Certificado de horas
          </h3>
          <button onClick={onClose} className="p-1 text-[#555] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2.5 text-xs text-[#888]">
            <span className="text-white">{plan.monitor?.name ?? 'Monitor(a)'}</span>
            {plan.monitor?.program && <> · {plan.monitor.program}</>}
            <> · vigencia {plan.vigencia}</>
          </div>

          {!hasSignature && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Aún no has registrado tu firma. El certificado se generará con la
                línea en blanco para firmar a mano.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Desde la semana</label>
              <input
                type="number" min={1} max={60} value={from}
                onChange={(e) => setFrom(Number(e.target.value))}
                className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Hasta la semana</label>
              <input
                type="number" min={1} max={60} value={to}
                onChange={(e) => setTo(Number(e.target.value))}
                className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
              />
            </div>
          </div>

          {/* Total que se va a certificar */}
          <div className="rounded-lg border border-[#FF6B2B]/30 bg-[#FF6B2B]/5 px-4 py-3">
            <div className="text-xs text-[#888]">Horas a certificar</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              {isFetching ? (
                <Loader2 size={18} className="animate-spin text-[#FF6B2B]" />
              ) : (
                <>
                  <span className="text-2xl font-bold text-[#FF6B2B]">
                    {validRange ? (range?.totalHours ?? 0) : '—'}
                  </span>
                  <span className="text-xs text-[#888]">
                    horas · {range?.weeks.length ?? 0} semana(s) con actividades
                  </span>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              Observaciones <span className="text-[#555]">(opcional, salen en el certificado)</span>
            </label>
            <textarea
              rows={3} maxLength={1500} value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Anotaciones para el trámite de pago"
              className="w-full resize-none rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            />
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
          <button onClick={generate} disabled={generating || !validRange}
            className="flex items-center gap-2 rounded-lg bg-[#FF6B2B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {generating ? 'Generando...' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
