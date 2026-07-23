import {
  IsString, IsOptional, IsInt, IsDateString,
  IsEnum, IsBoolean, MaxLength, Min, ValidateNested,
  ArrayMinSize, ArrayMaxSize, IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MomentType } from '../entities/session-moment.entity';

// ── Momento pedagógico dentro de CreateSessionDto ────────
export class MomentDto {
  @ApiProperty({ enum: MomentType })
  @IsEnum(MomentType)
  momentType: MomentType;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  objective?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  methodology?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  materials?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsInt() @Min(1) @IsOptional()
  durationMinutes?: number;
}

// ── Crear sesión ──────────────────────────────────────────
export class CreateSessionDto {
  @ApiProperty({ example: '2026-07-10' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsString() @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsString() @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 'Pensamiento computacional con Scratch' })
  @IsString() @MaxLength(300) @IsOptional()
  topic?: string;

  @ApiPropertyOptional({ example: 'IER El Caníme, Sala de sistemas' })
  @IsString() @MaxLength(300) @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsInt() @Min(0) @IsOptional()
  totalRegistered?: number;

  @ApiPropertyOptional({ example: 'La sesión fue muy dinámica...' })
  @IsString() @IsOptional()
  experience?: string;

  @ApiPropertyOptional({ example: 'Inteligencia artificial aplicada' })
  @IsString() @MaxLength(500) @IsOptional()
  temaTecnico?: string;

  @ApiPropertyOptional({ example: 'MIT App Inventor' })
  @IsString() @MaxLength(300) @IsOptional()
  herramientaSimulador?: string;

  @ApiPropertyOptional({ example: 'Se trabajó la creación de modelos...' })
  @IsString() @IsOptional()
  desarrollo?: string;

  @ApiPropertyOptional({ example: 'Los estudiantes lograron construir...' })
  @IsString() @IsOptional()
  resultados?: string;

  @ApiPropertyOptional({
    type: [MomentDto],
    description: 'Array de 3 momentos: explorar, crear, consolidar',
  })
  @ValidateNested({ each: true })
  @Type(() => MomentDto)
  @ArrayMinSize(0)
  @ArrayMaxSize(3)
  @IsOptional()
  moments?: MomentDto[];
}

export class UpdateSessionDto extends PartialType(CreateSessionDto) {}

// ── Evidencias de sesión ──────────────────────────────────
export class AddSessionEvidenceDto {
  @ApiProperty({ example: 'https://drive.google.com/file/d/...' })
  @IsString() @MaxLength(1000)
  fileUrl: string;

  @ApiPropertyOptional({ example: 'Foto del inicio de la sesión' })
  @IsString() @MaxLength(300) @IsOptional()
  caption?: string;
}

// ── Asistente ─────────────────────────────────────────────
export class AddAttendeeDto {
  @ApiProperty({ example: 'Ana María García López' })
  @IsString() @IsNotEmpty() @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsString() @IsOptional() @MaxLength(50)
  documentNumber?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean() @IsOptional()
  attended?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsInt() @Min(0) @IsOptional()
  absencesCount?: number;
}

export class UpdateAttendeeDto extends PartialType(AddAttendeeDto) {}
