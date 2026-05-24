// ── ActivityExpense ───────────────────────────────────────
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { ActivityRequest } from './activity-request.entity';

export enum ExpenseCategory {
  ALIMENTACION   = 'alimentacion',
  TRANSPORTE     = 'transporte',
  HOSPEDAJE      = 'hospedaje',
  MATERIALES     = 'materiales',
  COMUNICACIONES = 'comunicaciones',
  OTRO           = 'otro',
}

@Entity('activity_expenses')
export class ActivityExpense {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'request_id', type: 'uuid' }) requestId: string;
  @Column({ name: 'registered_by', type: 'uuid', nullable: true }) registeredBy: string | null;
  @Column({ name: 'expense_date', type: 'date' }) expenseDate: Date;
  @Column({ type: 'enum', enum: ExpenseCategory }) category: ExpenseCategory;
  @Column({ type: 'varchar', length: 300, nullable: true }) description: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: number;
  @Column({ name: 'receipt_url', type: 'text', nullable: true }) receiptUrl: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @ManyToOne(() => ActivityRequest, (r) => r.expenses)
  @JoinColumn({ name: 'request_id' })
  request: ActivityRequest;
}
