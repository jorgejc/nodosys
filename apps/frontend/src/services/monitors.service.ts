/**
 * monitors.service.ts — Cliente del módulo de Monitorías
 *
 * El backend decide qué puede ver cada rol; aquí solo se llaman los
 * endpoints. Los documentos se descargan como blob (igual que Reportes).
 */
import api from './api';
import type {
  MonitorWorkPlan, MonitorListItem, MonitorWeek, MonitorWeekActivity,
  MonitorEvidence, MonitorHoursRange,
} from '@/types';

/** Descarga un archivo del backend y dispara el "Guardar como" del navegador. */
async function downloadBlob(url: string, filename: string, params?: Record<string, unknown>) {
  const response = await api.get(url, { responseType: 'blob', params });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([response.data]));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const monitorsService = {
  // ── Vista de la monitora ────────────────────────────────
  getMyPlan: (vigencia?: string) =>
    api.get<MonitorWorkPlan>('/monitors/me/plan', { params: { vigencia } })
       .then((r) => r.data),

  // ── Vista del enlace ────────────────────────────────────
  listMonitors: () =>
    api.get<MonitorListItem[]>('/monitors').then((r) => r.data),

  getMonitorPlan: (monitorId: string, vigencia?: string) =>
    api.get<MonitorWorkPlan>(`/monitors/${monitorId}/plan`, { params: { vigencia } })
       .then((r) => r.data),

  // ── Planes ──────────────────────────────────────────────
  getPlan: (planId: string) =>
    api.get<MonitorWorkPlan>(`/monitors/plans/${planId}`).then((r) => r.data),

  createPlan: (vigencia: string, monitorId?: string) =>
    api.post<MonitorWorkPlan>('/monitors/plans', { vigencia, monitorId })
       .then((r) => r.data),

  getHours: (planId: string, from: number, to: number) =>
    api.get<MonitorHoursRange>(`/monitors/plans/${planId}/hours`, { params: { from, to } })
       .then((r) => r.data),

  // ── Semanas ─────────────────────────────────────────────
  createWeek: (planId: string, data: {
    weekNumber: number; startDate: string; endDate: string;
  }) =>
    api.post<MonitorWeek>(`/monitors/plans/${planId}/weeks`, data)
       .then((r) => r.data),

  updateWeek: (weekId: string, data: {
    weekNumber?: number; startDate?: string; endDate?: string;
  }) =>
    api.patch<MonitorWeek>(`/monitors/weeks/${weekId}`, data)
       .then((r) => r.data),

  deleteWeek: (weekId: string) =>
    api.delete(`/monitors/weeks/${weekId}`),

  // ── Actividades (tareas) ────────────────────────────────
  addActivity: (planId: string, data: {
    weekId: string; description: string; hours: number; overrideNote?: string;
  }) =>
    api.post<MonitorWeekActivity>(`/monitors/plans/${planId}/activities`, data)
       .then((r) => r.data),

  updateActivity: (activityId: string, data: Record<string, unknown>) =>
    api.patch<MonitorWeekActivity>(`/monitors/activities/${activityId}`, data)
       .then((r) => r.data),

  deleteActivity: (activityId: string) =>
    api.delete(`/monitors/activities/${activityId}`),

  // ── Evidencias (cuelgan de una tarea) ───────────────────
  addEvidence: (planId: string, data: {
    activityId: string; fileUrl: string; caption?: string;
  }) =>
    api.post<MonitorEvidence>(`/monitors/plans/${planId}/evidences`, data)
       .then((r) => r.data),

  deleteEvidence: (evidenceId: string) =>
    api.delete(`/monitors/evidences/${evidenceId}`),

  // ── Firma del enlace ────────────────────────────────────
  getMySignature: () =>
    api.get<{ signatureUrl: string | null }>('/monitors/me/signature').then((r) => r.data),

  updateMySignature: (signatureUrl: string) =>
    api.patch<{ signatureUrl: string }>('/monitors/me/signature', { signatureUrl })
       .then((r) => r.data),

  // ── Documentos ──────────────────────────────────────────
  downloadPlanExcel: (planId: string, monitorName?: string) =>
    downloadBlob(
      `/reports/monitors/${planId}/excel`,
      `plan-monitoria-${slug(monitorName) || planId.slice(0, 8)}.xlsx`,
    ),

  downloadCertificate: (
    planId: string,
    from: number, to: number,
    observaciones?: string,
    monitorName?: string,
  ) =>
    downloadBlob(
      `/reports/monitors/${planId}/certificado/pdf`,
      `certificado-horas-${slug(monitorName) || planId.slice(0, 8)}.pdf`,
      { from, to, observaciones: observaciones || undefined },
    ),
};

// Marcas diacríticas que deja sueltas normalize('NFD') (tildes, diéresis...)
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Nombre de archivo seguro a partir del nombre de la monitora. */
function slug(name?: string): string {
  if (!name) return '';
  return name
    .normalize('NFD').replace(COMBINING_MARKS, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 40);
}
