import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { CourseSession } from './course-session.entity';

@Entity('session_evidences')
export class SessionEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'file_url', type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  caption: string | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @ManyToOne(() => CourseSession, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'session_id' })
  session: CourseSession;
}
