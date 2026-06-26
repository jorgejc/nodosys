import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { inventoryItemService, inventoryCategoryService } from '@/services/inventory.service';
import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth.store';

const GLOBAL_ROLES = ['admin', 'vicerrector_extension', 'vicerrector_academico', 'equipo_extension', 'decano', 'coordinador'];

const schema = z.object({
  name:        z.string().min(2, 'El nombre es obligatorio'),
  categoryId:  z.string().uuid('Selecciona una categoría válida'),
  nodoId:      z.string().uuid().optional(),
  brand:       z.string().optional(),
  model:       z.string().optional(),
  description: z.string().optional(),
  trackByUnit: z.boolean().default(true),
  referenceUrl: z.string().url('Introduce una URL válida').optional().or(z.literal('')),
  howToUse:     z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewInventoryItemPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isGlobalRole = GLOBAL_ROLES.includes(user?.role ?? '');

  const nodosQuery = useQuery({
    queryKey: ['nodos'],
    queryFn: () => usersService.getNodos(),
    enabled: isGlobalRole,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { trackByUnit: true },
  });

  const selectedNodoId = watch('nodoId');

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories', selectedNodoId ?? user?.nodoId],
    queryFn: () => inventoryCategoryService.getAll(isGlobalRole ? selectedNodoId : undefined),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        // Para roles globales: nodoId seleccionado; para roles nodo: el backend lo toma del JWT
        nodoId: isGlobalRole ? (data.nodoId ?? undefined) : undefined,
        referenceUrl: data.referenceUrl || undefined,
      };
      return inventoryItemService.create(payload as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      navigate('/inventario');
    },
  });

  const trackByUnit = watch('trackByUnit');

  return (
    <div className="max-w-2xl space-y-6">
      <button
        onClick={() => navigate('/inventario')}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Volver al inventario
      </button>

      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// NUEVO ÍTEM</p>
        <h1 className="text-2xl font-bold text-white">Registrar ítem en catálogo</h1>
        <p className="text-[#666] text-sm mt-1">
          El ítem es el modelo. Después agregas las unidades físicas individuales.
        </p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6 space-y-5">
        {mutation.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error al crear el ítem'}
          </div>
        )}

        {/* Selector de nodo (solo para roles globales) */}
        {isGlobalRole && (
          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">
              Nodo *
            </label>
            <select
              value={selectedNodoId ?? ''}
              onChange={(e) => {
                setValue('nodoId', e.target.value || undefined);
                setValue('categoryId', '');
              }}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B]"
            >
              <option value="">Selecciona un nodo...</option>
              {nodosQuery.data?.map((n) => (
                <option key={n.nodoId} value={n.nodoId}>{n.nodoName}</option>
              ))}
            </select>
          </div>
        )}

        {/* Nombre */}
        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">
            Nombre del ítem *
          </label>
          <input
            {...register('name')}
            placeholder="Ej: Portátil HP ProBook 440 G8"
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]"
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
        </div>

        {/* Categoría */}
        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">
            Categoría *
          </label>
          <select
            {...register('categoryId')}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B]"
          >
            <option value="">Selecciona una categoría...</option>
            {categoriesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="text-red-400 text-xs mt-1">{errors.categoryId.message}</p>}
        </div>

        {/* Marca y Modelo en fila */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Marca</label>
            <input
              {...register('brand')}
              placeholder="HP, Lenovo, Samsung..."
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]"
            />
          </div>
          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Modelo</label>
            <input
              {...register('model')}
              placeholder="ProBook 440 G8"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]"
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">Descripción</label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Uso previsto, características técnicas relevantes..."
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">
            URL de referencia
            <span className="text-[#444] normal-case ml-1">(YouTube, manual, etc. — opcional)</span>
          </label>
          <div className="relative">
            <input
              {...register('referenceUrl')}
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]"
            />
          </div>
          {errors.referenceUrl && <p className="text-red-400 text-xs mt-1">{errors.referenceUrl.message}</p>}
          <p className="text-xs text-[#444] mt-1">
            Para juegos didácticos: pega aquí el link de un video explicando cómo se juega.
          </p>
        </div>

        {/* Instrucciones de uso */}
        <div>
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-1.5">
            Instrucciones de uso
            <span className="text-[#444] normal-case ml-1">(cómo se juega, cómo se usa — opcional)</span>
          </label>
          <textarea
            {...register('howToUse')}
            rows={3}
            placeholder="Ej: Este juego se juega en equipos de 3. Primero se reparten las cartas..."
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] resize-none"
          />
        </div>

        {/* Track by unit */}
        <div className="flex items-start gap-3 p-4 bg-[#1A1A1A] rounded-lg border border-[#2A2A2A]">
          <input
            {...register('trackByUnit')}
            type="checkbox"
            id="trackByUnit"
            className="mt-0.5 accent-[#FF6B2B]"
          />
          <div>
            <label htmlFor="trackByUnit" className="text-sm text-white font-medium cursor-pointer">
              Rastrear por unidad individual
            </label>
            <p className="text-xs text-[#666] mt-0.5">
              {trackByUnit
                ? '✓ Activado: cada unidad tiene su propio serial y estado (equipos electrónicos)'
                : '✗ Desactivado: solo cantidad total (sillas, mesas, materiales consumibles)'}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          className="w-full bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Crear ítem en catálogo'}
        </button>
      </form>
    </div>
  );
}
