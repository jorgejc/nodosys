/**
 * EditInventoryUnitModal.tsx — Modal para editar una unidad física
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Trash2, Loader2 } from 'lucide-react';
import { inventoryUnitService } from '@/services/inventory.service';
import { ItemCondition } from '@/types';

interface Unit {
  id: string;
  serialNumber: string | null;
  internalCode: string | null;
  condition: string;
  status: string;
  location: string;
  notes: string | null;
  acquisitionDate: string | null;
  acquisitionValue: number | null;
}

interface Props {
  unit: Unit;
  itemId: string;
  onClose: () => void;
}

const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors";
const lbl = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";

export default function EditInventoryUnitModal({ unit, itemId, onClose }: Props) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    serialNumber: '', internalCode: '', condition: 'bueno',
    location: 'Nodo', notes: '', acquisitionDate: '', acquisitionValue: '',
  });

  useEffect(() => {
    setForm({
      serialNumber: unit.serialNumber ?? '',
      internalCode: unit.internalCode ?? '',
      condition: unit.condition ?? 'bueno',
      location: unit.location ?? 'Nodo',
      notes: unit.notes ?? '',
      acquisitionDate: unit.acquisitionDate ? unit.acquisitionDate.split('T')[0] : '',
      acquisitionValue: unit.acquisitionValue?.toString() ?? '',
    });
  }, [unit]);

  const updateMutation = useMutation({
    mutationFn: () => inventoryUnitService.update(unit.id, {
      serialNumber: form.serialNumber || null,
      internalCode: form.internalCode || null,
      condition: form.condition as ItemCondition,
      location: form.location,
      notes: form.notes || null,
      acquisitionDate: form.acquisitionDate || null,
      acquisitionValue: form.acquisitionValue ? parseFloat(form.acquisitionValue) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Error al actualizar');
    },
  });

  // Registrar baja de la unidad (movimiento)
  const bajaMutation = useMutation({
    mutationFn: () => inventoryUnitService.registerMovement(unit.id, {
      movementType: 'baja',
      movementDate: new Date().toISOString().split('T')[0],
      notes: 'Dada de baja desde el panel de edición',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Error al dar de baja');
      setConfirmDelete(false);
    },
  });

  const F = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const conditions = [
    { value: 'excelente', label: 'Excelente' },
    { value: 'bueno', label: 'Bueno' },
    { value: 'regular', label: 'Regular' },
    { value: 'malo', label: 'Malo' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E] flex-shrink-0">
          <div>
            <div className="text-xs font-mono text-[#555] uppercase tracking-widest mb-0.5">Editar unidad</div>
            <h2 className="text-white font-semibold text-sm">
              {unit.serialNumber ?? unit.internalCode ?? 'Sin serial'}
            </h2>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className={lbl}>Número de serie</label>
            <input value={form.serialNumber} onChange={e => F('serialNumber', e.target.value)}
              placeholder="SN123456" className={inp} />
          </div>

          <div>
            <label className={lbl}>Código interno</label>
            <input value={form.internalCode} onChange={e => F('internalCode', e.target.value)}
              placeholder="NODO-PC-001" className={inp} />
          </div>

          <div>
            <label className={lbl}>Condición física</label>
            <div className="grid grid-cols-2 gap-2">
              {conditions.map(c => (
                <button key={c.value} type="button" onClick={() => F('condition', c.value)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                    form.condition === c.value
                      ? 'bg-[#FF6B2B]/15 border-[#FF6B2B]/40 text-[#FF6B2B]'
                      : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#666] hover:border-[#444]'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Ubicación actual</label>
            <input value={form.location} onChange={e => F('location', e.target.value)}
              placeholder="Sala de Cómputo, Bodega..." className={inp} />
          </div>

          <div>
            <label className={lbl}>Fecha de adquisición</label>
            <input type="date" value={form.acquisitionDate}
              onChange={e => F('acquisitionDate', e.target.value)} className={inp} />
          </div>

          <div>
            <label className={lbl}>Valor (pesos COP)</label>
            <input type="number" value={form.acquisitionValue}
              onChange={e => F('acquisitionValue', e.target.value)}
              placeholder="2500000" className={inp} />
          </div>

          <div>
            <label className={lbl}>Observaciones</label>
            <textarea value={form.notes} onChange={e => F('notes', e.target.value)}
              rows={2} className={`${inp} resize-none`} placeholder="Estado, detalles..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1E1E1E] flex items-center justify-between flex-shrink-0">
          <div>
            {unit.status !== 'dado_de_baja' && (
              !confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                  <Trash2 size={13} /> Dar de baja
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">¿Confirmar baja?</span>
                  <button onClick={() => bajaMutation.mutate()} disabled={bajaMutation.isPending}
                    className="text-xs bg-red-500/20 border border-red-500/30 text-red-400 px-2 py-1 rounded hover:bg-red-500/30">
                    {bajaMutation.isPending ? '...' : 'Sí, dar de baja'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-[#555] hover:text-white">
                    Cancelar
                  </button>
                </div>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-[#666] hover:text-white">Cancelar</button>
            <button onClick={() => { setError(''); updateMutation.mutate(); }}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
