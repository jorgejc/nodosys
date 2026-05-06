/**
 * auth.module.ts — Módulo de Autenticación
 *
 * Conecta todos los piezas del módulo de auth:
 *  - AuthController: recibe las peticiones HTTP
 *  - AuthService: lógica de negocio
 *  - JwtStrategy: valida los tokens en cada petición protegida
 *  - JwtModule: genera y verifica tokens JWT
 *  - UsersModule: para buscar usuarios en la BD
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // PassportModule integra Passport.js con NestJS
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule: configuración del token JWT
    // Usamos registerAsync para leer el secreto del .env
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),

    // Importamos UsersModule para poder usar UsersService dentro de AuthService
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
