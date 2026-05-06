/**
 * inventory-movement.entity.ts — Movimiento de Inventario
 *
 * Cada vez que una unidad sale del nodo, regresa, se da de baja,
 * o cambia de estado, se registra aquí. Es la trazabilidad completa.
 *
 * Con esto puedes responder preguntas como:
 *  - ¿Quién tiene el portátil con serial ABC123?
 *  - ¿Cuándo regresa?
 *  - ¿Cuántas veces salió el proyector este año?
 *  - ¿Qué ítems están en préstamo actualmente?
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { InventoryUnit } from './inventory-unit.entity';

export enum MovementType {
  ENTRADA = 'entrada',           // Llegó un equipo nuevo al nodo
  SALIDA = 'salida',             // Salió del nodo (préstamo o traslado)
  DEVOLUCION = 'devolucion',     // Regresó al nodo
  BAJA = 'baja',                 // Se da de baja definitivamente
  CAMBIO_ESTADO = 'cambio_estado', // Se actualizó la condición (ej: de bueno a regular)
  CAMBIO_UBICACION = 'cambio_ubicacion', // Se movió dentro del nodo
}

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  // Quién registró el movimiento en el sistema
  @Column({ name: 'registered_by', type: 'uuid', nullable: true })
  registeredBy: string | null;

  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: MovementType,
  })
  movementType: MovementType;

  @Column({ name: 'movement_date', type: 'date' })
  movementDate: Date;

  // ── Para movimientos de SALIDA/PRÉSTAMO ─────────────────
  // A dónde va: "IER El Caníme", "Alcaldía de Arboletes"
  @Column({ type: 'varchar', length: 200, nullable: true })
  destination: string | null;

  // Nombre de quien recibe el equipo
  @Column({ type: 'varchar', length: 200, nullable: true })
  responsible: string | null;

  // Cédula o identificación de quien recibe
  @Column({ name: 'responsible_id', type: 'varchar', length: 50, nullable: true })
  responsibleId: string | null;

  // Fecha esperada de devolución
  @Column({ name: 'expected_return_date', type: 'date', nullable: true })
  expectedReturnDate: Date | null;

  // Fecha real de devolución (se llena cuando regresa)
  @Column({ name: 'returned_at', type: 'date', nullable: true })
  returnedAt: Date | null;

  // ── Para CAMBIO DE ESTADO ────────────────────────────────
  @Column({ name: 'previous_condition', type: 'varchar', length: 50, nullable: true })
  previousCondition: string | null;

  @Column({ name: 'new_condition', type: 'varchar', length: 50, nullable: true })
  newCondition: string | null;

  // ── Para CAMBIO DE UBICACIÓN ─────────────────────────────
  @Column({ name: 'previous_location', type: 'varchar', length: 200, nullable: true })
  previousLocation: string | null;

  @Column({ name: 'new_location', type: 'varchar', length: 200, nullable: true })
  newLocation: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ── Relaciones ───────────────────────────────────────────
  @ManyToOne(() => InventoryUnit, (unit) => unit.movements)
  @JoinColumn({ name: 'unit_id' })
  unit: InventoryUnit;
}
