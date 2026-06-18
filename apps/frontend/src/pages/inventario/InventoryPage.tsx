/**
 * InventoryPage.tsx — Página principal del inventario
 *
 * Roles globales (admin, vicerrector, decano, coordinador):
 *   - Selector de nodos en la parte superior
 *   - Sin selección → vista consolidada de todos los nodos
 *   - Con selección → inventario de ese nodo
 *
 * Roles de nodo (enlace, monitor, auxiliar, docente con nodo):
 *   - Carga automáticamente el inventario de su nodo (backend filtra por JWT)
 *   - Sin nodo asignado → mensaje de advertencia
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package, Search, Plus, AlertTriangle,
  ArrowUpRight, Loader2, RefreshCw, Pencil, MapPin,
} from 'lucide-react';
import { inventoryItemService, inventoryCategoryService } from '@/services/inventory.service';
import { usersService } from '@/services/users.service';
import EditInventoryItemModal from '@/components/inventory/EditInventoryItemModal';
import { useAuthStore } from '@/stores/auth.store';
import { useAuth } from '@/hooks/useAuth';
import type { InventoryCategory } from '@/types';
import { usePagination } from '@/components/ui/Pagination';

const GLOBAL_ROLES = [
  'admin', 'vicerrector_extension', 'vicerrector_academico',
  'equipo_extension', 'decano', 'coordinador',
];

// Roles que deberían tener nodo asignado — sin él, el inventario no aplica
const NODO_ROLES = ['enlace', 'monitor', 'auxiliar'];

// ── Tarjeta de estadística ────────────────────────────────
function StatCard({
  label, value, sub, color, border,
}: {
  label: string; value: string | number; sub?: string;
  color: string; border: string;
}) {
  return (
    <div className={`bg-[#111] border ${border} rounded-xl p-5`}>
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-sm text-white font-medium">{label}</div>
      {sub && <div className="text-xs text-[#666] mt-0.5">{sub}</div>}
    </div>
  );
}

function ConditionDot({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    excelente: 'bg-emerald-500', bueno: 'bg-green-500',
    regular: 'bg-yellow-500', malo: 'bg-red-500', dado_de_baja: 'bg-[#444]',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[condition] ?? 'bg-[#444]'}`} />;
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { canAddInventory } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedNodoId, setSelectedNodoId] = useState<string | undefined>();

  const isGlobalRole = GLOBAL_ROLES.includes(user?.role ?? '');
  const isNodoRole   = NODO_ROLES.includes(user?.role ?? '');
  const hasNodo = isNodoRole && !!user?.nodoId;

  // Para roles de nodo el backend filtra por JWT; el frontend no pasa nodoId.
  // Para roles globales el frontend pasa el nodo seleccionado (undefined = todos).
  const effectiveNodoId = isGlobalRole ? selectedNodoId : undefined;

  // ── Lista de nodos (solo roles globales) ──────────────────
  const nodosQuery = useQuery({
    queryKey: ['nodos'],
    queryFn: () => usersService.getNodos(),
    enabled: isGlobalRole,
    staleTime: 5 * 60 * 1000,
  });

  const selectedNodoName = nodosQuery.data?.find(n => n.nodoId === selectedNodoId)?.nodoName;

  // ── Queries de inventario ─────────────────────────────────
  const summaryQuery = useQuery({
    queryKey: ['inventory-summary', effectiveNodoId ?? 'all'],
    queryFn: () => inventoryItemService.getSummary(effectiveNodoId),
  });

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories', effectiveNodoId ?? 'all'],
    queryFn: () => inventoryCategoryService.getAll(effectiveNodoId),
  });

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', search, selectedCategory, effectiveNodoId ?? 'all'],
    queryFn: () => inventoryItemService.getAll({
      search: search || undefined,
      categoryId: selectedCategory || undefined,
      nodoId: effectiveNodoId,
    }),
  });

  const summary = summaryQuery.data;
  const items = (itemsQuery.data ?? []) as any[];
  const { paginated, PaginationUI } = usePagination(items, 10);

  // ── Textos del header según rol ───────────────────────────
  const headerTitle = isGlobalRole
    ? (selectedNodoId ? `Inventario — ${selectedNodoName}` : 'Inventario — Todos los nodos')
    : `Inventario — ${user?.nodoName ?? 'Mi nodo'}`;

  const headerSub = isGlobalRole
    ? (selectedNodoId
        ? `Equipos y materiales del nodo ${selectedNodoName}`
        : 'Vista consolidada de todos los nodos del sistema')
    : (hasNodo
        ? `Equipos y materiales del nodo ${user?.nodoName ?? ''}`
        : isNodoRole
          ? 'Tu cuenta no tiene un nodo asignado — contacta al administrador'
          : 'Módulo de inventario');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">
            // MÓDULO DE INVENTARIO
          </p>
          <h1 className="text-2xl font-bold text-white">{headerTitle}</h1>
          <p className={`text-sm mt-1 ${isNodoRole && !user?.nodoId ? 'text-yellow-500' : 'text-[#666]'}`}>
            {headerSub}
          </p>
        </div>
        {canAddInventory && (
          <button
            onClick={() => navigate('/inventario/nuevo')}
            className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Agregar ítem
          </button>
        )}
      </div>

      {/* Selector de nodos (solo roles globales) */}
      {isGlobalRole && (
        <div className="flex gap-2 flex-wrap items-center">
          <MapPin size={13} className="text-[#555]" />
          <button
            onClick={() => setSelectedNodoId(undefined)}
            className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-colors ${
              !selectedNodoId
                ? 'bg-[#FF6B2B]/10 border-[#FF6B2B]/30 text-[#FF6B2B]'
                : 'bg-[#111] border-[#2A2A2A] text-[#555] hover:text-white hover:border-[#444]'
            }`}
          >
            Todos
          </button>
          {nodosQuery.isLoading && (
            <Loader2 size={14} className="animate-spin text-[#555]" />
          )}
          {nodosQuery.data?.map(nodo => (
            <button
              key={nodo.nodoId}
              onClick={() => { setSelectedNodoId(nodo.nodoId); setSelectedCategory(''); }}
              className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-colors ${
                selectedNodoId === nodo.nodoId
                  ? 'bg-[#FF6B2B]/10 border-[#FF6B2B]/30 text-[#FF6B2B]'
                  : 'bg-[#111] border-[#2A2A2A] text-[#555] hover:text-white hover:border-[#444]'
              }`}
            >
              {nodo.nodoName}
            </button>
          ))}
        </div>
      )}

      {/* Advertencia: usuario sin nodo asignado */}
      {isNodoRole && !user?.nodoId && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-4">
          <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 text-sm font-medium">Sin nodo asignado</p>
            <p className="text-yellow-600 text-xs mt-0.5">
              Tu cuenta no tiene un nodo asignado. Contacta al administrador para que te asigne uno.
            </p>
          </div>
        </div>
      )}

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
            border="border-[#2A2A2A]"
          />
          <StatCard
            label="Disponibles"
            value={summary?.disponible ?? '—'}
            color="text-green-400"
            border="border-green-400/20"
          />
          <StatCard
            label="En préstamo"
            value={summary?.en_prestamo ?? '—'}
            color="text-blue-400"
            border="border-blue-400/20"
          />
          <StatCard
            label="Con problemas"
            value={
              (parseInt(summary?.malo ?? '0')) +
              (parseInt(summary?.dado_de_baja ?? '0'))
            }
            sub="Malo + Dado de baja"
            color="text-red-400"
            border="border-red-400/20"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
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
              {search
                ? 'No se encontraron resultados'
                : isNodoRole && !user?.nodoId
                  ? 'Asigna un nodo a tu cuenta para ver inventario'
                  : 'No hay ítems registrados en este nodo'}
            </p>
            {canAddInventory && !search && (isGlobalRole || hasNodo) && (
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
                {paginated.map((item: any) => {
                  const damaged = (item as any).damagedUnits ?? 0;
                  const total   = (item as any).totalUnits ?? 0;
                  const available = (item as any).availableUnits ?? 0;
                  const onLoan = total - available - damaged;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{item.name}</div>
                        {(item.brand || item.model) && (
                          <div className="text-xs text-[#555] mt-0.5">
                            {[item.brand, item.model].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#888] bg-[#1A1A1A] px-2.5 py-1 rounded-full border border-[#2A2A2A]">
                          <span>{item.category?.icon}</span>
                          <span>{item.category?.name}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-white">{total}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-green-400">{available}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-blue-400">{onLoan > 0 ? onLoan : '—'}</span>
                      </td>
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
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {canAddInventory && (
                            <button
                              onClick={() => setEditingItemId(item.id as string)}
                              className="p-1.5 text-[#555] hover:text-[#FF6B2B] hover:bg-[#FF6B2B]/10 rounded transition-colors"
                              title="Editar ítem"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
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

        <div className="p-4 border-t border-[#1E1E1E] flex justify-end">
          <PaginationUI />
        </div>
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
