/**
 * index.ts — Tipos TypeScript de la aplicación
 *
 * TypeScript nos da "tipos" para evitar errores en tiempo de desarrollo.
 * Si intentas usar user.emaill (doble l), TypeScript te avisa ANTES
 * de que llegue al navegador. Muy útil.
 * 
 * Cuando se agregue un rol nuevo en el backend, se debe añadir acá también
 */

// ── Roles del sistema ─────────────────────────────────────
export type UserRole =
  | 'admin'
  | 'vicerrector_extension'
  | 'vicerrector_academico'    // ← NUEVO
  | 'equipo_extension'         // ← NUEVO
  | 'decano'
  | 'coordinador'
  | 'enlace'
  | 'docente'
  | 'monitor'
  | 'auxiliar';
 
// ── Tipos de documento colombianos ────────────────────────
export type DocumentType =
  | 'CC' | 'TI' | 'RC' | 'PA'
  | 'CE' | 'PEP' | 'PPT' | 'NIT';


export interface User {
  id: string;
  nodoId: string | null;
  nodoName: string | null;
  faculty?: string | null;
  program?: string | null;
  facultyId?: string | null;
  programId?: string | null;
  documentType?: DocumentType | null;
  documentNumber?: string | null;
  cedula?: string | null;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  position: string | null;
  signatureUrl?: string | null;   // firma del enlace (se reutiliza en los certificados)
  isActive: boolean;
  createdAt: string;
}

export interface LoginCredentials { email: string; password: string; }
export interface AuthResponse { accessToken: string; user: User; }
export interface ApiError { statusCode: number; message: string | string[]; error: string; }



// ─── Auth ─────────────────────────────────────────────────
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// ─── Respuesta genérica de la API ─────────────────────────
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

// ── Inventario ────────────────────────────────────────────────────
export type ItemCondition = 'excelente' | 'bueno' | 'regular' | 'malo' | 'dado_de_baja';
export type UnitStatus    = 'disponible' | 'en_prestamo' | 'en_reparacion' | 'dado_de_baja';

export interface InventoryCategory {
  id: string;
  nodoId: string | null;
  name: string;
  description: string | null;
  icon: string;
  createdAt: string;
}

export type LocationType = 'gabinete' | 'mobiliario_suelto';

// Ítem del catálogo (el modelo/tipo)
export interface InventoryItem {
  id: string;
  nodoId: string | null;
  categoryId: string;
  category?: InventoryCategory;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  trackByUnit: boolean;
  imageUrl: string | null;
  notes: string | null;
  // Ubicación física del ítem
  locationType: LocationType | null;
  cabinetNumber: string | null;
  shelfNumber: string | null;
  locationNote: string | null;
  units?: InventoryUnit[];
  // Calculados por el backend en listados
  totalUnits?: number;
  availableUnits?: number;
  damagedUnits?: number;
  createdAt: string;
  updatedAt: string;
}

// Unidad física individual
export interface InventoryUnit {
  id: string;
  itemId: string;
  item?: InventoryItem;
  serialNumber: string | null;
  internalCode: string | null;
  condition: ItemCondition;
  status: UnitStatus;
  location: string;
  acquisitionDate: string | null;
  acquisitionValue: number | null;
  photoUrl: string | null;
  qrCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  unitId: string;
  movementType: string;
  movementDate: string;
  destination: string | null;
  responsible: string | null;
  responsibleId: string | null;
  expectedReturnDate: string | null;
  returnedAt: string | null;
  notes: string | null;
  createdAt: string;
}

// ── Procesos ──────────────────────────────────────────────────────
export type ProcessType     = 'curso' | 'club' | 'taller' | 'proceso';
export type ProcessStatus   = 'activo' | 'finalizado';
export type SessionTemplate = 'tres_momentos' | 'descripcion_libre' | 'investigacion';

export interface MissionAxis {
  id: string;
  name: string;
  parentId: string | null;
  children?: MissionAxis[];
}

