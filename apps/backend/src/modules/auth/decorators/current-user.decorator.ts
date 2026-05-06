/**
 * current-user.decorator.ts
 *
 * Decorador que extrae el usuario autenticado del request.
 * En vez de escribir: const user = req.user
 * Puedes escribir: @CurrentUser() user: User
 *
 * Uso en controller:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: User) { return user; }
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
