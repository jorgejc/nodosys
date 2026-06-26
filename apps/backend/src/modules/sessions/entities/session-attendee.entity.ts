import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { CourseSession } from './course-session.entity';

@Entity('session_attendees')
export class SessionAttendee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'full_name', type: 'varchar', length: 200 })
  fullName: string;

  @Column({ name: 'document_number', type: 'varchar', length: 50, nullable: true })
  documentNumber: string | null;

  @Column({ default: true })
  attended: boolean;

  @Column({ name: 'absences_count', default: 0 })
  absencesCount: number;

  @Column({ default: true })
  certifiable: boolean;

  @ManyToOne(() => CourseSession, (s) => s.attendees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: CourseSession;
}
