import api from './api';
import type { User } from '@/types';

export const usersService = {
  getAll: (params?: { nodoId?: string; role?: string; faculty?: string; program?: string }) =>
    api.get<User[]>('/users', { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<User>(`/users/${id}`).then((r) => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.patch(`/users/${id}`, { isActive: false }),

  activate: (id: string) =>
    api.patch(`/users/${id}`, { isActive: true }),

  // Registrar usuario nuevo (endpoint público)
  register: (data: Record<string, unknown>) =>
    api.post('/auth/register', data).then((r) => r.data),
};
