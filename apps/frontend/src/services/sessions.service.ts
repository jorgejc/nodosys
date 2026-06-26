import api from './api';

export interface SessionMoment {
  id: string;
  sessionId: string;
  momentType: 'explorar' | 'crear' | 'consolidar';
  objective: string | null;
  methodology: string | null;
  materials: string | null;
  durationMinutes: number | null;
}

export interface SessionAttendee {
  id: string;
  sessionId: string;
  fullName: string;
  documentNumber: string | null;
  attended: boolean;
  absencesCount: number;
  certifiable: boolean;
}

export interface CourseSession {
  id: string;
  activityId: string;
  sessionNumber: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
  location: string | null;
  totalRegistered: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  moments: SessionMoment[];
  attendees: SessionAttendee[];
  creator?: { id: string; name: string; email: string };
}

export interface AttendanceReportRow {
  fullName: string;
  documentNumber: string | null;
  totalSessions: number;
  attendedCount: number;
  totalAbsences: number;
  certifiable: boolean;
}

export interface CreateSessionPayload {
  date: string;
  startTime?: string;
  endTime?: string;
  topic?: string;
  location?: string;
  totalRegistered?: number;
  moments?: {
    momentType: 'explorar' | 'crear' | 'consolidar';
    objective?: string;
    methodology?: string;
    materials?: string;
    durationMinutes?: number;
  }[];
}

export const sessionsService = {
  // ── Sesiones ──────────────────────────────────────────────
  getByActivity: (activityId: string) =>
    api.get<CourseSession[]>(`/sessions/activity/${activityId}`).then((r) => r.data),

  getByProcess: (processId: string) =>
    api.get<CourseSession[]>(`/sessions/process/${processId}`).then((r) => r.data),

  createForProcess: (processId: string, data: CreateSessionPayload) =>
    api.post<CourseSession>(`/sessions/process/${processId}`, data).then((r) => r.data),

  getById: (id: string) =>
    api.get<CourseSession>(`/sessions/${id}`).then((r) => r.data),

  create: (activityId: string, data: CreateSessionPayload) =>
    api.post<CourseSession>(`/sessions/activity/${activityId}`, data).then((r) => r.data),

  update: (id: string, data: Partial<CreateSessionPayload>) =>
    api.patch<CourseSession>(`/sessions/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/sessions/${id}`),

  getAttendanceReport: (activityId: string) =>
    api.get<AttendanceReportRow[]>(`/sessions/activity/${activityId}/attendance`).then((r) => r.data),

  // ── Asistentes ────────────────────────────────────────────
  addAttendee: (sessionId: string, data: { fullName: string; documentNumber?: string; attended?: boolean; absencesCount?: number }) =>
    api.post<SessionAttendee>(`/sessions/${sessionId}/attendees`, data).then((r) => r.data),

  updateAttendee: (sessionId: string, attendeeId: string, data: Partial<{ fullName: string; documentNumber: string; attended: boolean; absencesCount: number }>) =>
    api.patch<SessionAttendee>(`/sessions/${sessionId}/attendees/${attendeeId}`, data).then((r) => r.data),

  deleteAttendee: (sessionId: string, attendeeId: string) =>
    api.delete(`/sessions/${sessionId}/attendees/${attendeeId}`),
};
