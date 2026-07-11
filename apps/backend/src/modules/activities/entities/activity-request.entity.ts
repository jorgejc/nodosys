import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ActivityExpense } from './activity-expense.entity';
import { ActivityParticipant } from './activity-participant.entity';
import { ActivityEvidence } from './activity-evidence.entity';
import { CourseSession } from '../../sessions/entities/course-session.entity';
import { Strategy } from '../../catalogs/entities/strategy.entity';
import { Municipality } from '../../catalogs/entities/municipality.entity';

export enum RequestStatus {
  BORRADOR     = 'borrador',
  PENDIENTE    = 'pendiente',
  APROBADA     = 'aprobada',
  RECHAZADA    = 'rechazada',
  EN_EJECUCION = 'en_ejecucion',
  EJECUTADA    = 'ejecutada',
  CERRADA      = 'cerrada',
}

export enum PaymentType {
  ANTICIPADO = 'anticipado',
  REEMBOLSO  = 'reembolso',
}

@Entity('activity_requests')
export class ActivityRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'activity_code', type: 'varchar', length: 20, nullable: true, unique: true })
  activityCode: string | null;

  @Column({ name: 'axis_activity_id', type: 'uuid', nullable: true })
  axisActivityId: string | null;

  @Column({ name: 'process_id', type: 'uuid', nullable: true })
  processId: string | null;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ name: 'strategy_id', type: 'uuid', nullable: true })
  strategyId: string | null;

  @Column({ name: 'municipality_id', type: 'uuid', nullable: true })
  municipalityId: string | null;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'activity_date', type: 'date' })
  activityDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  location: string | null;

  @Column({ name: 'expected_participants', default: 0 })
  estimatedParticipants: number;

  @Column({ name: 'resource_detail', type: 'text', nullable: true })
  resourceDetail: string | null;

  @Column({
    name: 'payment_type',
    type: 'enum',
    enum: PaymentType,
    enumName: 'payment_type_enum',
    nullable: true,
  })
  paymentType: PaymentType | null;

  @Column({ name: 'has_electronic_invoice_provider', default: false })
  hasElectronicInvoiceProvider: boolean;

  // Viáticos
  @Column({ name: 'requires_food', default: false })
  requiresFood: boolean;
  @Column({ name: 'food_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  foodAmount: number;

  @Column({ name: 'requires_transport', default: false })
  requiresTransport: boolean;
  @Column({ name: 'transport_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  transportAmount: number;

  @Column({ name: 'requires_accommodation', default: false })
  requiresAccommodation: boolean;
  @Column({ name: 'accommodation_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  accommodationAmount: number;

  @Column({ name: 'requires_materials', default: false })
  requiresMaterials: boolean;
  @Column({ name: 'materials_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  materialsAmount: number;

  @Column({ name: 'requires_other', default: false })
  requiresOther: boolean;
  @Column({ name: 'other_description', type: 'varchar', length: 200, nullable: true })
  otherDescription: string | null;
  @Column({ name: 'other_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  otherAmount: number;

  @Column({ name: 'requires_advance', default: false })
  requiresAdvance: boolean;
  @Column({ name: 'advance_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  advanceAmount: number;

  @Column({ name: 'total_estimated', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEstimated: number;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.BORRADOR })
  status: RequestStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => CourseSession, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'session_id' })
  session: CourseSession | null;

  @ManyToOne(() => Strategy, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'strategy_id' })
  strategy: Strategy | null;

  @ManyToOne(() => Municipality, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality | null;

  @OneToMany(() => ActivityExpense, (e) => e.request, { cascade: true })
  expenses: ActivityExpense[];

  @OneToMany(() => ActivityParticipant, (p) => p.request, { cascade: true })
  participants: ActivityParticipant[];

  @OneToMany(() => ActivityEvidence, (ev) => ev.request, { cascade: true })
  evidence: ActivityEvidence[];
}
