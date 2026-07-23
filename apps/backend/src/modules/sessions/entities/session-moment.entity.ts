import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { CourseSession } from './course-session.entity';

export enum MomentType {
  EXPLORAR    = 'explorar',
  CREAR       = 'crear',
  CONSOLIDAR  = 'consolidar',
}

@Entity('session_moments')
export class SessionMoment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'moment_type', type: 'enum', enum: MomentType })
  momentType: MomentType;

  @Column({ type: 'text', nullable: true })
  objective: string | null;

  @Column({ type: 'text', nullable: true })
  methodology: string | null;

  @Column({ type: 'text', nullable: true })
  materials: string | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @ManyToOne(() => CourseSession, (s) => s.moments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: CourseSession;
}
