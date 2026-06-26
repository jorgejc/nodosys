import api from './api';
import type { Process } from '@/types';

export const processesService = {
  getAll: (params?: { status?: string; type?: string }) =>
    api.get<Process[]>('/processes', { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<Process>(`/processes/${id}`).then((r) => r.data),

  create: (data: {
    name: string;
    description?: string;
    type?: string;
    nodoId?: string;
    workPlanTaskId?: string;
  }) => api.post<Process>('/processes', data).then((r) => r.data),

  update: (id: string, data: {
    name?: string;
    description?: string;
    type?: string;
    status?: string;
    nodoId?: string;
    workPlanTaskId?: string;
  }) => api.patch<Process>(`/processes/${id}`, data).then((r) => r.data),
};
