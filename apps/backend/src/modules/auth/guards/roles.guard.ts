/**
 * roles.guard.ts — Guard de autorización por roles
 *
 * Después de verificar que el usuario está autenticado (JwtAuthGuard),
 * este Guard verifica que el usuario tenga el ROL correcto.
 * Ejemplo: solo el enlace puede crear usuarios nuevos.
 *
 * Se usa junto con el decorador @Roles(UserRole.ENLACE)
 */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener los roles requeridos del decorador @Roles(...)
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay @Roles definido, el endpoint es accesible para cualquier rol autenticado
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // req.user viene del JwtAuthGuard (el usuario autenticado)
    const { user } = context.switchToHttp().getRequest();

    // Verificar si el rol del usuario está en la lista de roles permitidos
    return requiredRoles.includes(user.role);
  }
}
