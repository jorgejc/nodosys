/**
 * useAuth.ts — Hook de autorización por roles
 *
 * Centraliza todas las reglas de acceso del sistema.
 * Úsalo en cualquier componente para saber qué puede ver/hacer el usuario.
 */
import { useAuthStore } from '@/stores/auth.store';
import type { UserRole } from '@/types';

// Jerarquía de permisos
const ADMIN_ROLES:     UserRole[] = ['admin'];
const DIRECTOR_ROLES:  UserRole[] = ['admin', 'vicerrector_extension'];
const ACADEMIC_ROLES:  UserRole[] = ['admin', 'vicerrector_extension', 'decano', 'coordinador'];
const TEACHER_ROLES:   UserRole[] = ['admin', 'vicerrector_extension', 'decano', 'coordinador', 'enlace', 'docente'];
const INVENTORY_ROLES: UserRole[] = ['admin', 'enlace', 'monitor', 'auxiliar'];

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role as UserRole | undefined;

  const hasRole = (...roles: UserRole[]) => !!role && roles.includes(role);

  return {
    user,
    role,

    // ── ¿Puede gestionar usuarios? ────────────────────────
    canManageUsers:     hasRole(...ADMIN_ROLES, 'enlace'),
    canCreateUsers:     hasRole(...ADMIN_ROLES),
    canAssignRoles:     hasRole(...ADMIN_ROLES),

    // ── ¿Puede ver inventario? ────────────────────────────
    canViewInventory:   hasRole(...INVENTORY_ROLES, ...ACADEMIC_ROLES),
    canEditInventory:   hasRole('admin', 'enlace'),
    canAddInventory:    hasRole('admin', 'enlace', 'monitor', 'auxiliar'),
    canDeleteInventory: hasRole('admin', 'enlace'),

    // ── ¿Puede ver planes de trabajo? ─────────────────────
    canViewOwnPlan:     hasRole(...TEACHER_ROLES, 'monitor', 'auxiliar'),
    canViewAllPlans:    hasRole(...DIRECTOR_ROLES, 'decano'),
    canViewFacultyPlans: hasRole('decano'),  // solo su facultad
    canEditPlan:        hasRole('admin', 'enlace', 'docente'),
    canAddDeanObs:      hasRole('decano', 'admin'),

    // ── ¿Puede ver reportes? ──────────────────────────────
    canViewReports:     hasRole(...TEACHER_ROLES),

    // ── ¿Es rol administrativo? ───────────────────────────
    isAdmin:            hasRole('admin'),
    isVicerrector:      hasRole('vicerrector_extension'),
    isDecano:           hasRole('decano'),
    isCoordinador:      hasRole('coordinador'),
    isEnlace:           hasRole('enlace'),
    isDocente:          hasRole('docente'),
    isMonitorOrAuxiliar: hasRole('monitor', 'auxiliar'),

    // ── Helper general ────────────────────────────────────
    hasRole,
  };
}