export interface Process {
  id: string;
  name: string;
  description: string | null;
  type: ProcessType;
  status: ProcessStatus;
  nodoId: string | null;
  workPlanTaskId: string | null;
  strategyId: string | null;
  missionAxisId: string | null;
  sessionTemplate: SessionTemplate;
  createdBy: string;
  creator?: { id: string; name: string; email: string };
  strategy?: { id: string; name: string } | null;
  missionAxis?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ── Plan de Trabajo ───────────────────────────────────────────────
export type AxisType =
  | 'docencia_directa'
  | 'trabajos_de_grado'
  | 'investigacion'
  | 'extension'
  | 'gestion_de_programas'
  | 'representacion_cuerpos_colegiados'
  | 'otras_administrativas';

export const AXIS_LABELS: Record<AxisType, string> = {
  docencia_directa:                'Docencia Directa',
  trabajos_de_grado:               'Asesoría de Trabajos de Grado',
  investigacion:                   'Investigación',
  extension:                       'Extensión',
  gestion_de_programas:            'Gestión de Programas',
  representacion_cuerpos_colegiados: 'Representación en Cuerpos Colegiados',
  otras_administrativas:           'Otras Actividades Administrativas',
};

export const AXIS_ICONS: Record<AxisType, string> = {
  docencia_directa:                '📚',
  trabajos_de_grado:               '🎓',
  investigacion:                   '🔬',
  extension:                       '🌐',
  gestion_de_programas:            '📋',
  representacion_cuerpos_colegiados: '🏛️',
  otras_administrativas:           '⚙️',
};

export type PlanStatus = 'borrador' | 'activo' | 'completado' | 'archivado';
export type ActivityStatus = 'pendiente' | 'en_proceso' | 'finalizada';
export type EvidenceType = 'documento' | 'informe' | 'presentacion' | 'video' | 'otro';

// Nivel y tipo de curso (para docencia directa)
export type CourseLevel = 'pregrado' | 'posgrado' | 'tecnico' | 'tecnologia' | 'otro';
export type CourseType  = 'teorico' | 'teorico_practica' | 'practica' | 'laboratorio';

export interface WorkPlan {
  id: string;
  userId: string;
  user?: User;
  resolutionNumber: string | null;
  faculty: string | null;
  program: string | null;
  semester: string;          // "2026-1"
  year: number;
  totalHours: number;
  fillDate: string | null;
  status: PlanStatus;
  notes: string | null;
  axes?: WorkPlanAxis[];
  // Calculados
  executedHours?: number;
  completionPercentage?: number;
  createdAt: string;
  updatedAt: string;
}

// Eje misional dentro del plan
export interface WorkPlanAxis {
  id: string;
  workPlanId: string;
  axisType: AxisType;
  plannedHours: number;
  activities?: AxisActivity[];
  // Calculados
  executedHours?: number;
  plannedPercentage?: number;   // % de las horas del eje vs total del plan
  executedPercentage?: number;  // % ejecutado del eje
  activitiesCount?: number;
}

// Actividad específica dentro de un eje
export interface AxisActivity {
  id: string;
  axisId: string;
  sequenceNumber: number;
  name: string;

  // ── Docencia directa ──────────────────────────────────────
  courseCode:   string | null;  // PREICA2502B010017
  groupCode:    string | null;
  numStudents:  number | null;
  level:        CourseLevel | null;
  courseType:   CourseType | null;
  weeks:        number | null;
  hoursPerWeek: number | null;
  // totalHoursSemester = weeks * hoursPerWeek (calculado)

  // ── Trabajos de grado ─────────────────────────────────────
  thesisModality: string | null;
  studentName:    string | null;

  // ── Horas de la actividad ─────────────────────────────────
  plannedHours:  number;   // Horas planeadas para esta actividad
  executedHours: number;   // Horas ejecutadas

  // ── Sheet 2: seguimiento ──────────────────────────────────
  specificDescription:    string | null;
  dimInclusion:           boolean;
  dimTerritorial:         boolean;
  dimHuman:               boolean;
  dimensionJustification: string | null;
  activityStatus:         ActivityStatus;
  startDate:              string | null;
  endDate:                string | null;
  evidenceType:           EvidenceType | null;
  evidenceUrl:            string | null;
  teacherObservations:    string | null;
  deanObservations:       string | null;

