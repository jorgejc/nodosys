/**
 * create-user.dto.ts — Data Transfer Object para crear un usuario
 *
 * Un DTO (Data Transfer Object) define la estructura y validación
 * de los datos que llegan en el body de una petición HTTP.
 *
 * Los decoradores de class-validator (@IsEmail, @IsString, etc.)
 * validan automáticamente los datos. Si algo falla, NestJS responde
 * con HTTP 400 Bad Request antes de llegar al Service.
 */
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'Jorge Andrés Pérez', description: 'Nombre completo' })
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'jorge.perez@iudigital.edu.co' })
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email: string;

  @ApiProperty({ example: 'MiContraseña123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.DOCENTE })
  @IsEnum(UserRole, { message: 'El rol no es válido' })
  @IsOptional()
  role?: UserRole;

  // UUID del nodo — opcional para docentes virtuales
  @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000001' })
  @IsUUID('4', { message: 'El nodoId debe ser un UUID válido' })
  @IsOptional()
  nodoId?: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Docente Ocasional TC' })
  @IsString()
  @IsOptional()
  position?: string;
}
