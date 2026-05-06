/**
 * jwt.strategy.ts — Estrategia de validación de JWT
 *
 * Cada vez que el frontend hace una petición con el token JWT
 * en el header Authorization: Bearer <token>, esta estrategia:
 *   1. Extrae el token del header
 *   2. Verifica que el token sea válido y no haya expirado
 *   3. Decodifica el payload (id, email, role)
 *   4. Busca al usuario en la BD para verificar que siga activo
 *   5. Adjunta el usuario al request (req.user)
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

// Interfaz del payload que guardamos dentro del JWT
export interface JwtPayload {
  sub: string;   // ID del usuario (sub = "subject" en estándar JWT)
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // Extraer el token del header: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Si el token expiró, rechazar la petición
      ignoreExpiration: false,
      // La misma clave secreta que usamos para firmar el token
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  // validate() se llama automáticamente con el payload decodificado
  // Lo que retorne aquí queda en req.user
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no autorizado o inactivo');
    }

    return user; // → esto queda disponible como req.user en los controllers
  }
}
