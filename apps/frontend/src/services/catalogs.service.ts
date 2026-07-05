import api from './api';

export interface Faculty {
  id: string;
  name: string;
  email: string | null;
  programs?: CatalogProgram[];
}

export interface CatalogProgram {
  id: string;
  name: string;
  facultyId: string;
}

export interface Municipality {
  id: string;
  name: string;
  department: string | null;
}

export interface Strategy {
  id: string;
  name: string;
}

export const catalogsService = {
  getFaculties: () =>
    api.get<Faculty[]>('/faculties').then(r => r.data),

  getProgramsByFaculty: (facultyId: string) =>
    api.get<CatalogProgram[]>(`/faculties/${facultyId}/programs`).then(r => r.data),

  getPrograms: () =>
    api.get<CatalogProgram[]>('/programs').then(r => r.data),

  getMunicipalities: () =>
    api.get<Municipality[]>('/municipalities').then(r => r.data),

  getStrategies: () =>
    api.get<Strategy[]>('/strategies').then(r => r.data),
};
