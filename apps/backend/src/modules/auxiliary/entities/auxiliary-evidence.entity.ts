/**
 * auxiliary-evidence.entity.ts — Evidencia de un registro o de un evento
 *
 * Se registra pegando el enlace al archivo (Drive, OneDrive...). Cuelga de
 * un registro diario O de una participación, nunca de ambos (CHECK en la
 * base).
 *
 * Mismo criterio que en monitorías: la evidencia es el soporte documental
 * del reporte mensual, así que "eliminar" desde la aplicación solo la
 * marca, y el borrado del padre la deja suelta (SET NULL) en vez de
 * destruirla. Nada de lo que respalda un reporte desaparece en silencio.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { AuxiliaryActivity } from './auxiliary-activity.entity';
import { AuxiliaryDailyLog } from './auxiliary-daily-log.entity';
import { AuxiliaryActivityParticipation } from './auxiliary-activity-participation.entity';

@Entity('auxiliary_evidences')
export class AuxiliaryEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Modelo actual: la evidencia cuelga de una actividad del día. */
  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  // Legacy: a qué colgaba en el modelo viejo (registro diario o
  // participación). Se conservan para no perder la trazabilidad de lo
  // migrado; el flujo nuevo escribe siempre `activity_id`.
  @Column({ name: 'daily_log_id', type: 'uuid', nullable: true })
  dailyLogId: string | null;

  @Column({ name: 'participation_id', type: 'uuid', nullable: true })
  participationId: string | null;

  @Column({ name: 'file_url', type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  caption: string | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  // Borrado lógico: TypeORM excluye las borradas en find() sin que haya
  // que acordarse de filtrar en cada consulta.
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  // ─── Relaciones ──────────────────────────────────────────
  @ManyToOne(() => AuxiliaryActivity, (a) => a.evidences, {
    onDelete: 'SET NULL', eager: false,
  })
  @JoinColumn({ name: 'activity_id' })
  activity: AuxiliaryActivity | null;

  // ─── Legacy ──────────────────────────────────────────────
  @ManyToOne(() => AuxiliaryDailyLog, (l) => l.evidences, {
    onDelete: 'SET NULL', eager: false,
  })
  @JoinColumn({ name: 'daily_log_id' })
  dailyLog: AuxiliaryDailyLog | null;

  @ManyToOne(() => AuxiliaryActivityParticipation, (p) => p.evidences, {
    onDelete: 'SET NULL', eager: false,
  })
  @JoinColumn({ name: 'participation_id' })
  participation: AuxiliaryActivityParticipation | null;
}
