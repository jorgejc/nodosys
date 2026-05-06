/**
 * index.ts — Tipos TypeScript de la aplicación
 *
 * TypeScript nos da "tipos" para evitar errores en tiempo de desarrollo.
 * Si intentas usar user.emaill (doble l), TypeScript te avisa ANTES
 * de que llegue al navegador. Muy útil.
 */

// ─── Usuario ──────────────────────────────────────────────
export type UserRole = 'enlace' | 'monitor' | 'auxiliar' | 'docente';

export interface User {
  id: string;
  nodoId: string | null;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  position: string | null;
  isActive: boolean;
  createdAt: string;
}

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

// ─── Inventario ───────────────────────────────────────────
export type ItemCondition =
  | 'excelente'
  | 'bueno'
  | 'regular'
  | 'malo'
  | 'dado_de_baja';

export interface InventoryCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string;
}

export interface InventoryItem {
  id: string;
  nodoId: string;
  categoryId: string;
  category?: InventoryCategory;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  internalCode: string | null;
  quantity: number;
  condition: ItemCondition;
  location: string;
  acquisitionDate: string | null;
  qrCode: string | null;
  imageUrl: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── Plan de trabajo ──────────────────────────────────────
export type ActivityCategory =
  | 'docencia_directa'
  | 'trabajos_de_grado'
  | 'investigacion'
  | 'extension'
  | 'gestion_de_programas'
  | 'representacion_cuerpos_colegiados'
  | 'otras_administrativas';

// Etiquetas legibles para mostrar en la UI
export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  docencia_directa: 'Docencia Directa',
  trabajos_de_grado: 'Trabajos de Grado',
  investigacion: 'Investigación',
  extension: 'Extensión',
  gestion_de_programas: 'Gestión de Programas',
  representacion_cuerpos_colegiados: 'Representación en Cuerpos Colegiados',
  otras_administrativas: 'Otras Actividades Administrativas',
};

export type PlanStatus = 'borrador' | 'activo' | 'completado' | 'archivado';

export interface WorkPlan {
  id: string;
  userId: string;
  nodoId: string | null;
  name: string;
  semester: string;
  totalHours: number;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  generalObjective: string | null;
  createdAt: string;
}

export interface WorkPlanActivity {
  id: string;
  workPlanId: string;
  name: string;
  category: ActivityCategory;
  scheduledHours: number;
  executedHours?: number;       // calculado desde la vista
  remainingHours?: number;      // calculado
  completionPercentage?: number; // calculado
  sessionsCount?: number;        // calculado
  description: string | null;
  targetGroup: string | null;
  location: string | null;
  frequency: string | null;
  isPlanned: boolean;
  addedReason: string | null;
}

export interface ActivitySession {
  id: string;
  activityId: string;
  sessionDate: string;
  durationHours: number;
  title: string | null;
  location: string | null;
  participantsCount: number;
  description: string;
  status: 'realizada' | 'cancelada' | 'reprogramada';
  photos?: SessionPhoto[];
}

export interface SessionPhoto {
  id: string;
  sessionId: string;
  storageUrl: string;
  caption: string | null;
  uploadedAt: string;
}
