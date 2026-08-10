/**
 * auxiliary-activity.entity.ts — Una actividad dentro de un día
 *
 * Unifica lo que antes eran dos conceptos separados: el "registro diario"
 * y la "participación en actividades". Ya no hay dos cosas — hay una:
 * una actividad ENGANCHADA a una actividad o proceso del enlace es
 * simplemente una actividad que además tiene `activityId`/`processId`;
 * una SUELTA no los tiene y se identifica por su descripción.
 *
 * Una misma actividad puede responder a VARIAS de las 10 funciones
 * oficiales, que es como se trabaja de verdad: acompañar a un grupo suele
 * ser a la vez apoyo logístico y recolección de información.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, ManyToMany, OneToMany,
  JoinColumn, JoinTable, Index,
} from 'typeorm';
import { AuxiliaryDay } from './auxiliary-day.entity';
import { AuxiliaryFunction } from './auxiliary-function.entity';
import { ParticipationType } from './participation-type.entity';
import { AuxiliaryEvidence } from './auxiliary-evidence.entity';
import { ActivityRequest } from '../../activities/entities/activity-request.entity';
import { Process } from '../../processes/entities/process.entity';

@Entity('auxiliary_activities')
@Index('idx_aux_activities_day', ['dayId'])
export class AuxiliaryActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'day_id', type: 'uuid' })
  dayId: string;

  /** Qué hizo realmente. Es lo que identifica la actividad. */
  @Column({ type: 'text' })
  description: string;

  // Opcional: null significa "no se registró", no "cero horas".
  @Column({
    type: 'decimal', precision: 4, scale: 1, nullable: true,
    transformer: {
      to:   (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  hours: number | null;

  // Enganche opcional. SET NULL y no CASCADE: si el enlace borra su
  // actividad, el registro de que el auxiliar trabajó ese día no
  // desaparece; se queda con su descripción y sus horas.
  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @Column({ name: 'process_id', type: 'uuid', nullable: true })
  processId: string | null;

  /** Solo para no perder el título de las participaciones migradas. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  title: string | null;

  // Procedencia de las filas migradas del modelo viejo. Hacen el backfill
  // idempotente y dejan rastro para poder auditar la migración.
  @Column({ name: 'legacy_daily_log_id', type: 'uuid', nullable: true })
  legacyDailyLogId: string | null;

  @Column({ name: 'legacy_participation_id', type: 'uuid', nullable: true })
  legacyParticipationId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ─── Relaciones ──────────────────────────────────────────
  @ManyToOne(() => AuxiliaryDay, (d) => d.activities, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'day_id' })
  day: AuxiliaryDay;

  @ManyToOne(() => ActivityRequest, { onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'activity_id' })
  activity: ActivityRequest | null;

  @ManyToOne(() => Process, { onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'process_id' })
  process: Process | null;

  /** Varias de las 10 funciones oficiales por actividad. */
  @ManyToMany(() => AuxiliaryFunction, { eager: false })
  @JoinTable({
    name: 'auxiliary_activity_functions',
    joinColumn:        { name: 'activity_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'function_id', referencedColumnName: 'id' },
  })
  functions: AuxiliaryFunction[];

  /** En qué consistió el aporte (solo aplica a lo enganchado, pero es libre). */
  @ManyToMany(() => ParticipationType, { eager: false })
  @JoinTable({
    name: 'auxiliary_activity_types',
    joinColumn:        { name: 'activity_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'type_id',     referencedColumnName: 'id' },
  })
  types: ParticipationType[];

  @OneToMany(() => AuxiliaryEvidence, (e) => e.activity)
  evidences: AuxiliaryEvidence[];
}
