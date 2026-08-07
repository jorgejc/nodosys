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
 *  monitor / auxiliar     → inventario (lectura)
 *  monitor                → además, su propio plan de monitoría (horas y evidencias)
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
  const canViewOwnPlan      = hasRole('admin','vicerrector_academico','equipo_extension','decano','coordinador','enlace','docente');
  const canViewAllPlans     = hasRole('admin','vicerrector_academico','equipo_extension');
  const canViewFacultyPlans = hasRole('decano','coordinador');
  // vicerrector_extension ve solo planes de usuarios con rol enlace (agrupados por nodo)
  const canViewEnlacePlans  = hasRole('vicerrector_extension');
  const canEditPlan         = hasRole('admin','enlace','docente');
  const canAddDeanObs       = hasRole('admin','decano','vicerrector_academico');

  // ── Actividades ────────────────────────────────────────
  const canViewActividades   = hasRole('admin','vicerrector_extension','equipo_extension','enlace','docente');
  const canViewAllActivities = hasRole('admin','vicerrector_extension');
  const canReviewActivities  = hasRole('admin','vicerrector_extension');

  // ── Procesos ───────────────────────────────────────────
  const canViewProcesos  = hasRole('admin','equipo_extension','enlace','docente');
  const canCreateProceso = hasRole('admin','equipo_extension','enlace','docente');

  // ── Monitorías (Equipo de Nodo) ────────────────────────
  // Los planes de monitoras son operativos del nodo (soporte de pago),
  // no de supervisión académica: las vicerrectorías NO entran por ahora.
  const canViewMonitorias    = hasRole('monitor','enlace','admin');
  const canEditOwnMonitoria  = hasRole('monitor','admin');   // la monitora edita lo suyo
  const canManageMonitorias  = hasRole('enlace','admin');    // el enlace ve las de su nodo
  const canSignCertificates  = hasRole('enlace','admin');    // firma y certifica

  // ── Usuarios ───────────────────────────────────────────
  const canManageUsers = hasRole('admin');
  const canCreateUsers = hasRole('admin');
  const canAssignRoles = hasRole('admin');

  // ── Reportes ───────────────────────────────────────────
  const canViewInventoryReports  = hasRole('admin','vicerrector_extension','enlace','monitor','auxiliar');
  const canViewPlanReports       = hasRole('admin','vicerrector_extension','vicerrector_academico','equipo_extension','decano','coordinador','enlace','docente');
  // Actividades: admin, vice-extensión, enlace, docente (estos dos últimos solo los suyos — el backend filtra)
  const canViewActivityReports   = hasRole('admin','vicerrector_extension','enlace','docente');
  const canViewUserReports       = hasRole('admin');
  const canViewReports = canViewInventoryReports || canViewPlanReports || canViewActivityReports;
 
  return {
    user, role,
    // Inventario
    canViewInventory, canAddInventory, canEditInventory, canDeleteInventory,
    // Planes
    canViewOwnPlan, canViewAllPlans, canViewFacultyPlans, canViewEnlacePlans, canEditPlan, canAddDeanObs,
    // Actividades
    canViewActividades, canViewAllActivities, canReviewActivities,
    // Procesos
    canViewProcesos, canCreateProceso,
    // Monitorías
    canViewMonitorias, canEditOwnMonitoria, canManageMonitorias, canSignCertificates,
    // Usuarios
    canManageUsers, canCreateUsers, canAssignRoles,
    // Reportes
    canViewReports, canViewInventoryReports, canViewPlanReports,
    canViewActivityReports, canViewUserReports,
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