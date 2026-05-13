/**
 * InventoryPage.tsx — Página principal del inventario
 *
 * Muestra:
 *  - Tarjetas de resumen (total, disponibles, prestados, dañados)
 *  - Filtros por categoría y búsqueda
 *  - Tabla de ítems del catálogo con conteo de unidades por estado
 *  - Acciones: ver detalle, agregar ítem
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Plus, AlertTriangle, ArrowUpRight, Loader2, RefreshCw, Pencil } from 'lucide-react';
import { inventoryItemService, inventoryCategoryService } from '@/services/inventory.service';
import EditInventoryItemModal from '@/components/inventory/EditInventoryItemModal';
import type { InventoryCategory } from '@/types';

// ── Tarjeta de estadística ────────────────────────────────
function StatCard({
  label, value, sub, color, bg, border,
}: {
  label: string; value: string | number; sub?: string;
  color: string; bg: string; border: string;
}) {
  return (
    <div className={`bg-[#111] border ${border} rounded-xl p-5`}>
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-sm text-white font-medium">{label}</div>
      {sub && <div className="text-xs text-[#666] mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Badge de condición de unidad ──────────────────────────
function ConditionDot({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    excelente: 'bg-emerald-500',
    bueno: 'bg-green-500',
    regular: 'bg-yellow-500',
    malo: 'bg-red-500',
    dado_de_baja: 'bg-[#444]',
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${map[condition] ?? 'bg-[#444]'}`} />
  );
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // ── Queries TanStack Query ────────────────────────────────
  const summaryQuery = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => inventoryItemService.getSummary(),
  });

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => inventoryCategoryService.getAll(),
  });

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', search, selectedCategory],
    queryFn: () =>
      inventoryItemService.getAll({
        search: search || undefined,
        categoryId: selectedCategory || undefined,
      }),
  });

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">
            // MÓDULO DE INVENTARIO
          </p>
          <h1 className="text-2xl font-bold text-white">Inventario del Nodo</h1>
          <p className="text-[#666] text-sm mt-1">
            Equipos, materiales y recursos del nodo Arboletes
          </p>
        </div>
        <button
          onClick={() => navigate('/inventario/nuevo')}
          className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Agregar ítem
        </button>
      </div>

      {/* Stats */}
      {summaryQuery.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5 animate-pulse">
              <div className="h-7 w-16 bg-[#222] rounded mb-2" />
              <div className="h-4 w-24 bg-[#1A1A1A] rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total unidades"
            value={summary?.total_units ?? '—'}
            sub={`${summary?.total_items ?? 0} modelos`}
            color="text-white"
            bg="bg-[#1A1A1A]"
            border="border-[#2A2A2A]"
          />
          <StatCard
            label="Disponibles"
            value={summary?.disponible ?? '—'}
            color="text-green-400"
            bg="bg-green-400/10"
            border="border-green-400/20"
          />
          <StatCard
            label="En préstamo"
            value={summary?.en_prestamo ?? '—'}
            color="text-blue-400"
            bg="bg-blue-400/10"
            border="border-blue-400/20"
          />
          <StatCard
            label="Con problemas"
            value={
              ((parseInt(summary?.malo ?? '0')) +
                (parseInt(summary?.dado_de_baja ?? '0')))
            }
            sub="Malo + Dado de baja"
            color="text-red-400"
            bg="bg-red-400/10"
            border="border-red-400/20"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            placeholder="Buscar por nombre, marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors"
          />
        </div>

        {/* Filtro por categoría */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B] transition-colors min-w-[180px]"
        >
          <option value="">Todas las categorías</option>
          {categoriesQuery.data?.map((cat: InventoryCategory) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={() => itemsQuery.refetch()}
          className="p-2.5 bg-[#111] border border-[#2A2A2A] rounded-lg text-[#555] hover:text-white transition-colors"
          title="Actualizar"
        >
          <RefreshCw size={16} className={itemsQuery.isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabla de ítems */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="border-b border-[#1E1E1E] px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-mono text-[#555] uppercase tracking-widest">
            // CATÁLOGO DE ÍTEMS
          </span>
          <span className="text-xs text-[#555]">
            {itemsQuery.data?.length ?? 0} ítems
          </span>
        </div>

        {itemsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
          </div>
        ) : itemsQuery.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={40} className="text-[#333] mb-3" />
            <p className="text-[#555] text-sm">
              {search ? 'No se encontraron resultados' : 'No hay ítems registrados'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/inventario/nuevo')}
                className="mt-4 text-[#FF6B2B] text-sm hover:underline"
              >
                Agregar el primer ítem →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E]">
                  {['Ítem', 'Categoría', 'Total', 'Disponibles', 'Préstamo', 'Estado', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-mono text-[#555] uppercase tracking-wider px-5 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemsQuery.data?.map((item) => {
                  const damaged =
                    (item as unknown as Record<string, number>).damagedUnits ?? 0;
                  const total =
                    (item as unknown as Record<string, number>).totalUnits ?? 0;
                  const available =
                    (item as unknown as Record<string, number>).availableUnits ?? 0;
                  const onLoan = total - available - damaged;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors group"
                    >
                      {/* Ítem */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{item.name}</div>
                        {(item.brand || item.model) && (
                          <div className="text-xs text-[#555] mt-0.5">
                            {[item.brand, item.model].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#888] bg-[#1A1A1A] px-2.5 py-1 rounded-full border border-[#2A2A2A]">
                          <span>{item.category?.icon}</span>
                          <span>{item.category?.name}</span>
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3.5 font-mono font-bold text-white">
                        {total}
                      </td>

                      {/* Disponibles */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-green-400">{available}</span>
                      </td>

                      {/* En préstamo */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-blue-400">{onLoan > 0 ? onLoan : '—'}</span>
                      </td>

                      {/* Estado (alerta si hay dañados) */}
                      <td className="px-5 py-3.5">
                        {damaged > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
                            <AlertTriangle size={10} />
                            {damaged} con problemas
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <ConditionDot condition="bueno" />
                            OK
                          </span>
                        )}
                      </td>

                      {/* Acción */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingItemId(item.id as string)}
                            className="p-1.5 text-[#555] hover:text-[#FF6B2B] hover:bg-[#FF6B2B]/10 rounded transition-colors" title="Editar ítem">
                            <Pencil size={13} />
                          </button>
                        <button
                          onClick={() => navigate(`/inventario/${item.id}`)}
                          className="flex items-center gap-1 text-xs text-[#555] group-hover:text-[#FF6B2B] transition-colors"
                        >
                          Ver unidades
                          <ArrowUpRight size={12} />
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editingItemId && (
        <EditInventoryItemModal
          itemId={editingItemId}
          onClose={() => { setEditingItemId(null); itemsQuery.refetch(); }}
        />
      )}

    </div>
  );
}
