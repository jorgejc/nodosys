import api from './api';

export const activitiesService = {
  // Solicitudes
  getAll: (params?: { status?: string; userId?: string; processId?: string; sessionId?: string; nodoId?: string }) =>
    api.get('/activities', { params }).then(r => r.data),

  getLastForProcess: (processId: string) =>
    api.get<Record<string, unknown> | null>(`/activities/last-for-process/${processId}`).then(r => r.data),

  getById: (id: string) =>
    api.get(`/activities/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post('/activities', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/activities/${id}`, data).then(r => r.data),

  submit: (id: string) =>
    api.patch(`/activities/${id}/submit`).then(r => r.data),

  review: (id: string, data: { decision: string; rejectionReason?: string; reviewerNotes?: string }) =>
    api.patch(`/activities/${id}/review`, data).then(r => r.data),

  markExecuted: (id: string) =>
    api.patch(`/activities/${id}/executed`).then(r => r.data),

  // Gastos
  getExpenses: (id: string) =>
    api.get(`/activities/${id}/expenses`).then(r => r.data),

  getExpenseSummary: (id: string) =>
    api.get(`/activities/${id}/expenses/summary`).then(r => r.data),

  addExpense: (id: string, data: Record<string, unknown>) =>
    api.post(`/activities/${id}/expenses`, data).then(r => r.data),

  deleteExpense: (expenseId: string) =>
    api.delete(`/activities/expenses/${expenseId}`),

  // Participantes
  getParticipants: (id: string) =>
    api.get(`/activities/${id}/participants`).then(r => r.data),

  addParticipant: (id: string, data: Record<string, unknown>) =>
    api.post(`/activities/${id}/participants`, data).then(r => r.data),

  deleteParticipant: (participantId: string) =>
    api.delete(`/activities/participants/${participantId}`),

  // Evidencias
  getEvidence: (id: string) =>
    api.get(`/activities/${id}/evidence`).then(r => r.data),

  addEvidence: (id: string, data: Record<string, unknown>) =>
    api.post(`/activities/${id}/evidence`, data).then(r => r.data),

  deleteEvidence: (evidenceId: string) =>
    api.delete(`/activities/evidence/${evidenceId}`),
};
