/**
 * InventoryItemDetailPage.tsx — Detalle de un ítem + sus unidades físicas
 *
 * Muestra:
 *  - Info del modelo (nombre, marca, categoría)
 *  - Lista de unidades físicas con serial, estado, ubicación
 *  - Botones para agregar unidad o registrar movimiento
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Package, Loader2, X, Pencil } from 'lucide-react';
import { inventoryItemService, inventoryUnitService } from '@/services/inventory.service';
import EditInventoryUnitModal from '@/components/inventory/EditInventoryUnitModal';

// ── Badge de estado ───────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    disponible:    { label: 'Disponible',    cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
    en_prestamo:   { label: 'En préstamo',   cls: 'text-blue-400  bg-blue-400/10  border-blue-400/20' },
    en_reparacion: { label: 'En reparación', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
    dado_de_baja:  { label: 'Dado de baja',  cls: 'text-[#555]    bg-[#1A1A1A]    border-[#2A2A2A]' },
  };
  const s = map[status] ?? { label: status, cls: 'text-[#888] bg-[#1A1A1A] border-[#2A2A2A]' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    excelente:    'text-emerald-400',
    bueno:        'text-green-400',
    regular:      'text-yellow-400',
    malo:         'text-red-400',
    dado_de_baja: 'text-[#555]',
  };
  const labels: Record<string, string> = {
    excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular',
    malo: 'Malo', dado_de_baja: 'Dado de baja',
  };
  return (
    <span className={`text-xs font-medium ${map[condition] ?? 'text-[#888]'}`}>
      {labels[condition] ?? condition}
    </span>
  );
}

// ── Modal: Agregar unidad ─────────────────────────────────
function AddUnitModal({
  itemId, onClose, onSuccess,
}: { itemId: string; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<'serial' | 'bulk'>('serial');
  
  const [form, setForm] = useState({
    serialNumber: '', internalCode: '', condition: 'bueno',
    location: 'Nodo', acquisitionDate: '', quantity: 1,
  });
  const [error, setError] = useState('');

  const addOneMutation = useMutation({
    mutationFn: () => inventoryUnitService.addOne(itemId, {
      serialNumber: form.serialNumber || undefined,
      internalCode: form.internalCode || undefined,
      condition: form.condition as never,
      location: form.location,
      acquisitionDate: form.acquisitionDate || undefined,
    }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Error al agregar la unidad');
    },
  });

  const addBulkMutation = useMutation({
    mutationFn: () => inventoryUnitService.addBulk(itemId, {
      quantity: form.quantity,
      condition: form.condition,
      location: form.location,
      acquisitionDate: form.acquisitionDate || undefined,
    }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Error al agregar unidades');
    },
  });

  const isLoading = addOneMutation.isPending || addBulkMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <h2 className="text-white font-semibold">Agregar unidad</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Toggle modo */}
          <div className="flex bg-[#1A1A1A] rounded-lg p-1">
            {([['serial', 'Con serial'], ['bulk', 'Sin serial (lote)']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === m
                    ? 'bg-[#FF6B2B] text-white'
                    : 'text-[#666] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          {mode === 'bulk' && (
            <div>
              <label className="text-xs text-[#666] uppercase tracking-wider block mb-1">
                Cantidad
              </label>
              <input
                type="number" min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
              />
            </div>
          )}

          {mode === 'serial' && (
            <>
              <div>
                <label className="text-xs text-[#666] uppercase tracking-wider block mb-1">
                  Número de serie
                </label>
                <input
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                  placeholder="SN123456 (opcional)"
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
                />
              </div>
              <div>
                <label className="text-xs text-[#666] uppercase tracking-wider block mb-1">
                  Código interno
                </label>
                <input
                  value={form.internalCode}
                  onChange={(e) => setForm({ ...form, internalCode: e.target.value })}
                  placeholder="NODO-PC-001 (opcional)"
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1">
              Condición
            </label>
            <select
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            >
              {['excelente', 'bueno', 'regular', 'malo'].map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1">
              Ubicación
            </label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Sala de Cómputo"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            />
          </div>

          <div>
            <label className="text-xs text-[#666] uppercase tracking-wider block mb-1">
              Fecha de adquisición
            </label>
            <input
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            />
          </div>

          <button
            onClick={() => mode === 'serial' ? addOneMutation.mutate() : addBulkMutation.mutate()}
            disabled={isLoading}
            className="w-full bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <><Loader2 size={14} className="animate-spin" />Guardando...</> : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function InventoryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);

  const itemQuery = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => inventoryItemService.getById(id!),
    enabled: !!id,
  });

  const item = itemQuery.data;

  if (itemQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[#FF6B2B]" />
      </div>
    );
  }

  if (!item) return null;

  const units = item.units ?? [];
  const totalUnits = units.length;
  const available = units.filter((u) => u.status === 'disponible').length;
  const onLoan = units.filter((u) => u.status === 'en_prestamo').length;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/inventario')}
        className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        Volver al inventario
      </button>

      {/* Header del ítem */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
              {item.category?.icon ?? '📦'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{item.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                {item.brand && <span className="text-sm text-[#888]">{item.brand}</span>}
                {item.model && <span className="text-sm text-[#666]">{item.model}</span>}
                <span className="text-xs text-[#555] bg-[#1A1A1A] px-2 py-0.5 rounded-full border border-[#2A2A2A]">
                  {item.category?.name}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-[#666] mt-2">{item.description}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowAddUnit(true)}
            className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <Plus size={14} />
            Agregar unidad
          </button>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[#1E1E1E]">
          {[
            { label: 'Total', value: totalUnits, color: 'text-white' },
            { label: 'Disponibles', value: available, color: 'text-green-400' },
            { label: 'En préstamo', value: onLoan, color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-[#555] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de unidades */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="border-b border-[#1E1E1E] px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-mono text-[#555] uppercase tracking-widest">
            // UNIDADES FÍSICAS
          </span>
          <span className="text-xs text-[#555]">{totalUnits} unidades</span>
        </div>

        {units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={36} className="text-[#333] mb-3" />
            <p className="text-[#555] text-sm">Sin unidades registradas</p>
            <button
              onClick={() => setShowAddUnit(true)}
              className="mt-3 text-[#FF6B2B] text-sm hover:underline"
            >
              Agregar la primera unidad →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E]">
                  {['Serial / Código', 'Condición', 'Estado', 'Ubicación', 'Ingreso', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-mono text-[#555] uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id} className="border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors">
                    <td className="px-5 py-3.5">
                      {unit.serialNumber ? (
                        <span className="font-mono text-xs text-white">{unit.serialNumber}</span>
                      ) : (
                        <span className="text-xs text-[#555]">Sin serial</span>
                      )}
                      {unit.internalCode && (
                        <div className="text-xs text-[#555] mt-0.5">{unit.internalCode}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ConditionBadge condition={unit.condition} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={unit.status} />
                    </td>
                    <td className="px-5 py-3.5 text-[#888] text-xs">{unit.location}</td>
                    <td className="px-5 py-3.5 text-[#666] text-xs font-mono">
                      {unit.acquisitionDate
                        ? new Date(unit.acquisitionDate).toLocaleDateString('es-CO')
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setEditingUnit(unit)}
                        className="p-1.5 text-[#555] hover:text-[#FF6B2B] hover:bg-[#FF6B2B]/10 rounded transition-colors"
                        title="Editar esta unidad"
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddUnit && (
        <AddUnitModal
          itemId={id!}
          onClose={() => setShowAddUnit(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['inventory-item', id] })}
        />
      )}

      {editingUnit && (
        <EditInventoryUnitModal
          unit={editingUnit}
          itemId={item.id}
          // itemName={item.name}
          onClose={() => {
            setEditingUnit(null);
            qc.invalidateQueries({ queryKey: ['inventory-item', id] }); // Esto refresca la tabla al cerrar
          }}
        />
      )}
    </div>
  );
}
