/**
 * auxiliary-daily-log.entity.ts — Registro diario del auxiliar de nodo
 *
 * Una fila = un día + una función desempeñada + qué hizo. Las horas son
 * opcionales a propósito: no todo el trabajo del auxiliar se mide así, y
 * obligar a un número inventado ensuciaría el reporte.
 *
 * `nodoId` se copia del perfil del auxiliar al escribir y NUNCA llega del
 * body: es la llave del aislamiento entre nodos.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AuxiliaryFunction } from './auxiliary-function.entity';
import { AuxiliaryEvidence } from './auxiliary-evidence.entity';

@Entity('auxiliary_daily_logs')
// Un registro por día y función: sin esto, un doble clic siembra dos filas
// idénticas y descuadra el conteo de "días con registro" del reporte.
@Index('uq_auxiliary_daily_log', ['auxiliaryId', 'logDate', 'functionId'], { unique: true })
export class AuxiliaryDailyLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auxiliary_id', type: 'uuid' })
  auxiliaryId: string;

  // Nodo al que pertenece el auxiliar (aislamiento)
  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ name: 'log_date', type: 'date' })
  logDate: string;

  @Column({ name: 'function_id', type: 'uuid' })
  functionId: string;

  @Column({ type: 'text' })
  description: string;

  // Opcional. PostgreSQL devuelve DECIMAL como string: el transformer lo
  // normaliza a number, y deja el null como null (no como 0, que sería un
  // dato inventado en el reporte).
  @Column({
    type: 'decimal', precision: 4, scale: 1, nullable: true,
    transformer: {
      to:   (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  hours: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ─── Relaciones ──────────────────────────────────────────
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'auxiliary_id' })
  auxiliary: User;

  @ManyToOne(() => AuxiliaryFunction, { eager: false })
  @JoinColumn({ name: 'function_id' })
  function: AuxiliaryFunction;

  @OneToMany(() => AuxiliaryEvidence, (e) => e.dailyLog)
  evidences: AuxiliaryEvidence[];
}
