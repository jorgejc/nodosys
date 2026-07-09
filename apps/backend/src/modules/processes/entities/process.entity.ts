import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Strategy } from '../../catalogs/entities/strategy.entity';
import { MissionAxis } from '../../catalogs/entities/mission-axis.entity';

export enum ProcessType {
  CURSO   = 'curso',
  CLUB    = 'club',
  TALLER  = 'taller',
  PROCESO = 'proceso',
}

export enum ProcessStatus {
  ACTIVO     = 'activo',
  FINALIZADO = 'finalizado',
}

export enum SessionTemplate {
  TRES_MOMENTOS     = 'tres_momentos',
  DESCRIPCION_LIBRE = 'descripcion_libre',
  INVESTIGACION     = 'investigacion',
}

@Entity('processes')
export class Process {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ProcessType, enumName: 'processes_type_enum', default: ProcessType.PROCESO })
  type: ProcessType;

  @Column({ type: 'enum', enum: ProcessStatus, enumName: 'processes_status_enum', default: ProcessStatus.ACTIVO })
  status: ProcessStatus;

  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ name: 'work_plan_task_id', type: 'uuid', nullable: true })
  workPlanTaskId: string | null;

  @Column({ name: 'strategy_id', type: 'uuid', nullable: true })
  strategyId: string | null;

  @Column({ name: 'mission_axis_id', type: 'uuid', nullable: true })
  missionAxisId: string | null;

  @Column({
    type: 'enum',
    enum: SessionTemplate,
    enumName: 'session_template_enum',
    default: SessionTemplate.TRES_MOMENTOS,
    name: 'session_template',
  })
  sessionTemplate: SessionTemplate;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => Strategy, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'strategy_id' })
  strategy: Strategy | null;

  @ManyToOne(() => MissionAxis, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mission_axis_id' })
  missionAxis: MissionAxis | null;
}
