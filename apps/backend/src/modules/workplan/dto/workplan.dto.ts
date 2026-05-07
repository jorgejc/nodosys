import {
  IsString, IsOptional, IsNumber, IsEnum,
  IsBoolean, IsDateString, IsPositive, MaxLength,
  IsUrl, ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PlanStatus } from '../entities/work-plan.entity';
import { AxisType } from '../entities/work-plan-axis.entity';
import {
  ActivityStatus, EvidenceType,
  CourseLevel, CourseType,
} from '../entities/axis-activity.entity';

// ── Crear plan de trabajo ─────────────────────────────────
export class CreateWorkPlanDto {
  @ApiPropertyOptional({ example: '202502730' })
  @IsString() @IsOptional()
  resolutionNumber?: string;

  @ApiPropertyOptional({ example: 'Ingeniería y Ciencias Agropecuarias' })
  @IsString() @IsOptional()
  faculty?: string;

  @ApiPropertyOptional({ example: 'Tecnología en Desarrollo de Software' })
  @IsString() @IsOptional()
  program?: string;

  @ApiProperty({ example: '2026-1' })
  @IsString()
  semester: string;

  @ApiProperty({ example: 2026 })
  @IsNumber()
  year: number;

  @ApiProperty({ example: 900, description: 'Total de horas del plan' })
  @IsNumber() @IsPositive()
  totalHours: number;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsDateString() @IsOptional()
  fillDate?: string;

  @ApiPropertyOptional({ example: 'borrador', enum: PlanStatus })
  @IsEnum(PlanStatus) @IsOptional()
  status?: PlanStatus;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  notes?: string;
}

export class UpdateWorkPlanDto extends PartialType(CreateWorkPlanDto) {}

// ── Crear / actualizar eje misional ───────────────────────
export class CreateAxisDto {
  @ApiProperty({ enum: AxisType })
  @IsEnum(AxisType)
  axisType: AxisType;

  @ApiProperty({ example: 258, description: 'Horas planeadas para este eje' })
  @IsNumber() @IsPositive()
  plannedHours: number;
}

export class UpdateAxisDto extends PartialType(CreateAxisDto) {}

// ── Crear actividad específica ────────────────────────────
export class CreateActivityDto {
  @ApiProperty({ example: 'Implementación de Métricas para la Calidad de Software' })
  @IsString() @MaxLength(500)
  name: string;

  @ApiPropertyOptional({ example: 36, description: 'Horas planeadas para esta actividad' })
  @IsNumber() @IsOptional()
  plannedHours?: number;

  // Docencia directa
  @ApiPropertyOptional({ example: 'PREICA2502B010017' })
  @IsString() @IsOptional()
  courseCode?: string;

  @ApiPropertyOptional({ example: 'PREICA2502B010017' })
  @IsString() @IsOptional()
  groupCode?: string;

  @ApiPropertyOptional({ example: 35 })
  @IsNumber() @IsOptional()
  numStudents?: number;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsEnum(CourseLevel) @IsOptional()
  level?: CourseLevel;

  @ApiPropertyOptional({ enum: CourseType })
  @IsEnum(CourseType) @IsOptional()
  courseType?: CourseType;

  @ApiPropertyOptional({ example: 9 })
  @IsNumber() @IsOptional()
  weeks?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsNumber() @IsOptional()
  hoursPerWeek?: number;

  // Trabajos de grado
  @ApiPropertyOptional({ example: 'Asesoría de prácticas' })
  @IsString() @IsOptional()
  thesisModality?: string;

  @ApiPropertyOptional({ example: 'Mateo Lara Aristizabal' })
  @IsString() @IsOptional()
  studentName?: string;

  // Hoja 2 - seguimiento
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  specificDescription?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  dimInclusion?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  dimTerritorial?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  dimHuman?: boolean;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  dimensionJustification?: string;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsEnum(ActivityStatus) @IsOptional()
  activityStatus?: ActivityStatus;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsDateString() @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsDateString() @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: EvidenceType })
  @IsEnum(EvidenceType) @IsOptional()
  evidenceType?: EvidenceType;

  @ApiPropertyOptional({ example: 'https://drive.google.com/...' })
  @ValidateIf((o) => !!o.evidenceUrl)
  @IsUrl({}, { message: 'La URL de evidencia no es válida' })
  @IsOptional()
  evidenceUrl?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  executedHours?: number;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  teacherObservations?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  deanObservations?: string;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}
