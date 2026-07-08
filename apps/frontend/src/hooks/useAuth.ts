/**
 * useAuth.ts — Hook de autorización por roles
 * Control de acceso basado en roles
 * UserRole se importa desde @/types para que sea la fuente única de verdad
 *
 * Centraliza todas las reglas de acceso del sistema.
 * Úsalo en cualquier componente para saber qué puede ver/hacer el usuario.
 */
/**
 * useAuth.ts — Control de acceso por roles
 * Roles:
 *  admin                  → todo
 *  vicerrector_extension  → todos los nodos, solicitudes, sin faculty
 *  vicerrector_academico  → todos los planes de trabajo, sin nodo propio
 *  equipo_extension       → apoyo al vicerrector extensión
 *  decano                 → su facultad, todos los programas de ella
 *  coordinador            → su facultad + su programa
 *  enlace                 → docente + gestor de un nodo
 *  docente                → solo su plan de trabajo
 *  monitor / auxiliar     → solo agregar inventario
 */
import { useAuthStore } from '@/stores/auth.store';
import type { UserRole } from '@/types';
 
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role as UserRole | undefined;
 
  const hasRole = (...roles: UserRole[]) => !!role && roles.includes(role);
 
  // ── Shortcuts de rol ───────────────────────────────────
  const isAdmin      = hasRole('admin');
  const isViceExt    = hasRole('vicerrector_extension');
  const isViceAcad   = hasRole('vicerrector_academico');
  const isEquipoExt  = hasRole('equipo_extension');
  const isDecano     = hasRole('decano');
  const isCoord      = hasRole('coordinador');
  const isEnlace     = hasRole('enlace');
  const isDocente    = hasRole('docente');
  const isMonAux     = hasRole('monitor', 'auxiliar');
 
  // Puede ver planes sin estar en una facultad específica
  const isGlobalViewer = isAdmin || isViceExt || isViceAcad || isEquipoExt;
 
  // ── Inventario ─────────────────────────────────────────
  // Lectura: admin, vicerrector_extension, enlace, monitor, auxiliar
  // Escritura: admin, vicerrector_extension, enlace
  const canViewInventory   = hasRole('admin','vicerrector_extension','enlace','monitor','auxiliar');
  const canAddInventory    = hasRole('admin','vicerrector_extension','enlace');
  const canEditInventory   = hasRole('admin','vicerrector_extension','enlace');
  const canDeleteInventory = hasRole('admin','enlace');

  // ── Planes de trabajo ──────────────────────────────────
  // vicerrector_extension NO tiene planes; ve solo actividades e inventarios
  const canViewOwnPlan      = hasRole('admin','vicerrector_academico','equipo_extension','decano','coordinador','enlace','docente');
  const canViewAllPlans     = hasRole('admin','vicerrector_academico','equipo_extension');
  const canViewFacultyPlans = hasRole('decano','coordinador');
  const canEditPlan         = hasRole('admin','enlace','docente');
  const canAddDeanObs       = hasRole('admin','decano','vicerrector_academico');

  // ── Actividades ────────────────────────────────────────
  const canViewActividades   = hasRole('admin','vicerrector_extension','equipo_extension','enlace','docente');
  const canViewAllActivities = hasRole('admin','vicerrector_extension');
  const canReviewActivities  = hasRole('admin','vicerrector_extension');

  // ── Procesos ───────────────────────────────────────────
  const canViewProcesos  = hasRole('admin','equipo_extension','enlace','docente');
  const canCreateProceso = hasRole('admin','equipo_extension','enlace','docente');

  // ── Usuarios ───────────────────────────────────────────
  const canManageUsers = hasRole('admin');
  const canCreateUsers = hasRole('admin');
  const canAssignRoles = hasRole('admin');

  // ── Reportes ───────────────────────────────────────────
  // Reportes de inventario: quien puede ver inventario
  const canViewInventoryReports = hasRole('admin','vicerrector_extension','enlace','monitor','auxiliar');
  // Reportes de planes: quien puede ver planes
  const canViewPlanReports = hasRole('admin','vicerrector_academico','equipo_extension','decano','coordinador','enlace','docente');
  const canViewReports = canViewInventoryReports || canViewPlanReports;
 
  return {
    user, role,
    // Inventario
    canViewInventory, canAddInventory, canEditInventory, canDeleteInventory,
    // Planes
    canViewOwnPlan, canViewAllPlans, canViewFacultyPlans, canEditPlan, canAddDeanObs,
    // Actividades
    canViewActividades, canViewAllActivities, canReviewActivities,
    // Procesos
    canViewProcesos, canCreateProceso,
    // Usuarios
    canManageUsers, canCreateUsers, canAssignRoles,
    // Reportes
    canViewReports, canViewInventoryReports, canViewPlanReports,
    // Helpers
    isAdmin, isViceExt, isViceAcad, isEquipoExt,
    isDecano, isCoord, isEnlace, isDocente, isMonAux,
    isGlobalViewer,
    isDirector: isAdmin || isViceExt || isViceAcad || isEquipoExt || isDecano || isCoord,
    isVicerrector: isViceExt || isViceAcad,
    isMonitorOrAuxiliar: isMonAux,
    hasRole,
  };
}