/**
 * EditInventoryItemModal.tsx — Modal para editar un ítem del catálogo
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { inventoryItemService, inventoryCategoryService } from '@/services/inventory.service';
import type { LocationType } from '@/types';

interface Props {
  itemId: string;
  onClose: () => void;
}

const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors";
const lbl = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";

export default function EditInventoryItemModal({ itemId, onClose }: Props) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', brand: '', model: '', description: '',
    categoryId: '', trackByUnit: true, notes: '', imageUrl: '',
    locationType: '' as LocationType | '',
    cabinetNumber: '', shelfNumber: '', locationNote: '',
  });

  // Cargar datos del ítem
  const itemQuery = useQuery({
    queryKey: ['inventory-item-edit', itemId],
    queryFn: () => inventoryItemService.getById(itemId),
  });

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => inventoryCategoryService.getAll(),
  });

  const cabinetNumbersQuery = useQuery({
    queryKey: ['cabinet-numbers', itemQuery.data?.nodoId],
    queryFn: () => inventoryItemService.getCabinetNumbers(itemQuery.data?.nodoId ?? undefined),
    enabled: form.locationType === 'gabinete',
  });

  useEffect(() => {
    if (itemQuery.data) {
      const item = itemQuery.data;
      setForm({
        name: item.name ?? '',
        brand: item.brand ?? '',
        model: item.model ?? '',
        description: item.description ?? '',
        categoryId: item.categoryId ?? '',
        trackByUnit: item.trackByUnit ?? true,
        notes: item.notes ?? '',
        imageUrl: item.imageUrl ?? '',
        locationType:  (item.locationType ?? '') as LocationType | '',
        cabinetNumber: item.cabinetNumber ?? '',
        shelfNumber:   item.shelfNumber ?? '',
        locationNote:  item.locationNote ?? '',
      });
    }
  }, [itemQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => inventoryItemService.update(itemId, {
      name: form.name,
      brand: form.brand || null,
      model: form.model || null,
      description: form.description || null,
      categoryId: form.categoryId,
      trackByUnit: form.trackByUnit,
      notes: form.notes || null,
      imageUrl: form.imageUrl || null,
      locationType:  (form.locationType as LocationType) || null,
      cabinetNumber: form.locationType === 'gabinete'          ? (form.cabinetNumber || null) : null,
      shelfNumber:   form.locationType === 'gabinete'          ? (form.shelfNumber   || null) : null,
      locationNote:  form.locationType === 'mobiliario_suelto' ? (form.locationNote  || null) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Error al actualizar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => inventoryItemService.delete(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Error al eliminar. Asegúrate de dar de baja las unidades primero.');
      setConfirmDelete(false);
    },
  });

  const F = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E] flex-shrink-0">
          <div>
            <div className="text-xs font-mono text-[#555] uppercase tracking-widest mb-0.5">Editar ítem</div>
            <h2 className="text-white font-semibold text-sm">{itemQuery.data?.name ?? '...'}</h2>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {(error) && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {itemQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
            </div>
          ) : (
            <>
              <div>
                <label className={lbl}>Nombre *</label>
                <input value={form.name} onChange={e => F('name', e.target.value)}
                  placeholder="Nombre del ítem" className={inp} />
              </div>

              <div>
                <label className={lbl}>Categoría *</label>
                <select value={form.categoryId} onChange={e => F('categoryId', e.target.value)} className={inp}>
                  <option value="">Seleccionar...</option>
                  {categoriesQuery.data?.map((c: { id: string; icon: string; name: string }) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Marca</label>
                  <input value={form.brand} onChange={e => F('brand', e.target.value)}
                    placeholder="HP, Samsung..." className={inp} />
                </div>
                <div>
                  <label className={lbl}>Modelo</label>
                  <input value={form.model} onChange={e => F('model', e.target.value)}
                    placeholder="ProBook 440" className={inp} />
                </div>
              </div>

              <div>
                <label className={lbl}>Descripción</label>
                <textarea value={form.description} onChange={e => F('description', e.target.value)}
                  rows={2} className={`${inp} resize-none`} placeholder="Descripción del ítem..." />
              </div>

              <div>
                <label className={lbl}>URL de imagen (opcional)</label>
                <input value={form.imageUrl} onChange={e => F('imageUrl', e.target.value)}
                  placeholder="https://..." type="url" className={inp} />
                <p className="text-xs text-[#555] mt-1">
                  Pega la URL de una foto del equipo. Puede ser de Google Drive, Dropbox, etc.
                </p>
                {form.imageUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-[#2A2A2A] h-24">
                    <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>

              <div>
                <label className={lbl}>Observaciones</label>
                <textarea value={form.notes} onChange={e => F('notes', e.target.value)}
                  rows={2} className={`${inp} resize-none`} placeholder="Observaciones..." />
              </div>

              {/* Ubicación */}
              <div className="border-t border-[#2A2A2A] pt-3 space-y-3">
                <p className="text-xs font-mono text-[#555] uppercase tracking-widest">// Ubicación física</p>
                <div>
                  <label className={lbl}>Tipo de ubicación</label>
                  <select value={form.locationType} onChange={e => F('locationType', e.target.value as LocationType | '')} className={inp}>
                    <option value="">Sin especificar</option>
                    <option value="gabinete">Gabinete / Entrepaño</option>
                    <option value="mobiliario_suelto">Mobiliario suelto</option>
                  </select>
                </div>
                {form.locationType === 'gabinete' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>N.° Gabinete</label>
                      <input value={form.cabinetNumber} onChange={e => F('cabinetNumber', e.target.value)}
                        list="edit-cabinet-list" placeholder="Ej: 3" className={inp} />
                      <datalist id="edit-cabinet-list">
                        {(cabinetNumbersQuery.data ?? []).map(n => <option key={n} value={n} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className={lbl}>N.° Entrepaño</label>
                      <input value={form.shelfNumber} onChange={e => F('shelfNumber', e.target.value)}
                        placeholder="Ej: 2" className={inp} />
                    </div>
                  </div>
                )}
                {form.locationType === 'mobiliario_suelto' && (
                  <div>
                    <label className={lbl}>Nota de ubicación</label>
                    <input value={form.locationNote} onChange={e => F('locationNote', e.target.value)}
                      placeholder="Ej: Junto a la puerta principal" maxLength={300} className={inp} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#1A1A1A] rounded-lg border border-[#2A2A2A]">
                <input type="checkbox" id="trackByUnit" checked={form.trackByUnit}
                  onChange={e => F('trackByUnit', e.target.checked)} className="accent-[#FF6B2B]" />
                <label htmlFor="trackByUnit" className="text-sm text-white cursor-pointer">
                  Rastrear por unidad individual (serial)
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1E1E1E] flex items-center justify-between flex-shrink-0">
          <div>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                <Trash2 size={13} /> Eliminar ítem
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">¿Confirmar?</span>
                <button onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-xs bg-red-500/20 border border-red-500/30 text-red-400 px-2 py-1 rounded hover:bg-red-500/30 transition-colors">
                  {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-[#555] hover:text-white">
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-[#666] hover:text-white transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => { setError(''); updateMutation.mutate(); }}
              disabled={updateMutation.isPending || !form.name || !form.categoryId}
              className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
