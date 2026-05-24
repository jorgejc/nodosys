/**
 * NewActivityPage.tsx — Formulario de solicitud de actividad
 *
 * Fixes:
 *  - submitNow ya NO se envía al backend (era rechazado por el DTO)
 *  - endDate vacío ya NO se envía (evita error de validación ISO 8601)
 *  - Mensajes de error más amigables para el usuario
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Loader2, Calculator, CheckCircle2, AlertTriangle } from 'lucide-react';
import { activitiesService } from '@/services/activities.service';

// ── Esquema de validación ─────────────────────────────────
const schema = z.object({
  title:                z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description:          z.string().optional(),
  activityDate:         z.string().min(1, 'La fecha de inicio es obligatoria'),
  endDate:              z.string().optional(),   // opcional, puede quedar vacío
  location:             z.string().optional(),
  expectedParticipants: z.coerce.number().min(0).optional(),
  requiresFood:         z.boolean().default(false),
  foodAmount:           z.coerce.number().min(0).optional(),
  requiresTransport:    z.boolean().default(false),
  transportAmount:      z.coerce.number().min(0).optional(),
  requiresAccommodation:z.boolean().default(false),
  accommodationAmount:  z.coerce.number().min(0).optional(),
  requiresMaterials:    z.boolean().default(false),
  materialsAmount:      z.coerce.number().min(0).optional(),
  requiresOther:        z.boolean().default(false),
  otherDescription:     z.string().optional(),
  otherAmount:          z.coerce.number().min(0).optional(),
  requiresAdvance:      z.boolean().default(false),
  advanceAmount:        z.coerce.number().min(0).optional(),
});

type FormData = z.infer<typeof schema>;

// ── Toast de notificación ─────────────────────────────────
type ToastType = 'success' | 'error' | 'warning';
function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const config = {
    success: { bg: 'bg-green-500/15 border-green-500/30', text: 'text-green-400', icon: <CheckCircle2 size={18} /> },
    error:   { bg: 'bg-red-500/15 border-red-500/30',     text: 'text-red-400',   icon: <AlertTriangle size={18} /> },
    warning: { bg: 'bg-yellow-500/15 border-yellow-500/30', text: 'text-yellow-400', icon: <AlertTriangle size={18} /> },
  };
  const c = config[type];
  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-start gap-3 px-5 py-4 rounded-xl border shadow-2xl max-w-sm ${c.bg}`}>
      <span className={`${c.text} mt-0.5 flex-shrink-0`}>{c.icon}</span>
      <div className="flex-1">
        <p className={`text-sm font-medium ${c.text}`}>{message}</p>
      </div>
      <button onClick={onClose} className={`${c.text} opacity-60 hover:opacity-100 ml-2`}>✕</button>
    </div>
  );
}

// ── Helpers de estilo ─────────────────────────────────────
const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors";
const lbl = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";

function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#555]">$</span>
      <input type="number" min={0} value={value} onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg pl-7 pr-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]" />
    </div>
  );
}

function ViaticosRow({ label, emoji, checked, onToggle, amount, onAmount }: {
  label: string; emoji: string;
  checked: boolean; onToggle: () => void;
  amount: string; onAmount: (v: string) => void;
}) {
  return (
    <div className={`rounded-xl border transition-all ${checked ? 'border-[#FF6B2B]/30 bg-[#FF6B2B]/5' : 'border-[#2A2A2A] bg-[#111]'}`}>
      <div className="flex items-center gap-3 p-4">
        <input type="checkbox" checked={checked} onChange={onToggle} className="accent-[#FF6B2B] w-4 h-4 cursor-pointer" />
        <span className="text-lg">{emoji}</span>
        <span className={`text-sm font-medium flex-1 ${checked ? 'text-white' : 'text-[#666]'}`}>{label}</span>
        {checked && (
          <div className="w-44">
            <CurrencyInput value={amount} onChange={onAmount} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mensajes de error más amigables ──────────────────────
function friendlyError(message: string): string {
  const map: Record<string, string> = {
    'Unauthorized': 'Tu sesión expiró. Inicia sesión nuevamente.',
    'Bad Request': 'Verifica los datos del formulario e intenta de nuevo.',
    'Internal Server Error': 'Hubo un problema en el servidor. Intenta en unos segundos.',
    'Network Error': 'Sin conexión. Verifica tu internet.',
  };
  for (const [key, friendly] of Object.entries(map)) {
    if (message.includes(key)) return friendly;
  }
  return message || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

// ── Página principal ──────────────────────────────────────
export default function NewActivityPage() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const showToast = (msg: string, type: ToastType) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      requiresFood: false, requiresTransport: false,
      requiresAccommodation: false, requiresMaterials: false,
      requiresOther: false, requiresAdvance: false,
      expectedParticipants: 0,
    },
  });

  const watched = watch();

  const totalEstimated = [
    watched.requiresFood          ? Number(watched.foodAmount ?? 0)          : 0,
    watched.requiresTransport     ? Number(watched.transportAmount ?? 0)     : 0,
    watched.requiresAccommodation ? Number(watched.accommodationAmount ?? 0) : 0,
    watched.requiresMaterials     ? Number(watched.materialsAmount ?? 0)     : 0,
    watched.requiresOther         ? Number(watched.otherAmount ?? 0)         : 0,
  ].reduce((s, v) => s + v, 0);

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  // ── KEY FIX: separar submitNow del payload del backend ──
  const createMutation = useMutation({
    mutationFn: async ({ formData, submitNow }: { formData: FormData; submitNow: boolean }) => {
      // Construir payload sin incluir submitNow (el backend lo rechaza)
      // y sin incluir endDate si está vacío (evita error de validación ISO 8601)
      const payload: Record<string, unknown> = {
        title:                formData.title,
        activityDate:         formData.activityDate,
        requiresFood:         formData.requiresFood ?? false,
        foodAmount:           formData.requiresFood ? Number(formData.foodAmount ?? 0) : 0,
        requiresTransport:    formData.requiresTransport ?? false,
        transportAmount:      formData.requiresTransport ? Number(formData.transportAmount ?? 0) : 0,
        requiresAccommodation:formData.requiresAccommodation ?? false,
        accommodationAmount:  formData.requiresAccommodation ? Number(formData.accommodationAmount ?? 0) : 0,
        requiresMaterials:    formData.requiresMaterials ?? false,
        materialsAmount:      formData.requiresMaterials ? Number(formData.materialsAmount ?? 0) : 0,
        requiresOther:        formData.requiresOther ?? false,
        otherAmount:          formData.requiresOther ? Number(formData.otherAmount ?? 0) : 0,
        requiresAdvance:      formData.requiresAdvance ?? false,
        advanceAmount:        formData.requiresAdvance ? Number(formData.advanceAmount ?? 0) : 0,
      };

      // Solo incluir si tienen valor (no enviar strings vacíos)
      if (formData.description?.trim())    payload.description    = formData.description.trim();
      if (formData.location?.trim())       payload.location       = formData.location.trim();
      if (formData.endDate?.trim())        payload.endDate        = formData.endDate.trim();  // ← solo si no vacío
      if (formData.otherDescription?.trim()) payload.otherDescription = formData.otherDescription.trim();
      if (formData.expectedParticipants)   payload.expectedParticipants = Number(formData.expectedParticipants);

      // Paso 1: Crear la solicitud
      const created = await activitiesService.create(payload) as { id: string };

      // Paso 2: Si el usuario quiere enviar directo, hacer submit por separado
      if (submitNow) {
        await activitiesService.submit(created.id);
      }

      return created;
    },
    onSuccess: (created, vars) => {
      if (vars.submitNow) {
        showToast('¡Solicitud enviada para aprobación! Te avisaremos cuando sea revisada.', 'success');
      } else {
        showToast('Borrador guardado correctamente.', 'success');
      }
      setTimeout(() => navigate(`/actividades`), 1200);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } }; message?: string };
      const rawMsg = Array.isArray(err.response?.data?.message)
        ? err.response!.data!.message!.join('. ')
        : (err.response?.data?.message ?? err.message ?? '');
      showToast(friendlyError(rawMsg), 'error');
    },
  });

  const onSave = (data: FormData) => createMutation.mutate({ formData: data, submitNow: false });
  const onSend = (data: FormData) => createMutation.mutate({ formData: data, submitNow: true });

  return (
    <div className="max-w-2xl space-y-6 pb-10">
      {/* Toast de notificación */}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <button onClick={() => navigate('/actividades')}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors">
        <ArrowLeft size={16} /> Volver a solicitudes
      </button>

      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// NUEVA SOLICITUD</p>
        <h1 className="text-2xl font-bold text-white">Solicitud de Actividad</h1>
        <p className="text-[#666] text-sm mt-1">
          Completa los datos. Guarda como borrador o envía para aprobación.
        </p>
      </div>

      <div className="space-y-6">
        {/* Información básica */}
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 space-y-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">// INFORMACIÓN DE LA ACTIVIDAD</p>

          <div>
            <label className={lbl}>Título de la actividad *</label>
            <input {...register('title')}
              placeholder="Ej: Capacitación Docente en Herramientas Digitales"
              className={inp} />
            {errors.title && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                <AlertTriangle size={11} /> {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label className={lbl}>Descripción del objetivo</label>
            <textarea {...register('description')} rows={3} className={`${inp} resize-none`}
              placeholder="¿Qué se va a realizar? ¿A quién va dirigida? ¿Qué impacto tiene?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha inicio *</label>
              <input {...register('activityDate')} type="date" className={inp} />
              {errors.activityDate && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> {errors.activityDate.message}
                </p>
              )}
            </div>
            <div>
              <label className={lbl}>Fecha fin <span className="text-[#444] normal-case">(opcional)</span></label>
              <input {...register('endDate')} type="date" className={inp} />
              {/* Sin error aquí porque es opcional */}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Lugar / Institución</label>
              <input {...register('location')} placeholder="IER El Caníme, Arboletes" className={inp} />
            </div>
            <div>
              <label className={lbl}>N° participantes esperados</label>
              <input {...register('expectedParticipants')} type="number" min={0} className={inp} />
            </div>
          </div>
        </div>

        {/* Viáticos */}
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono text-[#555] uppercase tracking-widest">// VIÁTICOS REQUERIDOS</p>
            <p className="text-xs text-[#555]">Marca lo que necesitas y estima el costo</p>
          </div>

          <ViaticosRow label="Alimentación / Refrigerio" emoji="🍽️"
            checked={!!watched.requiresFood}
            onToggle={() => setValue('requiresFood', !watched.requiresFood)}
            amount={String(watched.foodAmount ?? '')}
            onAmount={v => setValue('foodAmount', Number(v))} />

          <ViaticosRow label="Transporte" emoji="🚌"
            checked={!!watched.requiresTransport}
            onToggle={() => setValue('requiresTransport', !watched.requiresTransport)}
            amount={String(watched.transportAmount ?? '')}
            onAmount={v => setValue('transportAmount', Number(v))} />

          <ViaticosRow label="Hospedaje" emoji="🏨"
            checked={!!watched.requiresAccommodation}
            onToggle={() => setValue('requiresAccommodation', !watched.requiresAccommodation)}
            amount={String(watched.accommodationAmount ?? '')}
            onAmount={v => setValue('accommodationAmount', Number(v))} />

          <ViaticosRow label="Materiales e insumos" emoji="📦"
            checked={!!watched.requiresMaterials}
            onToggle={() => setValue('requiresMaterials', !watched.requiresMaterials)}
            amount={String(watched.materialsAmount ?? '')}
            onAmount={v => setValue('materialsAmount', Number(v))} />

          <ViaticosRow label="Otros gastos" emoji="📎"
            checked={!!watched.requiresOther}
            onToggle={() => setValue('requiresOther', !watched.requiresOther)}
            amount={String(watched.otherAmount ?? '')}
            onAmount={v => setValue('otherAmount', Number(v))} />

          {watched.requiresOther && (
            <div className="pl-11">
              <input {...register('otherDescription')}
                placeholder="Especifica el tipo de gasto..."
                className={inp} />
            </div>
          )}

          {/* Anticipo */}
          <div className={`rounded-xl border p-4 transition-all ${watched.requiresAdvance ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-[#2A2A2A] bg-[#111]'}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={!!watched.requiresAdvance}
                onChange={() => setValue('requiresAdvance', !watched.requiresAdvance)}
                className="accent-[#FF6B2B] w-4 h-4 cursor-pointer" />
              <span className="text-lg">💵</span>
              <div className="flex-1">
                <span className={`text-sm font-medium ${watched.requiresAdvance ? 'text-white' : 'text-[#666]'}`}>
                  Solicitar anticipo de dinero
                </span>
                <p className="text-xs text-[#555]">Para gastos que se pagan antes de la actividad</p>
              </div>
              {watched.requiresAdvance && (
                <div className="w-44">
                  <CurrencyInput value={String(watched.advanceAmount ?? '')}
                    onChange={v => setValue('advanceAmount', Number(v))} />
                </div>
              )}
            </div>
          </div>

          {/* Total estimado en tiempo real */}
          {totalEstimated > 0 && (
            <div className="flex items-center gap-2 bg-[#FF6B2B]/5 border border-[#FF6B2B]/20 rounded-lg px-4 py-3">
              <Calculator size={16} className="text-[#FF6B2B]" />
              <span className="text-sm text-white">Total estimado de viáticos:</span>
              <span className="text-[#FF6B2B] font-bold ml-auto text-sm">{formatCOP(totalEstimated)}</span>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3">
          <button type="button"
            onClick={handleSubmit(onSave)}
            disabled={createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#444] text-white text-sm font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar borrador
          </button>
          <button type="button"
            onClick={handleSubmit(onSend)}
            disabled={createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar para aprobación
          </button>
        </div>

        <p className="text-center text-xs text-[#555]">
          Al enviar, la solicitud queda en estado "Pendiente" hasta que el administrador o decano la revise.
        </p>
      </div>
    </div>
  );
}
