import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { WorkPlanAxis } from './work-plan-axis.entity';

export enum ActivityStatus {
  PENDIENTE  = 'pendiente',
  EN_PROCESO = 'en_proceso',
  FINALIZADA = 'finalizada',
}

export enum EvidenceType {
  DOCUMENTO    = 'documento',
  INFORME      = 'informe',
  PRESENTACION = 'presentacion',
  VIDEO        = 'video',
  OTRO         = 'otro',
}

export enum CourseLevel {
  PREGRADO    = 'pregrado',
  POSGRADO    = 'posgrado',
  TECNICO     = 'tecnico',
  TECNOLOGIA  = 'tecnologia',
  OTRO        = 'otro',
}

export enum CourseType {
  TEORICO          = 'teorico',
  TEORICO_PRACTICA = 'teorico_practica',
  PRACTICA         = 'practica',
  LABORATORIO      = 'laboratorio',
}

@Entity('axis_activities')
export class AxisActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'axis_id', type: 'uuid' })
  axisId: string;

  @Column({ name: 'sequence_number', default: 1 })
  sequenceNumber: number;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  // ── Hoja 1: Docencia Directa ─────────────────────────────
  @Column({ name: 'course_code', type: 'varchar', length: 100, nullable: true })
  courseCode: string | null;

  @Column({ name: 'group_code', type: 'varchar', length: 50, nullable: true })
  groupCode: string | null;

  @Column({ name: 'num_students', type: 'int', nullable: true })
  numStudents: number | null;

  @Column({ type: 'enum', enum: CourseLevel, nullable: true })
  level: CourseLevel | null;

  @Column({ name: 'course_type', type: 'enum', enum: CourseType, nullable: true })
  courseType: CourseType | null;

  @Column({ type: 'int', nullable: true })
  weeks: number | null;

  @Column({ name: 'hours_per_week', type: 'decimal', precision: 5, scale: 2, nullable: true })
  hoursPerWeek: number | null;

  // ── Hoja 1: Trabajos de Grado ────────────────────────────
  @Column({ name: 'thesis_modality', type: 'varchar', length: 200, nullable: true })
  thesisModality: string | null;

  @Column({ name: 'student_name', type: 'varchar', length: 300, nullable: true })
  studentName: string | null;

  // ── Horas ─────────────────────────────────────────────────
  @Column({ name: 'planned_hours', type: 'decimal', precision: 8, scale: 2, default: 0 })
  plannedHours: number;

  @Column({ name: 'executed_hours', type: 'decimal', precision: 8, scale: 2, default: 0 })
  executedHours: number;

  // ── Hoja 2: Seguimiento ───────────────────────────────────
  @Column({ name: 'specific_description', type: 'text', nullable: true })
  specificDescription: string | null;

  @Column({ name: 'dim_inclusion', default: false })
  dimInclusion: boolean;

  @Column({ name: 'dim_territorial', default: false })
  dimTerritorial: boolean;

  @Column({ name: 'dim_human', default: false })
  dimHuman: boolean;

  @Column({ name: 'dimension_justification', type: 'text', nullable: true })
  dimensionJustification: string | null;

  @Column({
    name: 'activity_status',
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.PENDIENTE,
  })
  activityStatus: ActivityStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ name: 'evidence_type', type: 'enum', enum: EvidenceType, nullable: true })
  evidenceType: EvidenceType | null;

  @Column({ name: 'evidence_url', type: 'text', nullable: true })
  evidenceUrl: string | null;

  @Column({ name: 'teacher_observations', type: 'text', nullable: true })
  teacherObservations: string | null;

  @Column({ name: 'dean_observations', type: 'text', nullable: true })
  deanObservations: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => WorkPlanAxis, (axis) => axis.activities)
  @JoinColumn({ name: 'axis_id' })
  axis: WorkPlanAxis;

  // Getter: total de horas calculado (docencia directa)
  get totalHoursSemester(): number {
    if (this.weeks && this.hoursPerWeek) {
      return this.weeks * this.hoursPerWeek;
    }
    return this.plannedHours;
  }
}