  createdAt: string;
  updatedAt: string;
}

// ══════════════════════════════════════════════════════════
// Monitorías (Equipo de Nodo)
// ══════════════════════════════════════════════════════════

/** Tope de horas por semana de una monitora. */
export const MAX_WEEKLY_HOURS = 12;

export interface MonitorEvidence {
  id:         string;
  workPlanId: string;
  activityId: string | null;
  weekNumber: number | null;
  fileUrl:    string;
  caption:    string | null;
  uploadedAt: string;
}

/** Tarea de una semana, con sus evidencias anidadas. */
export interface MonitorWeekActivity {
  id:           string;
  weekId:       string | null;
  weekNumber:   number;
  description:  string;
  hours:        number;
  overrideNote: string | null;
  createdAt:    string;
  evidences:    MonitorEvidence[];
}

/** Semana del plan: rango de fechas + tareas + estado del tope. */
export interface MonitorWeek {
  id:            string;
  weekNumber:    number;
  startDate:     string | null;
  endDate:       string | null;
  hours:         number;
  exceedsCap:    boolean;
  activityCount: number;
  activities:    MonitorWeekActivity[];
}

/** Resumen de una semana para el certificado (rango de horas). */
export interface MonitorWeekSummary {
  weekNumber:    number;
  weekLabel:     string | null;
  hours:         number;
  exceedsCap:    boolean;
  activityCount: number;
}

/** Perfil público de la monitora (sin datos sensibles). */
export interface MonitorProfile {
  id:             string;
  name:           string;
  email:          string;
  documentType:   DocumentType | null;
  documentNumber: string | null;
  program:        string | null;
  faculty:        string | null;
  nodoId:         string | null;
  nodoName:       string | null;
  phone:          string | null;
}

/** Monitora en la lista del enlace, con sus planes por vigencia. */
export interface MonitorListItem extends MonitorProfile {
  plans: { id: string; vigencia: string }[];
}

/** Plan de monitoría con todo lo necesario para pintar la vista. */
export interface MonitorWorkPlan {
  id:             string;
  monitorId:      string;
  nodoId:         string | null;
  vigencia:       string;
  monitor?:       MonitorProfile;
  weeks:          MonitorWeek[];
  /** Evidencias viejas sin tarea asociada (compatibilidad). */
  looseEvidences: MonitorEvidence[];
  totalHours:     number;
  createdAt:      string;
  updatedAt:      string;
}

/** Total de horas de un rango de semanas (base del certificado). */
export interface MonitorHoursRange {
  from:       number;
  to:         number;
  totalHours: number;
  weeks:      MonitorWeekSummary[];
}

// ══════════════════════════════════════════════════════════
// EQUIPO DE NODO · Registro de actividad del AUXILIAR
// ══════════════════════════════════════════════════════════


/** Catálogo: las 10 funciones oficiales del auxiliar. */
export interface AuxiliaryFunction {
  id:           string;
  name:         string;
  displayOrder: number;
}

/** Catálogo: en qué consistió el aporte en una actividad del nodo. */
export interface ParticipationType {
  id:           string;
  name:         string;
  displayOrder: number;
}

export interface AuxiliaryProfile {
  id:             string;
  name:           string;
  email:          string;
  documentType:   string | null;
  documentNumber: string | null;
  nodoId:         string | null;
  nodoName:       string | null;
  phone:          string | null;
}

export interface AuxiliaryEvidence {
  id:         string;
  fileUrl:    string;
  caption:    string | null;
  uploadedAt: string;
}

/**
 * Una actividad dentro de un día. Unifica lo que antes eran "registro
 * diario" y "participación": una actividad enganchada es solo una que
 * además trae activityId/processId.
 */
export interface AuxiliaryActivity {
  id:          string;
  dayId:       string;
  description: string;
  /** null significa "no se registró", no "cero horas". */
  hours:       number | null;
  activityId:  string | null;
  processId:   string | null;
  /** Nombre del registro del nodo al que se engancha, si lo hay. */
  linkLabel:   string | null;
  isLinked:    boolean;
  functions:   { id: string; name: string }[];
  types:       { id: string; name: string }[];
  evidences:   AuxiliaryEvidence[];
  createdAt:   string;
}

/** Un día = un bloque. La fecha no se repite por actividad. */
export interface AuxiliaryDay {
  id:            string;
  logDate:       string;
  nodoId:        string | null;
  activities:    AuxiliaryActivity[];
  activityCount: number;
  totalHours:    number | null;
  createdAt:     string;
}

/** Totales del mes completo, aunque la vista esté paginada. */
export interface AuxiliaryMonthSummary {
  year:          number;
  month:         number;
  daysWithLog:   number;
  activityCount: number;
  evidenceCount: number;
  totalHours:    number | null;
}

export interface AuxiliaryPagination {
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
}

export interface AuxiliaryDaysPage {
  auxiliary:  AuxiliaryProfile;
  year:       number;
  month:      number;
  days:       AuxiliaryDay[];
  pagination: AuxiliaryPagination;
  /** Nodos donde se hizo el trabajo del período (pueden ser varios). */
  nodos:      { id: string; name: string | null }[];
  summary:    AuxiliaryMonthSummary;
}
