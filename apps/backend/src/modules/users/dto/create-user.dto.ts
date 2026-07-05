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
  IsEmail, IsEnum, IsOptional, IsString,
  IsUUID, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, DocumentType } from '../entities/user.entity';
 
export class CreateUserDto {
  @ApiProperty()
  @IsString() @MaxLength(150)
  name: string;
 
  @ApiPropertyOptional({ enum: DocumentType, default: 'CC' })
  @IsEnum(DocumentType) @IsOptional()
  documentType?: DocumentType;
 
  @ApiPropertyOptional({ example: '1234567890' })
  @IsString() @IsOptional()
  documentNumber?: string;
 
  @ApiProperty()
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
 
  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8)
  password: string;
 
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.DOCENTE })
  @IsEnum(UserRole) @IsOptional()
  role?: UserRole;
 
  @ApiPropertyOptional()
  @IsUUID('loose' as any) @IsOptional()
  nodoId?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  nodoName?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  faculty?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  program?: string;

  @ApiPropertyOptional({ description: 'UUID del catálogo de facultades' })
  @IsUUID('loose' as any) @IsOptional()
  facultyId?: string;

  @ApiPropertyOptional({ description: 'UUID del catálogo de programas' })
  @IsUUID('loose' as any) @IsOptional()
  programId?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  phone?: string;

  // Campo legacy
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  cedula?: string;
}
 