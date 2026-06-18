/**
 * update-user.dto.ts
 *
 * PartialType convierte todos los campos de CreateUserDto en opcionales.
 * Así, en el PATCH /users/:id puedes enviar solo los campos que cambian.
 */
import {
  IsEmail, IsEnum, IsOptional, IsString,
  IsUUID, MinLength, MaxLength, IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, DocumentType } from '../entities/user.entity';
 
/**
 * UpdateUserDto — todos los campos son opcionales.
 * Incluye 'password' explícitamente para que el ValidationPipe
 * con forbidNonWhitelisted:true no lo rechace.
 */
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsString() @MaxLength(150) @IsOptional()
  name?: string;
 
  @ApiPropertyOptional({ enum: DocumentType })
  @IsEnum(DocumentType) @IsOptional()
  documentType?: DocumentType;
 
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  documentNumber?: string;
 
  @ApiPropertyOptional()
  @IsEmail() @IsOptional()
  email?: string;
 
  // ← ESTE CAMPO es el que faltaba y causaba el error
  @ApiPropertyOptional({ description: 'Nueva contraseña (mínimo 8 caracteres)' })
  @IsString() @MinLength(8) @IsOptional()
  password?: string;
 
  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole) @IsOptional()
  role?: UserRole;
 
  @ApiPropertyOptional()
  @IsUUID() @IsOptional()
  nodoId?: string;

  @ApiPropertyOptional()
  @IsString() @MaxLength(200) @IsOptional()
  nodoName?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  faculty?: string;
 
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  program?: string;
 
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  phone?: string;
 
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  position?: string;
 
  @ApiPropertyOptional()
  @IsBoolean() @IsOptional()
  isActive?: boolean;
}