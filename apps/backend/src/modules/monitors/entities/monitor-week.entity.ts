/**
 * monitor-week.entity.ts — Semana del plan de una monitora
 *
 * La semana es ahora una entidad propia: número + rango de fechas. Antes el
 * "nombre de la semana" se repetía como texto en cada actividad; ahora la
 * actividad apunta a esta semana (week_id) y no hay que reescribir el label.
 *
 * `weekNumber` es único por plan (índice único) y se copia denormalizado a
 * cada actividad para conservar el orden y la lógica del tope de 12 h.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { MonitorWorkPlan } from './monitor-work-plan.entity';
import { MonitorWeekActivity } from './monitor-week-activity.entity';

@Entity('monitor_weeks')
export class MonitorWeek {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_plan_id', type: 'uuid' })
  workPlanId: string;

  @Column({ name: 'week_number', type: 'int' })
  weekNumber: number;

  // Fechas del rango de la semana (obligatorias en el flujo nuevo; las
  // semanas migradas de datos viejos pueden quedar sin fecha → null).
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => MonitorWorkPlan, (p) => p.weeks, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'work_plan_id' })
  workPlan: MonitorWorkPlan;

  @OneToMany(() => MonitorWeekActivity, (a) => a.week)
  activities: MonitorWeekActivity[];
}
