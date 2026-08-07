/**
 * monitor-work-plan.entity.ts — Plan de trabajo de una monitora
 *
 * Cada monitora del nodo registra su plan de trabajo por vigencia
 * (ej. '2026-1'). De este plan salen los dos documentos:
 *   - El plan de trabajo completo (Excel)
 *   - El certificado de horas para pago (PDF)
 *
 * `nodoId` se copia del nodo de la monitora al crear el plan y NUNCA
 * viene del body de la petición: es la llave del aislamiento por nodo.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MonitorWeek } from './monitor-week.entity';
import { MonitorWeekActivity } from './monitor-week-activity.entity';
import { MonitorEvidence } from './monitor-evidence.entity';

@Entity('monitor_work_plans')
export class MonitorWorkPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'monitor_id', type: 'uuid' })
  monitorId: string;

  // Nodo al que pertenece la monitora (aislamiento)
  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ type: 'varchar', length: 20 })
  vigencia: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── Relaciones ──────────────────────────────────────────
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'monitor_id' })
  monitor: User;

  @OneToMany(() => MonitorWeek, (w) => w.workPlan)
  weeks: MonitorWeek[];

  @OneToMany(() => MonitorWeekActivity, (a) => a.workPlan)
  activities: MonitorWeekActivity[];

  @OneToMany(() => MonitorEvidence, (e) => e.workPlan)
  evidences: MonitorEvidence[];
}
