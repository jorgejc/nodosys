/**
 * auxiliary-day.entity.ts — Un día de registro del auxiliar
 *
 * El día es el CONTENEDOR: una fecha, un bloque, y dentro las actividades
 * que se hicieron. Antes cada actividad repetía su propia fecha y diez
 * tareas del 1 de agosto se veían como diez veces "1 de agosto".
 *
 * `nodoId` vive aquí y no en cada actividad: en una fecha la persona
 * estuvo en un nodo, así que el día es la unidad natural del aislamiento.
 * Se copia del perfil al crear el día y NO se reescribe nunca: es el hecho
 * histórico de dónde se hizo ese trabajo.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AuxiliaryActivity } from './auxiliary-activity.entity';

@Entity('auxiliary_days')
// La fecha no se repite: es lo que sostiene "un día = un bloque"
@Index('uq_auxiliary_day', ['auxiliaryId', 'logDate'], { unique: true })
@Index('idx_auxiliary_days_nodo', ['nodoId', 'logDate'])
export class AuxiliaryDay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auxiliary_id', type: 'uuid' })
  auxiliaryId: string;

  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ name: 'log_date', type: 'date' })
  logDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'auxiliary_id' })
  auxiliary: User;

  @OneToMany(() => AuxiliaryActivity, (a) => a.day)
  activities: AuxiliaryActivity[];
}
