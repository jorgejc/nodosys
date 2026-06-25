/**
 * inventory.dto.ts — DTOs del módulo de inventario
 *
 * Tres operaciones principales:
 *  1. Crear un ítem del catálogo (el modelo/tipo)
 *  2. Agregar unidades físicas al ítem
 *  3. Registrar un movimiento (salida, devolución, baja...)
 */
import {
  IsString, IsOptional, IsUUID, IsBoolean,
  IsEnum, IsNumber, IsDateString, MaxLength,
  IsPositive, IsInt, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UnitCondition } from '../entities/inventory-unit.entity';
import { MovementType } from '../entities/inventory-movement.entity';

// ─── Crear ítem del catálogo ──────────────────────────────
export class CreateInventoryItemDto {
  @ApiProperty({ example: 'Portátil HP ProBook 440 G8' })
  @IsString() @MaxLength(200)
  name: string;
 
  @ApiPropertyOptional({ example: 'HP' })
  @IsString() @IsOptional()
  brand?: string;
 
  @ApiPropertyOptional({ example: 'ProBook 440 G8' })
  @IsString() @IsOptional()
  model?: string;
 
  @ApiProperty({ description: 'ID de la categoría' })
  @IsUUID()
  categoryId: string;
 
  @ApiPropertyOptional({ description: 'Descripción general del ítem' })
  @IsString() @IsOptional()
  description?: string;
 
  // ── Nuevos campos para juegos didácticos y materiales ──
 
  @ApiPropertyOptional({
    description: 'URL de video YouTube, manual o referencia',
    example: 'https://youtube.com/watch?v=...',
  })
  @IsString() @IsOptional()
  referenceUrl?: string;
 
  @ApiPropertyOptional({
    description: 'Instrucciones de uso o cómo se juega',
    example: 'Este juego se juega en equipos de 3...',
  })
  @IsString() @IsOptional()
  howToUse?: string;
 
  @ApiPropertyOptional({ description: 'Seguimiento por unidad individual' })
  @IsBoolean() @IsOptional()
  trackByUnit?: boolean;
 
  @ApiPropertyOptional({ description: 'ID del nodo al que pertenece' })
  @IsUUID('loose' as any) @IsOptional()
  nodoId?: string;
}

export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {}

// ─── Agregar UNA unidad física ────────────────────────────
export class CreateInventoryUnitDto {
  @ApiPropertyOptional({ example: 'SN1234567890', description: 'Número de serie (null si no aplica)' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 'NODO-PC-001' })
  @IsString()
  @IsOptional()
  internalCode?: string;

  @ApiPropertyOptional({ enum: UnitCondition, default: UnitCondition.BUENO })
  @IsEnum(UnitCondition)
  @IsOptional()
  condition?: UnitCondition;

  @ApiPropertyOptional({ example: 'Sala de Cómputo' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: '2024-03-15' })
  @IsDateString()
  @IsOptional()
  acquisitionDate?: string;

  @ApiPropertyOptional({ example: 2500000, description: 'Valor en pesos colombianos' })
  @IsNumber()
  @IsOptional()
  acquisitionValue?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

// ─── Agregar VARIAS unidades en lote ─────────────────────
// Útil cuando llegan 10 sillas iguales de una vez
export class CreateBulkUnitsDto {
  @ApiProperty({ description: 'Lista de unidades a agregar' })
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateInventoryUnitDto)
  units: CreateInventoryUnitDto[];
}

// Crear N unidades idénticas sin serial (sillas, mesas, etc.)
export class CreateGenericUnitsDto {
  @ApiProperty({ example: 10, description: 'Cuántas unidades crear' })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ example: 'Sala de Reuniones' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ enum: UnitCondition, default: UnitCondition.BUENO })
  @IsEnum(UnitCondition)
  @IsOptional()
  condition?: UnitCondition;

  @ApiPropertyOptional({ example: '2024-03-15' })
  @IsDateString()
  @IsOptional()
  acquisitionDate?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  acquisitionValue?: number;
}

export class UpdateInventoryUnitDto extends PartialType(CreateInventoryUnitDto) {}

// ─── Registrar movimiento ─────────────────────────────────
export class CreateMovementDto {
  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiProperty({ example: '2026-05-03' })
  @IsDateString()
  movementDate: string;

  @ApiPropertyOptional({ example: 'IER El Caníme' })
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiPropertyOptional({ example: 'María Pérez' })
  @IsString()
  @IsOptional()
  responsible?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsString()
  @IsOptional()
  responsibleId?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsDateString()
  @IsOptional()
  expectedReturnDate?: string;

  @ApiPropertyOptional({ example: 'Bueno' })
  @IsString()
  @IsOptional()
  previousCondition?: string;

  @ApiPropertyOptional({ example: 'Regular' })
  @IsString()
  @IsOptional()
  newCondition?: string;

  @ApiPropertyOptional({ example: 'Sala Cómputo' })
  @IsString()
  @IsOptional()
  previousLocation?: string;

  @ApiPropertyOptional({ example: 'Bodega' })
  @IsString()
  @IsOptional()
  newLocation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
