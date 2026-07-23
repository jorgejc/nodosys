import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Send, Loader2,
  Calculator, CheckCircle2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { activitiesService } from '@/services/activities.service';
import { catalogsService } from '@/services/catalogs.service';

// Context injected from SessionDetailPage when creating from a session
interface SessionContext {
  sessionId: string;
  sessionNumber: number;
  sessionTopic?: string | null;
  processId: string;
  strategyId?: string | null;
  strategyName?: string | null;
}

// ── Esquema de validación ─────────────────────────────────
const schema = z.object({
  title:                        z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description:                  z.string().optional(),
  activityDate:                 z.string().min(1, 'La fecha de inicio es obligatoria'),
  endDate:                      z.string().optional(),
  location:                     z.string().optional(),
  estimatedParticipants:        z.coerce.number().min(0).optional(),
  strategyId:                   z.string().optional(),
  municipalityId:               z.string().optional(),
  resourceDetail:               z.string().optional(),
  paymentType:                  z.enum(['anticipado', 'reembolso']).optional(),
  hasElectronicInvoiceProvider: z.boolean().default(false),
  requiresFood:                 z.boolean().default(false),
  foodAmount:                   z.coerce.number().min(0).optional(),
  requiresTransport:            z.boolean().default(false),
  transportAmount:              z.coerce.number().min(0).optional(),
  requiresAccommodation:        z.boolean().default(false),
  accommodationAmount:          z.coerce.number().min(0).optional(),
  requiresMaterials:            z.boolean().default(false),
  materialsAmount:              z.coerce.number().min(0).optional(),
  requiresOther:                z.boolean().default(false),
  otherDescription:             z.string().optional(),
  otherAmount:                  z.coerce.number().min(0).optional(),
  requiresAdvance:              z.boolean().default(false),
  advanceAmount:                z.coerce.number().min(0).optional(),
});

type FormData = z.infer<typeof schema>;

// ── Toast ─────────────────────────────────────────────────
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

