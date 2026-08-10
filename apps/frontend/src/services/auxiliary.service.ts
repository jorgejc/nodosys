/**
 * auxiliary.service.ts — Cliente del registro de actividades del nodo
 *
 * Modelo: un DÍA contiene varias ACTIVIDADES. La fecha se escribe una vez
 * al abrir el día; las actividades que cuelgan de él ya no la repiten.
 *
 * El backend decide qué puede ver y escribir cada rol; aquí solo se llaman
 * los endpoints.
 */
import api from './api';
import type {
  AuxiliaryFunction, ParticipationType, AuxiliaryProfile,
  AuxiliaryDaysPage, AuxiliaryDay, AuxiliaryActivity, AuxiliaryEvidence,
} from '@/types';

/** Lo mínimo para pintar el selector de enganche de una actividad. */
export interface LinkableOrigins {
  activities: { id: string; title: string; date: string | null }[];
  processes:  { id: string; name: string; type: string; status: string }[];
}

/** Filtro y paginación de la vista de días. */
export interface DaysQuery {
  year:      number;
  month:     number;
  page?:     number;
  pageSize?: number;
  search?:   string;
  from?:     string;
  to?:       string;
}

/** Descarga un archivo del backend y dispara el "Guardar como". */
async function downloadBlob(url: string, filename: string, params?: Record<string, unknown>) {
  const response = await api.get(url, { responseType: 'blob', params });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([response.data]));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Quita los campos vacíos para no mandar `search=` ni `from=` en balde. */
function limpio(query: DaysQuery): Record<string, unknown> {
  const params: Record<string, unknown> = { year: query.year, month: query.month };
  if (query.page)     params.page     = query.page;
  if (query.pageSize) params.pageSize = query.pageSize;
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.from) params.from = query.from;
  if (query.to)   params.to   = query.to;
  return params;
}

export const auxiliaryService = {
  // ── Catálogos ───────────────────────────────────────────
  listFunctions: () =>
    api.get<AuxiliaryFunction[]>('/auxiliary/functions').then((r) => r.data),

  listParticipationTypes: () =>
    api.get<ParticipationType[]>('/auxiliary/participation-types').then((r) => r.data),

  /**
   * Actividades y procesos del nodo a los que enganchar.
   *
   * Endpoint propio y no /activities ni /processes: esos filtran por "lo
   * que creaste tú", y el auxiliar no crea ninguno de los dos.
   */
  listLinkable: () =>
    api.get<LinkableOrigins>('/auxiliary/linkable').then((r) => r.data),

  // ── Vista del enlace ────────────────────────────────────
  listAuxiliaries: () =>
    api.get<AuxiliaryProfile[]>('/auxiliary').then((r) => r.data),

  // ── Días con sus actividades ────────────────────────────
  getMyDays: (query: DaysQuery) =>
    api.get<AuxiliaryDaysPage>('/auxiliary/me/days', { params: limpio(query) })
       .then((r) => r.data),

  getAuxiliaryDays: (auxiliaryId: string, query: DaysQuery) =>
    api.get<AuxiliaryDaysPage>(`/auxiliary/${auxiliaryId}/days`, { params: limpio(query) })
       .then((r) => r.data),

  /** Abre el bloque de un día. Si ya existe, el backend lo devuelve. */
  createDay: (logDate: string) =>
    api.post<AuxiliaryDay>('/auxiliary/days', { logDate }).then((r) => r.data),

  deleteDay: (dayId: string) => api.delete(`/auxiliary/days/${dayId}`),

  // ── Actividades del día ─────────────────────────────────
  addActivity: (dayId: string, data: {
    description: string;
    hours?: number;
    functionIds: string[];
    typeIds?: string[];
    activityId?: string;
    processId?: string;
  }) =>
    api.post<AuxiliaryActivity>(`/auxiliary/days/${dayId}/activities`, data)
       .then((r) => r.data),

  updateActivity: (activityId: string, data: Record<string, unknown>) =>
    api.patch<AuxiliaryActivity>(`/auxiliary/activities/${activityId}`, data)
       .then((r) => r.data),

  deleteActivity: (activityId: string) =>
    api.delete(`/auxiliary/activities/${activityId}`),

  // ── Evidencias ──────────────────────────────────────────
  addEvidence: (data: { activityId: string; fileUrl: string; caption?: string }) =>
    api.post<AuxiliaryEvidence>('/auxiliary/evidences', data).then((r) => r.data),

  deleteEvidence: (id: string) => api.delete(`/auxiliary/evidences/${id}`),

  // ── Reporte mensual ─────────────────────────────────────
  downloadMonthlyReport: (
    auxiliaryId: string, year: number, month: number, auxiliaryName?: string,
  ) =>
    downloadBlob(
      `/reports/auxiliary/${auxiliaryId}/mensual/pdf`,
      `reporte-actividades-${slug(auxiliaryName) || auxiliaryId.slice(0, 8)}-${year}-${String(month).padStart(2, '0')}.pdf`,
      { year, month },
    ),
};

// Marcas diacríticas que deja sueltas normalize('NFD') (tildes, diéresis...)
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Nombre de archivo seguro a partir del nombre del auxiliar. */
function slug(name?: string): string {
  if (!name) return '';
  return name
    .normalize('NFD').replace(COMBINING_MARKS, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 40);
}
