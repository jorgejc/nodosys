/**
 * update-self.dto.ts — Campos que un usuario NO admin puede editar de su
 * propio perfil (PATCH /users/:id sobre sí mismo).
 *
 * SEGURIDAD: a diferencia de UpdateUserDto (que usa el admin), este DTO NO
 * incluye `role`, `nodoId`, `nodoName`, `isActive`, `facultyId` ni `programId`.
 * Así un usuario no puede auto-promoverse de rol, cambiarse de nodo ni
 * reactivar su cuenta editando su propio perfil.
 *
 * La lista de claves permitidas se exporta como SELF_EDITABLE_FIELDS para
 * aplicarla como whitelist en el servicio (defensa en profundidad, aunque
 * el body traiga campos de más).
 */
import {
  IsEmail, IsEnum, IsOptional, IsString, MinLength, MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../entities/user.entity';

export class UpdateSelfDto {
  @ApiPropertyOptional()
  @IsString() @MaxLength(150) @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsEmail() @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Nueva contraseña (mínimo 8 caracteres)' })
  @IsString() @MinLength(8) @IsOptional()
  password?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsEnum(DocumentType) @IsOptional()
  documentType?: DocumentType;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  documentNumber?: string;
}

// Whitelist de claves auto-editables. Debe coincidir con los campos de arriba.
export const SELF_EDITABLE_FIELDS = [
  'name', 'email', 'password', 'phone', 'documentType', 'documentNumber',
] as const;
