import { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { sessionsService } from '@/services/sessions.service';
import { processesService } from '@/services/processes.service';

// ── Schema ────────────────────────────────────────────────
const momentSchema = z.object({
  objective:       z.string().optional(),
  methodology:     z.string().optional(),
  materials:       z.string().optional(),
  durationMinutes: z.coerce.number().int().min(1).optional().or(z.literal(undefined)),
});

const schema = z.object({
  date:                 z.string().min(1, 'La fecha es obligatoria'),
  startTime:            z.string().optional(),
  endTime:              z.string().optional(),
  topic:                z.string().max(300).optional(),
  location:             z.string().max(300).optional(),
  totalRegistered:      z.coerce.number().int().min(0).optional(),
  experience:           z.string().optional(),
  // Investigación
  temaTecnico:          z.string().max(500).optional(),
  herramientaSimulador: z.string().max(300).optional(),
  desarrollo:           z.string().optional(),
  resultados:           z.string().optional(),
  // Momentos (solo para tres_momentos)
  explorar:             momentSchema,
  crear:                momentSchema,
  consolidar:           momentSchema,
});

type FormData = z.infer<typeof schema>;

// ── Subcomponente: sección de un momento ─────────────────
const MOMENT_META = {
  explorar:    { label: 'Momento 1 — Explorar',   color: 'text-blue-400',   border: 'border-blue-400/20',   bg: 'bg-blue-400/5',   desc: 'Activación de saberes previos y diagnóstico inicial' },
  crear:       { label: 'Momento 2 — Crear',       color: 'text-green-400',  border: 'border-green-400/20',  bg: 'bg-green-400/5',  desc: 'Desarrollo de la actividad, práctica y construcción' },
  consolidar:  { label: 'Momento 3 — Consolidar',  color: 'text-purple-400', border: 'border-purple-400/20', bg: 'bg-purple-400/5', desc: 'Cierre, reflexión, evaluación y compromisos' },
} as const;

type MomentKey = keyof typeof MOMENT_META;

function MomentSection({ name, register, errors }: {
  name: MomentKey;
  register: ReturnType<typeof useForm<FormData>>['register'];
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors'];
}) {
  const meta = MOMENT_META[name];
  const fieldErrors = errors[name];

  return (
    <div className={`border ${meta.border} ${meta.bg} rounded-xl p-5 space-y-4`}>
      <div>
        <h3 className={`font-semibold text-sm ${meta.color}`}>{meta.label}</h3>
        <p className="text-xs text-[#555] mt-0.5">{meta.desc}</p>
      </div>

      <div>
        <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Objetivo</label>
        <textarea
          {...register(`${name}.objective`)}
          rows={2}
          placeholder="¿Qué se espera lograr en este momento?"
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B] resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Metodología / Estrategia</label>
        <textarea
          {...register(`${name}.methodology`)}
          rows={2}
          placeholder="¿Cómo se desarrolla? Técnica, dinámica o estrategia pedagógica..."
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B] resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Materiales / Recursos</label>
          <textarea
            {...register(`${name}.materials`)}
            rows={2}
            placeholder="Materiales, herramientas, equipos..."
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B] resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Duración (min)</label>
          <input
            {...register(`${name}.durationMinutes`)}
            type="number"
            min={1}
            placeholder="30"
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
          />
          {fieldErrors?.durationMinutes && (
            <p className="text-red-400 text-xs mt-1">{fieldErrors.durationMinutes.message as string}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function SessionFormPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const location     = useLocation();
  const navigate     = useNavigate();
  const qc           = useQueryClient();
  const isEditing    = !!sid;

  // Detecta contexto: ¿venimos de /procesos/ o /actividades/?
  const isProcessContext = location.pathname.startsWith('/procesos/');
  const processId        = isProcessContext ? id : undefined;
  const activityId       = isProcessContext ? undefined : id;
  const backPath         = isProcessContext ? `/procesos/${id}` : `/actividades/${id}`;

  // Cargar sesión existente si es edición
  const existingQ = useQuery({
    queryKey: ['session', sid],
    queryFn: () => sessionsService.getById(sid!),
    enabled: isEditing,
  });

  // Determinar el processId efectivo (para edición, leer de la sesión)
  const effectiveProcessId = isEditing
    ? existingQ.data?.processId ?? undefined
    : processId;

  // Cargar el proceso padre para conocer la plantilla de sesión
  const processQ = useQuery({
    queryKey: ['process-template', effectiveProcessId],
    queryFn: () => processesService.getById(effectiveProcessId!),
    enabled: !!effectiveProcessId,
  });

  const sessionTemplate = processQ.data?.sessionTemplate ?? 'tres_momentos';
  const isTresMomentos  = sessionTemplate === 'tres_momentos';
  const isInvestigacion = sessionTemplate === 'investigacion';

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      totalRegistered: 0,
      explorar: {}, crear: {}, consolidar: {},
    },
  });

  // Poblar el form cuando carga la sesión existente
  useEffect(() => {
    if (existingQ.data) {
      const s = existingQ.data;
      const getM = (type: string) => s.moments.find((m) => m.momentType === type);
      reset({
        date:                 s.date,
        startTime:            s.startTime ?? '',
        endTime:              s.endTime ?? '',
        topic:                s.topic ?? '',
        location:             s.location ?? '',
        totalRegistered:      s.totalRegistered,
        experience:           s.experience ?? '',
        temaTecnico:          s.temaTecnico ?? '',
        herramientaSimulador: s.herramientaSimulador ?? '',
        desarrollo:           s.desarrollo ?? '',
        resultados:           s.resultados ?? '',
        explorar: {
          objective:       getM('explorar')?.objective       ?? '',
          methodology:     getM('explorar')?.methodology     ?? '',
          materials:       getM('explorar')?.materials       ?? '',
          durationMinutes: getM('explorar')?.durationMinutes ?? undefined,
        },
        crear: {
          objective:       getM('crear')?.objective       ?? '',
          methodology:     getM('crear')?.methodology     ?? '',
          materials:       getM('crear')?.materials       ?? '',
          durationMinutes: getM('crear')?.durationMinutes ?? undefined,
        },
        consolidar: {
          objective:       getM('consolidar')?.objective       ?? '',
          methodology:     getM('consolidar')?.methodology     ?? '',
          materials:       getM('consolidar')?.materials       ?? '',
          durationMinutes: getM('consolidar')?.durationMinutes ?? undefined,
        },
      });
    }
  }, [existingQ.data, reset]);

  const buildPayload = (data: FormData) => {
    const base = {
      date:            data.date,
      startTime:       data.startTime  || undefined,
      endTime:         data.endTime    || undefined,
      topic:           data.topic      || undefined,
      location:        data.location   || undefined,
      totalRegistered: data.totalRegistered,
      experience:      data.experience || undefined,
    };

    if (isTresMomentos) {
      return {
        ...base,
        moments: [
          { momentType: 'explorar'   as const, ...cleanMoment(data.explorar)   },
          { momentType: 'crear'      as const, ...cleanMoment(data.crear)      },
          { momentType: 'consolidar' as const, ...cleanMoment(data.consolidar) },
        ],
      };
    }

    if (isInvestigacion) {
      return {
        ...base,
        temaTecnico:          data.temaTecnico          || undefined,
        herramientaSimulador: data.herramientaSimulador || undefined,
        desarrollo:           data.desarrollo           || undefined,
        resultados:           data.resultados           || undefined,
      };
    }

    // descripcion_libre
    return base;
  };

  const createM = useMutation({
    mutationFn: (data: FormData) =>
      isProcessContext
        ? sessionsService.createForProcess(processId!, buildPayload(data))
        : sessionsService.create(activityId!, buildPayload(data)),
    onSuccess: (session) => {
      if (isProcessContext) {
        qc.invalidateQueries({ queryKey: ['sessions', 'process', processId] });
        navigate(`/procesos/${processId}/sesiones/${session.id}`);
      } else {
        qc.invalidateQueries({ queryKey: ['sessions', activityId] });
        navigate(`/actividades/${activityId}/sesiones/${session.id}`);
      }
    },
  });

  const updateM = useMutation({
    mutationFn: (data: FormData) => sessionsService.update(sid!, buildPayload(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sid] });
      const s = existingQ.data;
      if (s?.processId) {
        qc.invalidateQueries({ queryKey: ['sessions', 'process', s.processId] });
        navigate(`/procesos/${s.processId}/sesiones/${sid}`);
      } else {
        qc.invalidateQueries({ queryKey: ['sessions', s?.activityId] });
        navigate(`/actividades/${s?.activityId}/sesiones/${sid}`);
      }
    },
  });

  const mutation = isEditing ? updateM : createM;

  const isLoading = (isEditing && existingQ.isLoading) || (!!effectiveProcessId && processQ.isLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  const templateLabel =
    sessionTemplate === 'tres_momentos'     ? 'Tres momentos pedagógicos' :
    sessionTemplate === 'investigacion'      ? 'Investigación' :
    'Descripción libre';

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <button
        onClick={() => navigate(isEditing && existingQ.data?.processId
          ? `/procesos/${existingQ.data.processId}`
          : backPath
        )}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> {isProcessContext ? 'Volver al proceso' : 'Volver a la actividad'}
      </button>

      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">
          {isEditing ? '// EDITAR SESIÓN' : '// NUEVA SESIÓN'}
        </p>
        <h1 className="text-2xl font-bold text-white">
          {isEditing ? 'Editar bitácora' : 'Registrar sesión'}
        </h1>
        <p className="text-[#666] text-sm mt-1">
          Plantilla: <span className="text-[#FF6B2B]">{templateLabel}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
        {mutation.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al guardar la sesión'}
          </div>
        )}

        {/* Datos generales */}
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Datos generales</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Fecha *</label>
              <input
                {...register('date')}
                type="date"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B] [color-scheme:dark]"
              />
              {errors.date && <p className="text-red-400 text-xs mt-1">{errors.date.message}</p>}
            </div>
            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Asistentes registrados</label>
              <input
                {...register('totalRegistered')}
                type="number"
                min={0}
                placeholder="0"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Hora inicio</label>
              <input
                {...register('startTime')}
                type="time"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B] [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Hora fin</label>
              <input
                {...register('endTime')}
                type="time"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B] [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Tema de la sesión</label>
            <input
              {...register('topic')}
              placeholder="Ej: Pensamiento computacional con Scratch"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
            />
          </div>

          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Lugar</label>
            <input
              {...register('location')}
              placeholder="Ej: IER El Caníme, Sala de sistemas"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
            />
          </div>
        </div>

        {/* Tres momentos pedagógicos */}
        {isTresMomentos && (
          <>
            <MomentSection name="explorar"   register={register} errors={errors} />
            <MomentSection name="crear"      register={register} errors={errors} />
            <MomentSection name="consolidar" register={register} errors={errors} />
          </>
        )}

        {/* Campos de investigación */}
        {isInvestigacion && (
          <div className="bg-[#111] border border-amber-400/20 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-amber-400">Investigación</h2>
              <p className="text-xs text-[#555] mt-0.5">Campos específicos para sesiones de investigación</p>
            </div>

            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Tema técnico</label>
              <input
                {...register('temaTecnico')}
                placeholder="Ej: Inteligencia artificial aplicada a la educación"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
              />
            </div>

            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Herramienta / Simulador</label>
              <input
                {...register('herramientaSimulador')}
                placeholder="Ej: MIT App Inventor, Arduino, Scratch"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B]"
              />
            </div>

            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Desarrollo de la sesión</label>
              <textarea
                {...register('desarrollo')}
                rows={4}
                placeholder="Describe cómo se desarrolló la sesión, metodología aplicada..."
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B] resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Resultados</label>
              <textarea
                {...register('resultados')}
                rows={3}
                placeholder="¿Qué resultados o productos se obtuvieron?"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B] resize-none"
              />
            </div>
          </div>
        )}

        {/* Descripción / Experiencia (siempre visible) */}
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-white">
            {sessionTemplate === 'descripcion_libre' ? 'Descripción de la sesión' : 'Experiencia de la sesión'}
          </h2>
          <p className="text-xs text-[#555]">Narra cómo fue la sesión: qué ocurrió, cómo respondieron los participantes, observaciones relevantes.</p>
          <textarea
            {...register('experience')}
            rows={5}
            placeholder="La sesión comenzó con una dinámica de calentamiento... Los estudiantes mostraron interés en..."
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#FF6B2B] resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {mutation.isPending
            ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
            : <><Save size={14} /> {isEditing ? 'Guardar cambios' : 'Crear sesión'}</>
          }
        </button>
      </form>
    </div>
  );
}

function cleanMoment(m: { objective?: string; methodology?: string; materials?: string; durationMinutes?: number }) {
  return {
    objective:       m.objective       || undefined,
    methodology:     m.methodology     || undefined,
    materials:       m.materials       || undefined,
    durationMinutes: m.durationMinutes || undefined,
  };
}
