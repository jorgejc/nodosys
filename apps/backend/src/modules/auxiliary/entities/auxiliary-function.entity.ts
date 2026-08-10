/**
 * auxiliary-function.entity.ts — Catálogo de funciones del auxiliar
 *
 * Las 10 funciones oficiales definidas por la Vicerrectoría de Extensión.
 * Es un catálogo en tabla, no un enum ni texto libre: el texto libre
 * produce variantes del mismo valor y hace imposible agrupar el reporte
 * mensual por función.
 */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('auxiliary_functions')
export class AuxiliaryFunction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;

  // Orden oficial del listado de la Vicerrectoría (1..10)
  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
