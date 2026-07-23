import api from './api';
import type { Process } from '@/types';
import type { CourseSession } from './sessions.service';

export interface ConsolidatedAttendee {
  fullName: string;
  documentNumber: string | null;
  sessionsAttended: number;
  totalSessions: number;
  absences: number;
  certifiable: boolean;
}

export interface ProcessReport {
  process: Process & { creator?: { id: string; name: string; email: string } };
  sessions: CourseSession[];
  consolidatedAttendance: ConsolidatedAttendee[];
  totalSessions: number;
  dateRange: { start: string | null; end: string | null };
}

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
    strategyId?: string;
    missionAxisId?: string;
    sessionTemplate?: string;
  }) => api.post<Process>('/processes', data).then((r) => r.data),

  update: (id: string, data: {
    name?: string;
    description?: string;
    type?: string;
    status?: string;
    nodoId?: string;
    workPlanTaskId?: string;
    strategyId?: string;
    missionAxisId?: string;
    sessionTemplate?: string;
  }) => api.patch<Process>(`/processes/${id}`, data).then((r) => r.data),

  getReport: (id: string) =>
    api.get<ProcessReport>(`/processes/${id}/report`).then((r) => r.data),
};
