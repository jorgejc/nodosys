import api from './api';

export const workPlanService = {
  getAll: () =>
    api.get('/workplan').then((r) => r.data),

  getById: (id: string) =>
    api.get(`/workplan/${id}`).then((r) => r.data),

  create: (data: Record<string, unknown>) =>
    api.post('/workplan', data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/workplan/${id}`, data).then((r) => r.data),

  getSummary: (id: string) =>
    api.get(`/workplan/${id}/summary`).then((r) => r.data),

  getAxesSummary: (id: string) =>
    api.get(`/workplan/${id}/axes-summary`).then((r) => r.data),

  updateAxis: (planId: string, axisId: string, data: Record<string, unknown>) =>
    api.patch(`/workplan/${planId}/axes/${axisId}`, data).then((r) => r.data),

  createActivity: (axisId: string, data: Record<string, unknown>) =>
    api.post(`/workplan/axes/${axisId}/activities`, data).then((r) => r.data),

  getActivity: (id: string) =>
    api.get(`/workplan/activities/${id}`).then((r) => r.data),

  updateActivity: (id: string, data: Record<string, unknown>) =>
    api.patch(`/workplan/activities/${id}`, data).then((r) => r.data),

  deleteActivity: (id: string) =>
    api.delete(`/workplan/activities/${id}`),

  getMyTasks: () =>
    api.get<{ id: string; label: string }[]>('/workplan/my-tasks').then((r) => r.data),

  getLinkedProcesses: (planId: string) =>
    api.get<Record<string, { id: string; name: string; type: string; status: string }[]>>(
      `/workplan/${planId}/linked-processes`,
    ).then((r) => r.data),
};
