/**
 * SignatureModal.tsx — El enlace registra su firma (una sola vez)
 *
 * Se guarda la URL de la imagen. El backend la descarga al generar el PDF
 * (solo https, con validación de tamaño, tipo y destino), así que aquí basta
 * con exigir https y mostrar una vista previa.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, PenLine } from 'lucide-react';
import { monitorsService } from '@/services/monitors.service';
import { apiErrorMessage } from '@/utils/apiError';

export default function SignatureModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);

  const { data: current } = useQuery({
    queryKey: ['my-signature'],
    queryFn:  monitorsService.getMySignature,
  });

  useEffect(() => {
    if (current?.signatureUrl) setUrl(current.signatureUrl);
  }, [current]);

  const mutation = useMutation({
    mutationFn: () => monitorsService.updateMySignature(url.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-signature'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = () => {
    setError('');
    if (!/^https:\/\//i.test(url.trim())) {
      return setError('La firma debe ser una URL https (el certificado no acepta http).');
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-5 py-4">
          <h3 className="flex items-center gap-2 text-white font-semibold text-sm">
            <PenLine size={15} className="text-[#FF6B2B]" /> Mi firma
          </h3>
          <button onClick={onClose} className="p-1 text-[#555] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-xs leading-relaxed text-[#888]">
            Sube tu firma escaneada a un servicio con enlace público (PNG o JPG,
            fondo blanco o transparente) y pega aquí la dirección. Se reutiliza
            en todos los certificados de horas que generes.
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#888]">URL de la imagen</label>
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setPreviewFailed(false); }}
              placeholder="https://.../mi-firma.png"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            />
          </div>

          {/^https:\/\//i.test(url) && (
            <div className="rounded-lg border border-[#2A2A2A] bg-white p-3">
              {previewFailed ? (
                <p className="text-center text-xs text-[#888]">
                  No se pudo cargar la vista previa. Verifica que el enlace sea público
                  y apunte directamente al archivo de imagen.
                </p>
              ) : (
                <img
                  src={url} alt="Vista previa de la firma"
                  className="mx-auto max-h-24 object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              )}
            </div>
          )}

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
            Guardar firma
          </button>
        </div>
      </div>
    </div>
  );
}
