/**
 * AuxEvidenceModal.tsx — Adjuntar una evidencia
 *
 * No se sube el archivo: se pega el enlace (Drive, OneDrive...). El
 * backend valida que sea una URL http(s). La evidencia cuelga de una
 * actividad concreta del dia.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Paperclip, Loader2 } from 'lucide-react';
import { auxiliaryService } from '@/services/auxiliary.service';
import { apiErrorMessage } from '@/utils/apiError';

interface Props {
  activityId: string;
  label:      string;
  onClose:    () => void;
}

export default function AuxEvidenceModal({ activityId, label, onClose }: Props) {
  const qc = useQueryClient();
  const [fileUrl, setFileUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      auxiliaryService.addEvidence({
        activityId,
        fileUrl: fileUrl.trim(),
        caption: caption.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auxiliary-days'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = () => {
    setError('');
    const url = fileUrl.trim();
    if (!url) return setError('Pega el enlace de la evidencia.');
    if (!/^https?:\/\//i.test(url)) {
      return setError('El enlace debe empezar por http:// o https://');
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Paperclip size={15} className="text-[#FF6B2B]" /> Adjuntar evidencia
          </h3>
          <button onClick={onClose} className="p-1 text-[#555] transition-colors hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2.5 text-xs text-[#888]">
            Se adjuntará a: <span className="text-white">{label}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">Enlace del archivo</label>
            <input
              type="url" value={fileUrl} maxLength={1000}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            />
            <p className="mt-1.5 text-xs text-[#555]">
              Sube el archivo a Drive y pega aquí el enlace para compartir.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">
              Descripción <span className="text-[#555]">(opcional)</span>
            </label>
            <input
              type="text" value={caption} maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ej. Planilla de asistencia firmada"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
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
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
            {mutation.isPending ? 'Adjuntando...' : 'Adjuntar'}
          </button>
        </div>
      </div>
    </div>
  );
}
