/**
 * inventory-unit.entity.ts — Unidad Física Individual
 *
 * Cada "Unit" es UN objeto físico real en el nodo.
 * Tiene su propio serial, estado y ubicación.
 *
 * Si el ítem es "Portátil HP ProBook" y hay 10,
 * entonces hay 10 registros en esta tabla — uno por cada portátil real.
 *
 * Para ítems sin serial (sillas, mesas): serial_number = null,
 * pero igual se crea un registro por unidad para tener el conteo preciso
 * y saber cuántas están en qué estado.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { InventoryMovement } from './inventory-movement.entity';

// Estado físico de la unidad
export enum UnitCondition {
  EXCELENTE = 'excelente',
  BUENO = 'bueno',
  REGULAR = 'regular',
  MALO = 'malo',
  DADO_DE_BAJA = 'dado_de_baja',
}

// Estado de disponibilidad de la unidad
export enum UnitStatus {
  DISPONIBLE = 'disponible',       // Está en el nodo, listo para usar
  EN_PRESTAMO = 'en_prestamo',     // Salió del nodo (préstamo o traslado)
  EN_REPARACION = 'en_reparacion', // En mantenimiento
  DADO_DE_BAJA = 'dado_de_baja',   // Ya no sirve
}

@Entity('inventory_units')
export class InventoryUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  // ── Identificación única de la unidad ───────────────────
  // Número de serie del fabricante (puede ser null en muebles, etc.)
  @Column({ name: 'serial_number', type: 'varchar', length: 150, nullable: true, unique: true })
  serialNumber: string | null;

  // Código interno del nodo (puede ser el que usa el nodo para marcarlo)
  @Column({ name: 'internal_code', type: 'varchar', length: 100, nullable: true })
  internalCode: string | null;

  // ── Estado y ubicación ───────────────────────────────────
  @Column({
    type: 'enum',
    enum: UnitCondition,
    default: UnitCondition.BUENO,
  })
  condition: UnitCondition;

  @Column({
    type: 'enum',
    enum: UnitStatus,
    default: UnitStatus.DISPONIBLE,
  })
  status: UnitStatus;

  // Dónde está físicamente: "Sala de Cómputo", "Bodega", "Sala Robótica"
  @Column({ type: 'varchar', length: 200, default: 'Sin ubicar' })
  location: string;

  // Fecha en que llegó al nodo
  @Column({ name: 'acquisition_date', type: 'date', nullable: true })
  acquisitionDate: Date | null;

  // Valor en pesos colombianos (para activos fijos)
  @Column({ name: 'acquisition_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  acquisitionValue: number | null;

  // Foto específica de ESTA unidad (diferente a la foto del modelo)
  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  // Código QR generado para esta unidad (para escanear con celular)
  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string | null;

  // Observaciones del estado actual
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Quién registró esta unidad
  @Column({ name: 'registered_by', type: 'uuid', nullable: true })
  registeredBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relaciones ───────────────────────────────────────────
  @ManyToOne(() => InventoryItem, (item) => item.units)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @OneToMany(() => InventoryMovement, (mov) => mov.unit)
  movements: InventoryMovement[];
}
