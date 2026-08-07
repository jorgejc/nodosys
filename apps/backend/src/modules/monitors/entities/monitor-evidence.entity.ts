/**
 * monitor-evidence.entity.ts — Evidencia del plan de una monitora
 *
 * La evidencia se registra pegando el enlace al archivo (Drive, OneDrive...).
 * Opcionalmente se asocia a una semana concreta.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { MonitorWorkPlan } from './monitor-work-plan.entity';
import { MonitorWeekActivity } from './monitor-week-activity.entity';

@Entity('monitor_evidences')
export class MonitorEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_plan_id', type: 'uuid' })
  workPlanId: string;

  // Tarea a la que documenta la evidencia (flujo nuevo). Nullable por
  // compatibilidad: las evidencias viejas solo tenían week_number.
  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  // Semana (legacy). Se conserva para no perder las evidencias antiguas.
  @Column({ name: 'week_number', type: 'int', nullable: true })
  weekNumber: number | null;

  @Column({ name: 'file_url', type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  caption: string | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  // Borrado lógico: la evidencia es el soporte del pago, así que "eliminar"
  // desde la app solo la marca. TypeORM excluye las borradas en find().
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => MonitorWorkPlan, (p) => p.evidences, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'work_plan_id' })
  workPlan: MonitorWorkPlan;

  // SET NULL, no CASCADE: si se borra la tarea, la evidencia sobrevive y
  // queda suelta (looseEvidences) en vez de desaparecer con ella.
  @ManyToOne(() => MonitorWeekActivity, (a) => a.evidences, { onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'activity_id' })
  activity: MonitorWeekActivity | null;
}