function friendlyError(message: string): string {
  const map: Record<string, string> = {
    'Unauthorized':         'Tu sesión expiró. Inicia sesión nuevamente.',
    'Bad Request':          'Verifica los datos del formulario e intenta de nuevo.',
    'Internal Server Error':'Hubo un problema en el servidor. Intenta en unos segundos.',
    'Network Error':        'Sin conexión. Verifica tu internet.',
  };
  for (const [key, friendly] of Object.entries(map)) {
    if (message.includes(key)) return friendly;
  }
  return message || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

// ── Página principal ──────────────────────────────────────
export default function NewActivityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionCtx = location.state as SessionContext | null;
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);

  const showToast = (msg: string, type: ToastType) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const muniQ = useQuery({
    queryKey: ['municipalities'],
    queryFn:  catalogsService.getMunicipalities,
  });

  const stratQ = useQuery({
    queryKey: ['strategies'],
    queryFn:  catalogsService.getStrategies,
    enabled:  !sessionCtx, // solo se necesita para actividades sueltas
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      requiresFood: false, requiresTransport: false,
      requiresAccommodation: false, requiresMaterials: false,
      requiresOther: false, requiresAdvance: false,
      estimatedParticipants: 0,
      hasElectronicInvoiceProvider: false,
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

  // "Usar datos de actividad anterior" — preload resource fields from last activity for this process
  async function handleLoadPrev() {
    if (!sessionCtx?.processId) return;
    setLoadingPrev(true);
    try {
      const prev = await activitiesService.getLastForProcess(sessionCtx.processId) as Record<string, unknown> | null;
      if (!prev) { showToast('No hay actividades anteriores en este proceso.', 'warning'); return; }
      if (prev.municipalityId)               setValue('municipalityId', String(prev.municipalityId));
      if (prev.resourceDetail)               setValue('resourceDetail', String(prev.resourceDetail));
      if (prev.paymentType)                  setValue('paymentType', prev.paymentType as 'anticipado' | 'reembolso');
      if (prev.hasElectronicInvoiceProvider) setValue('hasElectronicInvoiceProvider', Boolean(prev.hasElectronicInvoiceProvider));
      if (prev.requiresFood) {
        setValue('requiresFood', true);
        setValue('foodAmount', Number(prev.foodAmount ?? 0));
      }
      if (prev.requiresTransport) {
        setValue('requiresTransport', true);
        setValue('transportAmount', Number(prev.transportAmount ?? 0));
      }
      if (prev.requiresAccommodation) {
        setValue('requiresAccommodation', true);
        setValue('accommodationAmount', Number(prev.accommodationAmount ?? 0));
      }
      if (prev.requiresMaterials) {
        setValue('requiresMaterials', true);
        setValue('materialsAmount', Number(prev.materialsAmount ?? 0));
      }
      if (prev.requiresOther) {
        setValue('requiresOther', true);
        setValue('otherAmount', Number(prev.otherAmount ?? 0));
        if (prev.otherDescription) setValue('otherDescription', String(prev.otherDescription));
      }
      showToast('Datos de la actividad anterior precargados.', 'success');
    } catch {
      showToast('No se pudieron cargar los datos anteriores.', 'error');
    } finally {
      setLoadingPrev(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: async ({ formData, submitNow }: { formData: FormData; submitNow: boolean }) => {
      const payload: Record<string, unknown> = {
        title:                        formData.title,
        activityDate:                 formData.activityDate,
        hasElectronicInvoiceProvider: formData.hasElectronicInvoiceProvider ?? false,
        requiresFood:                 formData.requiresFood ?? false,
        foodAmount:                   formData.requiresFood ? Number(formData.foodAmount ?? 0) : 0,
        requiresTransport:            formData.requiresTransport ?? false,
        transportAmount:              formData.requiresTransport ? Number(formData.transportAmount ?? 0) : 0,
        requiresAccommodation:        formData.requiresAccommodation ?? false,
        accommodationAmount:          formData.requiresAccommodation ? Number(formData.accommodationAmount ?? 0) : 0,
        requiresMaterials:            formData.requiresMaterials ?? false,
        materialsAmount:              formData.requiresMaterials ? Number(formData.materialsAmount ?? 0) : 0,
        requiresOther:                formData.requiresOther ?? false,
        otherAmount:                  formData.requiresOther ? Number(formData.otherAmount ?? 0) : 0,
        requiresAdvance:              formData.requiresAdvance ?? false,
        advanceAmount:                formData.requiresAdvance ? Number(formData.advanceAmount ?? 0) : 0,
      };

      if (formData.description?.trim())     payload.description     = formData.description.trim();
      if (formData.location?.trim())        payload.location        = formData.location.trim();
      if (formData.endDate?.trim())         payload.endDate         = formData.endDate.trim();
      if (formData.otherDescription?.trim())payload.otherDescription= formData.otherDescription.trim();
      if (formData.estimatedParticipants)   payload.estimatedParticipants = Number(formData.estimatedParticipants);
      if (formData.municipalityId)          payload.municipalityId  = formData.municipalityId;
      if (formData.resourceDetail?.trim())  payload.resourceDetail  = formData.resourceDetail.trim();
      if (formData.paymentType)             payload.paymentType     = formData.paymentType;

      // Inject session context if coming from a session
      if (sessionCtx?.sessionId)  payload.sessionId  = sessionCtx.sessionId;
      // Strategy: inherited from session/process OR chosen in form for loose activities
      if (sessionCtx?.strategyId) {
        payload.strategyId = sessionCtx.strategyId;
      } else if (formData.strategyId) {
        payload.strategyId = formData.strategyId;
      }

      const created = await activitiesService.create(payload) as { id: string };
      if (submitNow) await activitiesService.submit(created.id);
      return created;
    },
    onSuccess: (_created, vars) => {
      const msg = vars.submitNow
        ? '¡Solicitud enviada para aprobación!'
        : 'Borrador guardado correctamente.';
      showToast(msg, 'success');
      const backPath = sessionCtx?.processId
        ? `/procesos/${sessionCtx.processId}`
        : '/actividades';
      setTimeout(() => navigate(backPath), 1200);
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

  const backPath = sessionCtx?.processId ? `/procesos/${sessionCtx.processId}` : '/actividades';

  return (
    <div className="max-w-2xl space-y-6 pb-10">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <button onClick={() => navigate(backPath)}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors">
        <ArrowLeft size={16} /> {sessionCtx?.processId ? 'Volver al proceso' : 'Volver a solicitudes'}
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// NUEVA SOLICITUD</p>
          <h1 className="text-2xl font-bold text-white">Solicitud de Recursos</h1>
          <p className="text-[#666] text-sm mt-1">
            Completa los datos. Guarda como borrador o envía para aprobación.
          </p>
        </div>
        {sessionCtx?.processId && (
          <button
            type="button"
            onClick={handleLoadPrev}
            disabled={loadingPrev}
            className="flex items-center gap-1.5 text-xs bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] hover:text-white disabled:opacity-50 px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            {loadingPrev ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Usar datos anteriores
          </button>
        )}
      </div>

      {/* Contexto de sesión (readonly) */}
      {sessionCtx && (
        <div className="bg-[#FF6B2B]/5 border border-[#FF6B2B]/20 rounded-xl px-5 py-4 space-y-1">
          <p className="text-xs text-[#FF6B2B] uppercase tracking-widest font-mono">// VINCULADA A SESIÓN</p>
          <p className="text-sm text-white font-medium">
            Sesión {sessionCtx.sessionNumber}{sessionCtx.sessionTopic ? ` — ${sessionCtx.sessionTopic}` : ''}
          </p>
          {sessionCtx.strategyName && (
            <p className="text-xs text-[#888]">Estrategia: {sessionCtx.strategyName}</p>
          )}
        </div>
      )}

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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Lugar / Institución</label>
              <input {...register('location')} placeholder="IER El Caníme, Arboletes" className={inp} />
            </div>
            <div>
              <label className={lbl}>N° participantes esperados</label>
              <input {...register('estimatedParticipants')} type="number" min={0} className={inp} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Municipio</label>
              <select {...register('municipalityId')} className={inp}>
                <option value="">— Selecciona municipio —</option>
                {(muniQ.data ?? []).map(m => (
                  <option key={m.id} value={m.id}>{m.name}{m.department ? ` (${m.department})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Estrategia</label>
              {sessionCtx ? (
                /* Actividad de sesión: heredada del proceso, solo lectura */
                <div className={`${inp} flex items-center gap-2`}>
                  {sessionCtx.strategyName
                    ? <><span className="text-[#FF6B2B] text-xs">●</span><span>{sessionCtx.strategyName}</span></>
                    : <span className="text-[#444] italic text-xs">Sin estrategia asignada al proceso</span>
                  }
                </div>
              ) : (
                /* Actividad suelta: elige del catálogo */
                <select {...register('strategyId')} className={inp}>
                  <option value="">— Sin estrategia —</option>
                  {(stratQ.data ?? []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Detalle de necesidad */}
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 space-y-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">// DETALLE DE LA NECESIDAD</p>

          <div>
            <label className={lbl}>Describe los recursos requeridos</label>
            <textarea {...register('resourceDetail')} rows={4} className={`${inp} resize-none`}
              placeholder="Ej: 30 refrigerios a $8.000 c/u, 2 remas de papel, transporte por $120.000..." />
            <p className="text-xs text-[#444] mt-1">Incluye cantidades, unidades y costos estimados.</p>
          </div>

          {/* Tipo de pago */}
          <div>
            <label className={lbl}>Modalidad de pago</label>
            <div className="flex gap-3">
              {(['anticipado', 'reembolso'] as const).map(pt => (
                <label key={pt} className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  watched.paymentType === pt
                    ? 'border-[#FF6B2B]/40 bg-[#FF6B2B]/5 text-white'
                    : 'border-[#2A2A2A] text-[#666] hover:border-[#444]'
                }`}>
                  <input type="radio" value={pt} {...register('paymentType')} className="accent-[#FF6B2B]" />
                  <span className="text-sm font-medium capitalize">{pt}</span>
                  <span className="text-xs text-[#555] ml-auto">
                    {pt === 'anticipado' ? 'Avance previo' : 'Pago post-actividad'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Factura electrónica */}
          <div
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              watched.hasElectronicInvoiceProvider
                ? 'border-[#FF6B2B]/30 bg-[#FF6B2B]/5'
                : 'border-[#2A2A2A]'
            }`}
            onClick={() => setValue('hasElectronicInvoiceProvider', !watched.hasElectronicInvoiceProvider)}
          >
            <input
              type="checkbox"
              checked={!!watched.hasElectronicInvoiceProvider}
              onChange={() => setValue('hasElectronicInvoiceProvider', !watched.hasElectronicInvoiceProvider)}
              className="accent-[#FF6B2B] w-4 h-4 cursor-pointer"
            />
            <div>
              <p className={`text-sm font-medium ${watched.hasElectronicInvoiceProvider ? 'text-white' : 'text-[#666]'}`}>
                Proveedor con factura electrónica
              </p>
              <p className="text-xs text-[#555]">El proveedor puede emitir factura electrónica</p>
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
          Al enviar, la solicitud queda en estado "Pendiente" hasta que el administrador la revise.
        </p>
      </div>
    </div>
  );
}
