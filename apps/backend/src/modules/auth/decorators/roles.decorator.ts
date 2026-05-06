/**
 * roles.decorator.ts — Decorador personalizado @Roles
 *
 * Los decoradores en TypeScript son funciones que anotan clases o métodos.
 * @Roles(UserRole.ENLACE) marca un endpoint como solo para enlace.
 * El RolesGuard lee esta metadata y decide si deja pasar o no.
 */
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
