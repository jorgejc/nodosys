/**
 * monitors.dto.ts — DTOs del módulo de Monitorías
 *
 * Nota de seguridad: ningún DTO acepta `monitorId` ni `nodoId` para el
 * propio plan. Esos valores los resuelve el servicio a partir del usuario
 * autenticado, para que nadie pueda crear un plan a nombre de otra persona
 * ni colarlo en otro nodo.
 */
import {
  IsString, IsOptional, IsInt, IsNumber, IsUUID,
  IsUrl, MaxLength, Min, Max, Matches, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Crear plan de trabajo ─────────────────────────────────
export class CreateMonitorPlanDto {
  @ApiProperty({ example: '2026-1', description: 'Vigencia del plan' })
  @IsString() @MaxLength(20)
  @Matches(/^\d{4}-[12]$/, { message: 'La vigencia debe tener el formato AAAA-1 o AAAA-2' })
  vigencia: string;

  @ApiPropertyOptional({ description: 'Solo admin: crear el plan para otra monitora' })
  @IsUUID() @IsOptional()
  monitorId?: string;
}

// ── Semana del plan (número + rango de fechas) ────────────
export class CreateMonitorWeekDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(60)
  weekNumber: number;

  @ApiProperty({ example: '2026-02-01', description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'La fecha de inicio no es válida' })
  startDate: string;

  @ApiProperty({ example: '2026-02-05', description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'La fecha de fin no es válida' })
  endDate: string;
}

export class UpdateMonitorWeekDto {
  @ApiPropertyOptional({ example: 12 })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(60) @IsOptional()
  weekNumber?: number;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsDateString({}, { message: 'La fecha de inicio no es válida' }) @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-02-05' })
  @IsDateString({}, { message: 'La fecha de fin no es válida' }) @IsOptional()
  endDate?: string;
}

// ── Actividad (tarea) de una semana ───────────────────────
export class CreateWeekActivityDto {
  @ApiProperty({ description: 'Semana (ya creada) a la que pertenece la tarea' })
  @IsUUID('4', { message: 'Debes elegir una semana válida' })
  weekId: string;

  @ApiProperty({ example: 'Acompañamiento en sala de cómputo' })
  @IsString() @MaxLength(2000)
  description: string;

  @ApiProperty({ example: 2.5, description: 'Horas (admite medias horas)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0) @Max(60)
  hours: number;

  @ApiPropertyOptional({
    description: 'Autorización del enlace para superar el tope de 12 h en la semana',
  })
  @IsString() @MaxLength(1000) @IsOptional()
  overrideNote?: string;
}

export class UpdateWeekActivityDto {
  @ApiPropertyOptional()
  @IsString() @MaxLength(2000) @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 3.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0) @Max(60) @IsOptional()
  hours?: number;

  @ApiPropertyOptional()
  @IsString() @MaxLength(1000) @IsOptional()
  overrideNote?: string;
}

// ── Evidencias (ahora cuelgan de una TAREA) ───────────────
export class CreateEvidenceDto {
  @ApiProperty({ description: 'Tarea que documenta la evidencia' })
  @IsUUID('4', { message: 'Debes indicar la tarea de la evidencia' })
  activityId: string;

  @ApiProperty({ example: 'https://drive.google.com/file/d/...' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true },
         { message: 'La evidencia debe ser una URL http(s) válida' })
  @MaxLength(1000)
  fileUrl: string;

  @ApiPropertyOptional({ example: 'Registro fotográfico del taller' })
  @IsString() @MaxLength(300) @IsOptional()
  caption?: string;
}

// ── Firma del enlace ──────────────────────────────────────
export class UpdateSignatureDto {
  @ApiProperty({ example: 'https://.../firma-enlace.png' })
  @IsUrl({ protocols: ['https'], require_protocol: true },
         { message: 'La firma debe ser una URL https válida' })
  @MaxLength(1000)
  signatureUrl: string;
}

// ── Rango de semanas (query del certificado / total de horas) ──
export class WeekRangeQueryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(60)
  from: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(60)
  to: number;
}

// ── Query del certificado de horas ────────────────────────
export class CertificateQueryDto extends WeekRangeQueryDto {
  @ApiPropertyOptional({ description: 'Observaciones que se imprimen en el certificado' })
  @IsString() @MaxLength(1500) @IsOptional()
  observaciones?: string;
}
