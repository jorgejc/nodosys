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
  const canViewInventory   = hasRole('admin','vicerrector_extension','vicerrector_academico','equipo_extension','decano','coordinador','enlace','docente','monitor','auxiliar');
  const canAddInventory    = hasRole('admin','enlace','monitor','auxiliar');
  const canEditInventory   = hasRole('admin','enlace');
  const canDeleteInventory = hasRole('admin','enlace');
 
  // ── Planes de trabajo ──────────────────────────────────
  const canViewOwnPlan     = hasRole('admin','vicerrector_extension','vicerrector_academico','equipo_extension','decano','coordinador','enlace','docente');
  const canViewAllPlans    = hasRole('admin','vicerrector_extension','vicerrector_academico');
  const canViewFacultyPlans = hasRole('decano','coordinador');
  const canEditPlan        = hasRole('admin','enlace','docente');
  const canAddDeanObs      = hasRole('admin','decano','vicerrector_academico');
 
  // ── Actividades ────────────────────────────────────────
  const canViewAllActivities = hasRole('admin','vicerrector_extension','equipo_extension');
  const canReviewActivities  = hasRole('admin','vicerrector_extension','decano');
 
  // ── Usuarios ───────────────────────────────────────────
  const canManageUsers = hasRole('admin','enlace','vicerrector_extension','decano','coordinador');
  const canCreateUsers = hasRole('admin','enlace');
  const canAssignRoles = hasRole('admin');
 
  // ── Reportes ───────────────────────────────────────────
  const canViewReports = hasRole('admin','vicerrector_extension','vicerrector_academico','equipo_extension','decano','coordinador','enlace','docente');
 
  return {
    user, role,
    // Inventario
    canViewInventory, canAddInventory, canEditInventory, canDeleteInventory,
    // Planes
    canViewOwnPlan, canViewAllPlans, canViewFacultyPlans, canEditPlan, canAddDeanObs,
    // Actividades
    canViewAllActivities, canReviewActivities,
    // Usuarios
    canManageUsers, canCreateUsers, canAssignRoles,
    // Reportes
    canViewReports,
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