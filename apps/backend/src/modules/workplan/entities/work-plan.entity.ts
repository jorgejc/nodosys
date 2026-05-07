import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkPlanAxis } from './work-plan-axis.entity';

export enum PlanStatus {
  BORRADOR  = 'borrador',
  ACTIVO    = 'activo',
  COMPLETADO = 'completado',
  ARCHIVADO = 'archivado',
}

@Entity('work_plans')
export class WorkPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'resolution_number', type: 'varchar', length: 50, nullable: true })
  resolutionNumber: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  faculty: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  program: string | null;

  @Column({ type: 'varchar', length: 20 })
  semester: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'total_hours', type: 'decimal', precision: 8, scale: 2 })
  totalHours: number;

  @Column({ name: 'fill_date', type: 'date', nullable: true })
  fillDate: Date | null;

  @Column({ type: 'enum', enum: PlanStatus, default: PlanStatus.BORRADOR })
  status: PlanStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => WorkPlanAxis, (axis) => axis.workPlan, { cascade: true })
  axes: WorkPlanAxis[];
}
