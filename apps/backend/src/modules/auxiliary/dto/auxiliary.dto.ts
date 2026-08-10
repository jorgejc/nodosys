/**
 * auxiliary.dto.ts — DTOs del registro de actividades del auxiliar
 *
 * Modelo: un DÍA contiene varias ACTIVIDADES. La fecha se escribe una vez,
 * al crear el día; las actividades que cuelgan de él ya no la repiten.
 *
 * Nota de seguridad: ningún DTO acepta `auxiliaryId` ni `nodoId`. Ambos los
 * resuelve el servicio a partir del usuario autenticado, para que nadie
 * pueda registrar trabajo a nombre de otra persona ni colarlo en otro nodo.
 */
import {
  IsString, IsOptional, IsUUID, IsUrl, IsInt, IsNumber,
  IsDateString, IsArray, ArrayMaxSize, ArrayNotEmpty, MaxLength, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── El día ────────────────────────────────────────────────
export class CreateDayDto {
  @ApiProperty({ example: '2026-08-06', description: 'Fecha del día (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'La fecha no es válida' })
  logDate: string;
}

// ── La actividad dentro del día ───────────────────────────
export class CreateActivityDto {
  @ApiProperty({ example: 'Acompañamiento a usuarios en sala y registro de asistencia' })
  @IsString() @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ example: 3, description: 'Horas dedicadas (opcional)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0) @Max(24)
  @IsOptional()
  hours?: number;

  @ApiProperty({
    description: 'Funciones que desempeñó (una o varias de las 10 oficiales)',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Indica al menos una función' })
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true, message: 'Alguna de las funciones no es válida' })
  functionIds: string[];

  @ApiPropertyOptional({
    description: 'Tipos de participación (solo si aporta a una actividad del nodo)',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true, message: 'Alguno de los tipos de participación no es válido' })
  @IsOptional()
  typeIds?: string[];

  @ApiPropertyOptional({ description: 'Actividad del nodo a la que se engancha' })
  @IsUUID('4', { message: 'La actividad indicada no es válida' }) @IsOptional()
  activityId?: string;

  @ApiPropertyOptional({ description: 'Proceso del nodo al que se engancha' })
  @IsUUID('4', { message: 'El proceso indicado no es válido' }) @IsOptional()
  processId?: string;
}

export class UpdateActivityDto {
  @ApiPropertyOptional()
  @IsString() @MaxLength(2000) @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 3 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0) @Max(24) @IsOptional()
  hours?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Indica al menos una función' })
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true, message: 'Alguna de las funciones no es válida' })
  @IsOptional()
  functionIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true, message: 'Alguno de los tipos de participación no es válido' })
  @IsOptional()
  typeIds?: string[];
}

// ── Evidencias ────────────────────────────────────────────
export class CreateAuxEvidenceDto {
  @ApiProperty({ description: 'Actividad que documenta' })
  @IsUUID('4', { message: 'Debes indicar la actividad de la evidencia' })
  activityId: string;

  @ApiProperty({ example: 'https://drive.google.com/file/d/...' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true },
         { message: 'La evidencia debe ser una URL http(s) válida' })
  @MaxLength(1000)
  fileUrl: string;

  @ApiPropertyOptional({ example: 'Planilla de asistencia firmada' })
  @IsString() @MaxLength(300) @IsOptional()
  caption?: string;
}

// ── Consulta de días: mes, filtro y paginación ────────────
export class DaysQueryDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt() @Min(2000) @Max(2100)
  year: number;

  @ApiProperty({ example: 8, description: 'Mes (1-12)' })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(12)
  month: number;

  @ApiPropertyOptional({ example: 1, description: 'Página (desde 1)' })
  @Type(() => Number)
  @IsInt() @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10, description: 'Días por página (máx. 31)' })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(31)
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({
    example: 'taller',
    description: 'Busca en la descripción de las actividades del día',
  })
  @IsString() @MaxLength(200) @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Desde esta fecha' })
  @IsDateString({}, { message: 'La fecha "desde" no es válida' }) @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-15', description: 'Hasta esta fecha' })
  @IsDateString({}, { message: 'La fecha "hasta" no es válida' }) @IsOptional()
  to?: string;
}

/** El reporte mensual sigue siendo por mes completo, sin paginar. */
export class MonthQueryDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt() @Min(2000) @Max(2100)
  year: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt() @Min(1) @Max(12)
  month: number;
}
