/**
 * participation-type.entity.ts — Catálogo de tipos de participación
 *
 * Documenta EN QUÉ consistió el aporte del auxiliar en una actividad
 * (registro de asistencia, apoyo logístico, registro fotográfico...).
 * Un mismo evento admite varios, por eso la relación es N a N.
 */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('participation_types')
export class ParticipationType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
