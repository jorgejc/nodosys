import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { WorkPlan } from './work-plan.entity';
import { AxisActivity } from './axis-activity.entity';

export enum AxisType {
  DOCENCIA_DIRECTA                   = 'docencia_directa',
  TRABAJOS_DE_GRADO                  = 'trabajos_de_grado',
  INVESTIGACION                      = 'investigacion',
  EXTENSION                          = 'extension',
  GESTION_DE_PROGRAMAS               = 'gestion_de_programas',
  REPRESENTACION_CUERPOS_COLEGIADOS  = 'representacion_cuerpos_colegiados',
  OTRAS_ADMINISTRATIVAS              = 'otras_administrativas',
}

export const AXIS_DISPLAY_ORDER: Record<AxisType, number> = {
  [AxisType.DOCENCIA_DIRECTA]: 1,
  [AxisType.TRABAJOS_DE_GRADO]: 2,
  [AxisType.INVESTIGACION]: 3,
  [AxisType.EXTENSION]: 4,
  [AxisType.GESTION_DE_PROGRAMAS]: 5,
  [AxisType.REPRESENTACION_CUERPOS_COLEGIADOS]: 6,
  [AxisType.OTRAS_ADMINISTRATIVAS]: 7,
};

@Entity('work_plan_axes')
export class WorkPlanAxis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_plan_id', type: 'uuid' })
  workPlanId: string;

  @Column({ name: 'axis_type', type: 'enum', enum: AxisType })
  axisType: AxisType;

  @Column({ name: 'planned_hours', type: 'decimal', precision: 8, scale: 2, default: 0 })
  plannedHours: number;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => WorkPlan, (wp) => wp.axes)
  @JoinColumn({ name: 'work_plan_id' })
  workPlan: WorkPlan;

  @OneToMany(() => AxisActivity, (act) => act.axis, { cascade: true })
  activities: AxisActivity[];
}
