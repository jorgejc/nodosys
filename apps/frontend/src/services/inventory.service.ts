import api from './api';
import type { InventoryCategory, InventoryItem, InventoryUnit } from '@/types';

// ── Categorías ────────────────────────────────────────────
export const inventoryCategoryService = {
  getAll: (nodoId?: string) =>
    api.get<InventoryCategory[]>('/inventory/categories', { params: { nodoId } })
       .then((r) => r.data),
};


// ── Ítems del catálogo ────────────────────────────────────
export const inventoryItemService = {
  getAll: (params?: { nodoId?: string; categoryId?: string; search?: string }) =>
    api.get<InventoryItem[]>('/inventory/items', { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<InventoryItem>(`/inventory/items/${id}`).then((r) => r.data),

  create: (data: Partial<InventoryItem>) =>
    api.post<InventoryItem>('/inventory/items', data).then((r) => r.data),

  update: (id: string, data: Partial<InventoryItem>) =>
    api.patch<InventoryItem>(`/inventory/items/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/inventory/items/${id}`),

  getSummary: (nodoId?: string) =>
    api.get<Record<string, string>>('/inventory/summary', { params: { nodoId } })
       .then((r) => r.data),

  getLoans: (nodoId?: string) =>
    api.get<InventoryUnit[]>('/inventory/loans', { params: { nodoId } })
       .then((r) => r.data),
};

// ── Unidades ──────────────────────────────────────────────
export const inventoryUnitService = {
  getByItem: (itemId: string) =>
    api.get<InventoryUnit[]>(`/inventory/items/${itemId}/units`).then((r) => r.data),

  getById: (id: string) =>
    api.get<InventoryUnit>(`/inventory/units/${id}`).then((r) => r.data),

  addOne: (itemId: string, data: Partial<InventoryUnit>) =>
    api.post<InventoryUnit>(`/inventory/items/${itemId}/units`, data).then((r) => r.data),

  addBulk: (itemId: string, data: { quantity: number; location?: string; condition?: string; acquisitionDate?: string; acquisitionValue?: number }) =>
    api.post(`/inventory/items/${itemId}/units/bulk`, data).then((r) => r.data),

  update: (id: string, data: Partial<InventoryUnit>) =>
    api.patch<InventoryUnit>(`/inventory/units/${id}`, data).then((r) => r.data),

  registerMovement: (unitId: string, data: object) =>
    api.post(`/inventory/units/${unitId}/movements`, data).then((r) => r.data),

  getMovements: (unitId: string) =>
    api.get(`/inventory/units/${unitId}/movements`).then((r) => r.data),
};
