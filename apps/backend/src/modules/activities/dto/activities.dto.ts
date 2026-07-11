import {
  IsString, IsOptional, IsBoolean, IsNumber, IsInt,
  IsEnum, IsDateString, IsPositive, MaxLength, Min, IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RequestStatus, PaymentType } from '../entities/activity-request.entity';
import { ExpenseCategory } from '../entities/activity-expense.entity';
import { EvidenceType } from '../entities/activity-evidence.entity';

// ── Crear solicitud de actividad ──────────────────────────
export class CreateActivityRequestDto {
  @ApiProperty({ example: 'Capacitación Docente en IA Generativa' })
  @IsString() @MaxLength(300)
  title: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  activityDate: string;

  @ApiPropertyOptional({ example: '2026-06-16' })
  @IsDateString() @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: 'IER El Caníme, Arboletes' })
  @IsString() @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsNumber() @IsOptional()
  estimatedParticipants?: number;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  axisActivityId?: string;

  @ApiPropertyOptional({ description: 'Sesión a la que se vincula la actividad' })
  @IsUUID() @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Estrategia (heredada del proceso o elegida si suelta)' })
  @IsUUID() @IsOptional()
  strategyId?: string;

  @ApiPropertyOptional({ description: 'Municipio donde se realiza' })
  @IsUUID() @IsOptional()
  municipalityId?: string;

  @ApiPropertyOptional({ description: 'Detalle de la necesidad: cantidades, recursos y costos' })
  @IsString() @IsOptional()
  resourceDetail?: string;

  @ApiPropertyOptional({ enum: PaymentType, description: 'Pago anticipado (avance) o reembolso' })
  @IsEnum(PaymentType) @IsOptional()
  paymentType?: PaymentType;

  @ApiPropertyOptional({ description: '¿Cuenta con proveedor con factura electrónica?' })
  @IsBoolean() @IsOptional()
  hasElectronicInvoiceProvider?: boolean;

  // Viáticos
  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  requiresFood?: boolean;

  @ApiPropertyOptional({ example: 45000 })
  @IsNumber() @Min(0) @IsOptional()
  foodAmount?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  requiresTransport?: boolean;

  @ApiPropertyOptional({ example: 120000 })
  @IsNumber() @Min(0) @IsOptional()
  transportAmount?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  requiresAccommodation?: boolean;

  @ApiPropertyOptional({ example: 80000 })
  @IsNumber() @Min(0) @IsOptional()
  accommodationAmount?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  requiresMaterials?: boolean;

  @ApiPropertyOptional({ example: 30000 })
  @IsNumber() @Min(0) @IsOptional()
  materialsAmount?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  requiresOther?: boolean;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  otherDescription?: string;

  @ApiPropertyOptional()
  @IsNumber() @Min(0) @IsOptional()
  otherAmount?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  requiresAdvance?: boolean;

  @ApiPropertyOptional()
  @IsNumber() @Min(0) @IsOptional()
  advanceAmount?: number;
}

export class UpdateActivityRequestDto extends PartialType(CreateActivityRequestDto) {}

// ── Aprobar o rechazar ────────────────────────────────────
export class ReviewActivityDto {
  @ApiProperty({ enum: ['aprobada', 'rechazada'] })
  @IsEnum(['aprobada', 'rechazada'])
  decision: 'aprobada' | 'rechazada';

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  reviewerNotes?: string;

  @ApiPropertyOptional({ description: 'Obligatorio si decision=rechazada' })
  @IsString() @IsOptional()
  rejectionReason?: string;
}

// ── Cambiar estado ────────────────────────────────────────
export class UpdateStatusDto {
  @ApiProperty({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  status: RequestStatus;
}

// ── Registrar gasto ───────────────────────────────────────
export class CreateExpenseDto {
  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  expenseDate: string;

  @ApiProperty({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiPropertyOptional({ example: 'Almuerzo 3 personas' })
  @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ example: 45000 })
  @IsNumber() @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'https://storage.supabase.co/...' })
  @IsString() @IsOptional()
  receiptUrl?: string;
}

// ── Registrar participante ────────────────────────────────
export class CreateParticipantDto {
  @ApiProperty({ example: 'Juan Pablo Martínez' })
  @IsString() @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'juan@email.com' })
  @IsString() @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsString() @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'IER El Caníme' })
  @IsString() @IsOptional()
  institution?: string;

  @ApiPropertyOptional({ example: 'Docente' })
  @IsString() @IsOptional()
  role?: string;
}

// ── Registrar evidencia ───────────────────────────────────
export class CreateEvidenceDto {
  @ApiProperty({ enum: EvidenceType })
  @IsEnum(EvidenceType)
  evidenceType: EvidenceType;

  @ApiProperty({ example: 'https://storage.supabase.co/...' })
  @IsString()
  storageUrl: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ example: 'Foto de la inauguración' })
  @IsString() @IsOptional()
  caption?: string;

  @ApiPropertyOptional()
  @IsNumber() @IsOptional()
  fileSizeKb?: number;
}
