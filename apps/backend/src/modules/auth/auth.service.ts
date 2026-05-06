/**
 * auth.service.ts — Lógica de autenticación
 *
 * Maneja:
 *  - Login: verifica email + contraseña, devuelve JWT
 *  - Register: crea nuevo usuario
 *  - Profile: devuelve datos del usuario autenticado
 *
 * El JWT es como un carnet digital: el usuario lo guarda
 * y lo presenta en cada petición para demostrar que está autenticado.
 * Tiene una fecha de expiración (7 días por defecto).
 */
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Login ────────────────────────────────────────────────
  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: Partial<User> }> {
    // 1. Buscar usuario por email
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      // No decimos el email no existe por seguridad (evita enumeración de usuarios)
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta está desactivada. Contacta al administrador.');
    }

    // 2. Verificar contraseña
    const isPasswordValid = await user.comparePassword(loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generar JWT
    const token = this.generateToken(user);

    // 4. Devolver token + datos del usuario (sin la contraseña)
    return {
      accessToken: token,
      user: this.sanitizeUser(user),
    };
  }

  // ─── Registro ─────────────────────────────────────────────
  async register(registerDto: RegisterDto): Promise<{ accessToken: string; user: Partial<User> }> {
    // Verificar que el email no exista ya
    const existing = await this.usersService.findByEmail(registerDto.email);
    if (existing) {
      throw new ConflictException('El email ya está registrado en el sistema');
    }

    // Crear el usuario
    const newUser = await this.usersService.create(registerDto);

    // Generar token para que quede logueado inmediatamente
    const token = this.generateToken(newUser);

    return {
      accessToken: token,
      user: this.sanitizeUser(newUser),
    };
  }

  // ─── Perfil del usuario autenticado ──────────────────────
  getProfile(user: User): Partial<User> {
    return this.sanitizeUser(user);
  }

  // ─── Helpers privados ─────────────────────────────────────
  private generateToken(user: User): string {
    // El payload es lo que se guarda dentro del token
    // sub (subject) = ID del usuario — estándar JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  // Elimina la contraseña del objeto antes de enviarlo al frontend
  private sanitizeUser(user: User): Partial<User> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
