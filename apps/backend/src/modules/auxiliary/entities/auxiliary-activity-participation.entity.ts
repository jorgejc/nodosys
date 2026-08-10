/**
 * auxiliary-activity-participation.entity.ts — Evento en el que participó
 * el auxiliar
 *
 * Dos formas:
 *   ENGANCHADA → cuelga de una actividad del enlace (activity_requests) o
 *                de un proceso del nodo (processes). El nombre lo pone el
 *                registro original, no se reescribe.
 *   SUELTA     → no cuelga de nada y entonces lleva título propio.
 *
 * La base impone los dos invariantes (un solo origen; suelta ⇒ con título)
 * con CHECK, para que un INSERT directo no pueda crear filas que la
 * interfaz no sepa representar.
 *
 * Los tipos de participación son varios por evento: relación N a N contra
 * el catálogo `participation_types`.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, ManyToMany, OneToMany,
  JoinColumn, JoinTable, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ActivityRequest } from '../../activities/entities/activity-request.entity';
import { Process } from '../../processes/entities/process.entity';
import { ParticipationType } from './participation-type.entity';
import { AuxiliaryEvidence } from './auxiliary-evidence.entity';

@Entity('auxiliary_activity_participations')
@Index('idx_aux_part_nodo', ['nodoId', 'eventDate'])
export class AuxiliaryActivityParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auxiliary_id', type: 'uuid' })
  auxiliaryId: string;

  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  // Enganche opcional. SET NULL y no CASCADE: si se borra la actividad del
  // enlace, el registro de que el auxiliar trabajó ese día no desaparece;
  // se queda con su fecha y su descripción.
  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @Column({ name: 'process_id', type: 'uuid', nullable: true })
  processId: string | null;

  @Column({ name: 'event_date', type: 'date' })
  eventDate: string;

  // Obligatorio solo cuando el evento es suelto (lo impone el CHECK)
  @Column({ type: 'varchar', length: 300, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ─── Relaciones ──────────────────────────────────────────
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'auxiliary_id' })
  auxiliary: User;

  @ManyToOne(() => ActivityRequest, { onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'activity_id' })
  activity: ActivityRequest | null;

  @ManyToOne(() => Process, { onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'process_id' })
  process: Process | null;

  @ManyToMany(() => ParticipationType, { eager: false })
  @JoinTable({
    name: 'auxiliary_participation_types',
    joinColumn:        { name: 'participation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'type_id',          referencedColumnName: 'id' },
  })
  types: ParticipationType[];

  @OneToMany(() => AuxiliaryEvidence, (e) => e.participation)
  evidences: AuxiliaryEvidence[];
}
