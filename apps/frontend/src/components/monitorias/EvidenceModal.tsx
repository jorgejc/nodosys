/**
 * EvidenceModal.tsx — Registrar una evidencia sobre una TAREA
 *
 * No se sube el archivo: se pega el enlace (Drive, OneDrive, etc.). La
 * evidencia queda asociada a la tarea concreta que documenta.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, Paperclip } from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { apiErrorMessage } from '@/utils/apiError';

interface Props {
  planId:       string;
  activityId:   string;
  activityLabel?: string;   // descripción corta de la tarea (contexto)
  onClose:      () => void;
}

export default function EvidenceModal({ planId, activityId, activityLabel, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fileUrl: '', caption: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => monitorsService.addEvidence(planId, {
      activityId,
      fileUrl: form.fileUrl.trim(),
      caption: form.caption.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitor-plan'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = () => {
    setError('');
    if (!/^https?:\/\//i.test(form.fileUrl.trim())) {
      return setError('Pega un enlace que empiece por http:// o https://');
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Paperclip size={15} className="text-[#38BDF8]" /> Nueva evidencia
          </h3>
          <button onClick={onClose} className="p-1 text-[#555] transition-colors hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {activityLabel && (
            <div className="rounded-lg border border-[#1E1E1E] bg-[#141414] px-3 py-2 text-xs text-[#888]">
              Evidencia para: <span className="text-[#DDD]">{activityLabel}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">Enlace de la evidencia</label>
            <input
              value={form.fileUrl} autoFocus
              onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
              placeholder="https://drive.google.com/..."
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#FF6B2B]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              Descripción <span className="text-[#555]">(opcional)</span>
            </label>
            <input
              value={form.caption} maxLength={300}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              placeholder="Registro fotográfico del taller"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#FF6B2B]"
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
          <button onClick={submit} disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[#FF6B2B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
