/**
 * register.dto.ts — DTO del registro público (POST /auth/register)
 *
 * IMPORTANTE (seguridad): este DTO NO hereda de CreateUserDto a propósito.
 * El registro público solo puede informar datos de identidad y académicos
 * en texto. Campos privilegiados como `role`, `nodoId`, `nodoName`,
 * `facultyId`, `programId` o `isActive` NO se exponen aquí, de modo que un
 * usuario anónimo no pueda auto-asignarse un rol (p.ej. admin) ni un nodo.
 * El rol siempre se fuerza a `docente` en el servicio.
 */
import {
  IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty()
  @IsString() @MaxLength(150)
  name: string;

  @ApiProperty()
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: DocumentType, default: 'CC' })
  @IsEnum(DocumentType) @IsOptional()
  documentType?: DocumentType;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsString() @IsOptional()
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsString() @MaxLength(200) @IsOptional()
  faculty?: string;

  @ApiPropertyOptional()
  @IsString() @MaxLength(200) @IsOptional()
  program?: string;
}
