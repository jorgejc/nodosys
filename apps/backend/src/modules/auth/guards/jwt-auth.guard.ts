/**
 * jwt-auth.guard.ts — Guard de autenticación
 *
 * Un Guard en NestJS decide si una petición puede continuar o no.
 * @UseGuards(JwtAuthGuard) en un controller → el endpoint requiere token JWT.
 * Si no hay token o es inválido → responde HTTP 401 Unauthorized.
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
