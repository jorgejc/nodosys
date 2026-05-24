import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { ActivityRequest } from './activity-request.entity';

@Entity('activity_participants')
export class ActivityParticipant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'request_id', type: 'uuid' }) requestId: string;
  @Column({ type: 'varchar', length: 200 }) name: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) email: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) institution: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) role: string | null;
  @CreateDateColumn({ name: 'registered_at' }) registeredAt: Date;

  @ManyToOne(() => ActivityRequest, (r) => r.participants)
  @JoinColumn({ name: 'request_id' })
  request: ActivityRequest;
}
