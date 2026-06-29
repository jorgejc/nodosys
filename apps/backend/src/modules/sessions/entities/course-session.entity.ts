import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { SessionMoment } from './session-moment.entity';
import { SessionAttendee } from './session-attendee.entity';
import { SessionEvidence } from './session-evidence.entity';
import { User } from '../../users/entities/user.entity';

@Entity('course_sessions')
export class CourseSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @Column({ name: 'session_number', default: 1 })
  sessionNumber: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime: string | null;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  topic: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  location: string | null;

  @Column({ name: 'total_registered', default: 0 })
  totalRegistered: number;

  @Column({ name: 'process_id', type: 'uuid', nullable: true })
  processId: string | null;

  @Column({ type: 'text', nullable: true })
  experience: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => SessionMoment, (m) => m.session, { cascade: true })
  moments: SessionMoment[];

  @OneToMany(() => SessionAttendee, (a) => a.session, { cascade: true })
  attendees: SessionAttendee[];

  @OneToMany(() => SessionEvidence, (e) => e.session, { cascade: true })
  evidences: SessionEvidence[];
}
