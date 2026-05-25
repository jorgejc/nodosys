/**
 * inventory-item.entity.ts — Ítem del Catálogo
 *
 * ─── CONCEPTO CLAVE ──────────────────────────────────────────
 * Un "Item" es el TIPO o MODELO de equipo/material.
 * NO es la unidad física individual.
 *
 * Ejemplo:
 *  Item: "Portátil HP ProBook 440 G8"
 *  └── Unidad 1: serial ABC123, estado: bueno,   ubicación: Sala Cómputo
 *  └── Unidad 2: serial DEF456, estado: regular, ubicación: Sala Cómputo
 *  └── Unidad 3: serial GHI789, estado: dañado,  ubicación: Bodega
 *
 * Así resolvemos el problema del Excel:
 *  - Excel: "Portátil HP - Cantidad: 10" (no sabe cuál está dañado)
 *  - NodoSys: 1 ítem + 10 unidades rastreables individualmente
 * ─────────────────────────────────────────────────────────────
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { InventoryCategory } from './inventory-category.entity';
import { InventoryUnit } from './inventory-unit.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ name: 'registered_by', type: 'uuid', nullable: true })
  registeredBy: string | null;

  // ── Identificación del modelo/tipo ──────────────────────
  @Column({ type: 'varchar', length: 200 })
  name: string; // "Portátil HP ProBook 440 G8"

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null; // "HP"

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null; // "ProBook 440 G8"

  // Descripción técnica o pedagógica del ítem
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // URL de foto representativa del modelo (no de la unidad física)
  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'reference_url', type: 'text', nullable: true })
  referenceUrl: string | null;

  @Column({ name: 'how_to_use', type: 'text', nullable: true })
  howToUse: string | null;

  // ¿Se lleva control individual por unidad o solo cantidad total?
  // true  → equipos con serial (computadores, tablets, fuentes)
  // false → ítems genéricos sin serial (sillas, mesas, cuadernos)
  @Column({ name: 'track_by_unit', default: true })
  trackByUnit: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // ── Relaciones ───────────────────────────────────────────
  @ManyToOne(() => InventoryCategory, (cat) => cat.items, { eager: true })
  @JoinColumn({ name: 'category_id' })
  category: InventoryCategory;

  @OneToMany(() => InventoryUnit, (unit) => unit.item, { cascade: true })
  units: InventoryUnit[];
}
