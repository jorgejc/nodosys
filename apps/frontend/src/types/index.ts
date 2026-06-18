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
  documentType?: DocumentType | null;
  documentNumber?: string | null;
  cedula?: string | null;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  position: string | null;
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