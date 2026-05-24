import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { ActivityRequest } from './activity-request.entity';

export enum EvidenceType {
  FOTO_EVENTO            = 'foto_evento',
  FACTURA                = 'factura',
  FACTURA_PENDIENTE      = 'factura_pendiente',
  REGISTRO_PARTICIPANTES = 'registro_participantes',
  OTRO                   = 'otro',
}

@Entity('activity_evidence')
export class ActivityEvidence {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'request_id', type: 'uuid' }) requestId: string;
  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true }) uploadedBy: string | null;
  @Column({ name: 'evidence_type', type: 'enum', enum: EvidenceType }) evidenceType: EvidenceType;
  @Column({ name: 'storage_url', type: 'text' }) storageUrl: string;
  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true }) fileName: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) caption: string | null;
  @Column({ name: 'file_size_kb', type: 'int', nullable: true }) fileSizeKb: number | null;
  @CreateDateColumn({ name: 'uploaded_at' }) uploadedAt: Date;

  @ManyToOne(() => ActivityRequest, (r) => r.evidence)
  @JoinColumn({ name: 'request_id' })
  request: ActivityRequest;
}
