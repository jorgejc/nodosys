import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { processesService } from '@/services/processes.service';
import { workPlanService } from '@/services/workplan.service';

const schema = z.object({
  name:            z.string().min(2, 'Mínimo 2 caracteres').max(300),
  description:     z.string().optional(),
  type:            z.enum(['curso', 'club', 'taller', 'proceso']),
  status:          z.enum(['activo', 'finalizado']).optional(),
  workPlanTaskId:  z.string().uuid('UUID inválido').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function ProcesoFormPage() {
  const navigate   = useNavigate();
  const { id }     = useParams<{ id: string }>();
  const qc         = useQueryClient();
  const isEdit     = !!id;

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'proceso' },
  });

  // Pre-cargar datos al editar
  const existing = useQuery({
    queryKey: ['process', id],
    queryFn:  () => processesService.getById(id!),
    enabled:  isEdit,
  });

  useEffect(() => {
    if (existing.data) {
      reset({
        name:           existing.data.name,
        description:    existing.data.description ?? '',
        type:           existing.data.type,
        status:         existing.data.status,
        workPlanTaskId: existing.data.workPlanTaskId ?? '',
      });
    }
  }, [existing.data, reset]);

  // Tareas del plan de trabajo para el selector
  const tasksQ = useQuery({
    queryKey: ['workplan-my-tasks'],
    queryFn:  workPlanService.getMyTasks,
  });

  const tasks: { id: string; label: string }[] = tasksQ.data ?? [];

  const createM = useMutation({
    mutationFn: (data: FormData) =>
      processesService.create({
        name:           data.name,
        description:    data.description || undefined,
        type:           data.type,
        workPlanTaskId: data.workPlanTaskId || undefined,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['processes'] });
      navigate(`/procesos/${created.id}`);
    },
  });

  const updateM = useMutation({
    mutationFn: (data: FormData) =>
      processesService.update(id!, {
        name:           data.name,
        description:    data.description || undefined,
        type:           data.type,
        status:         data.status,
        workPlanTaskId: data.workPlanTaskId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processes'] });
      qc.invalidateQueries({ queryKey: ['process', id] });
      navigate(`/procesos/${id}`);
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) updateM.mutate(data);
    else        createM.mutate(data);
  };

  const error = createM.error ?? updateM.error;
  const busy  = isSubmitting || createM.isPending || updateM.isPending;

  if (isEdit && existing.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(isEdit ? `/procesos/${id}` : '/procesos')}
          className="p-2 text-[#555] hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-white font-bold text-lg">
            {isEdit ? 'Editar proceso' : 'Nuevo proceso'}
          </h1>
          <p className="text-[#555] text-xs mt-0.5">
            {isEdit ? 'Modifica los datos del proceso' : 'Crea un curso, club, taller o proceso formativo'}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6 space-y-5">

          {/* Nombre */}
          <div>
            <label className="block text-xs text-[#888] mb-1.5 font-medium uppercase tracking-wide">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              {...register('name')}
              placeholder="Ej: Club de Robótica Educativa"
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#444] focus:outline-none focus:border-[#FF6B2B]/50 transition-colors"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs text-[#888] mb-1.5 font-medium uppercase tracking-wide">
              Descripción
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Descripción breve del proceso o iniciativa formativa"
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#444] focus:outline-none focus:border-[#FF6B2B]/50 transition-colors resize-none"
            />
          </div>

          {/* Tipo + Estado (en fila) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#888] mb-1.5 font-medium uppercase tracking-wide">
                Tipo <span className="text-red-400">*</span>
              </label>
              <select
                {...register('type')}
                className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B2B]/50 transition-colors"
              >
                <option value="proceso">Proceso</option>
                <option value="curso">Curso</option>
                <option value="club">Club</option>
                <option value="taller">Taller</option>
              </select>
            </div>

            {isEdit && (
              <div>
                <label className="block text-xs text-[#888] mb-1.5 font-medium uppercase tracking-wide">
                  Estado
                </label>
                <select
                  {...register('status')}
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B2B]/50 transition-colors"
                >
                  <option value="activo">Activo</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
            )}
          </div>

          {/* Tarea del plan de trabajo (opcional) */}
          <div>
            <label className="block text-xs text-[#888] mb-1.5 font-medium uppercase tracking-wide">
              Vincular a tarea del plan de trabajo
              <span className="text-[#444] normal-case ml-1">(opcional)</span>
            </label>
            <select
              {...register('workPlanTaskId')}
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B2B]/50 transition-colors"
            >
              <option value="">Sin vincular</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            {errors.workPlanTaskId && (
              <p className="text-red-400 text-xs mt-1">{errors.workPlanTaskId.message}</p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {(error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al guardar el proceso'}
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55a1f] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? 'Guardar cambios' : 'Crear proceso'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/procesos/${id}` : '/procesos')}
            className="text-[#555] hover:text-white text-sm transition-colors px-3 py-2.5"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
