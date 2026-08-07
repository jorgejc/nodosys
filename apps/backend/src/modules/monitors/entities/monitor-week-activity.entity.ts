/**
 * monitor-week-activity.entity.ts — Actividad de una semana del plan
 *
 * Las horas son DECIMAL(4,1) para permitir medias horas (2.5, 3.5...).
 * PostgreSQL devuelve los DECIMAL como string, por eso el transformer
 * los convierte a number al leer.
 *
 * `overrideNote` guarda la autorización del enlace cuando una semana
 * supera el tope de 12 h. La monitora nunca puede pasarse del tope.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { MonitorWorkPlan } from './monitor-work-plan.entity';
import { MonitorWeek } from './monitor-week.entity';
import { MonitorEvidence } from './monitor-evidence.entity';

// Tope semanal de horas de una monitora
export const MAX_WEEKLY_HOURS = 12;

@Entity('monitor_week_activities')
export class MonitorWeekActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_plan_id', type: 'uuid' })
  workPlanId: string;

  // Semana a la que pertenece (flujo nuevo). Nullable por compatibilidad con
  // actividades viejas; el backfill de la migración las enlaza a su semana.
  @Column({ name: 'week_id', type: 'uuid', nullable: true })
  weekId: string | null;

  // weekNumber se conserva denormalizado (copiado de la semana): mantiene el
  // orden y la lógica del tope de 12 h sin tener que hacer join.
  @Column({ name: 'week_number', type: 'int' })
  weekNumber: number;

  // Etiqueta libre de la semana (legacy). El flujo nuevo deriva el nombre de
  // las fechas de la semana; se mantiene la columna para no perder datos.
  @Column({ name: 'week_label', type: 'varchar', length: 120, nullable: true })
  weekLabel: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'decimal', precision: 4, scale: 1, default: 0,
    transformer: {
      to:   (v: number) => v,
      from: (v: string | null) => (v === null ? 0 : Number(v)),
    },
  })
  hours: number;

  // Nota de autorización del enlace cuando la semana supera las 12 h
  @Column({ name: 'override_note', type: 'text', nullable: true })
  overrideNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => MonitorWorkPlan, (p) => p.activities, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'work_plan_id' })
  workPlan: MonitorWorkPlan;

  // NO ACTION, no CASCADE: borrar una semana no puede llevarse las horas por
  // delante. La base bloquea el borrado si la semana todavía tiene tareas,
  // en vez de confiar solo en el count() del servicio.
  @ManyToOne(() => MonitorWeek, (w) => w.activities, { onDelete: 'NO ACTION', eager: false })
  @JoinColumn({ name: 'week_id' })
  week: MonitorWeek | null;

  @OneToMany(() => MonitorEvidence, (e) => e.activity)
  evidences: MonitorEvidence[];
}
