import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('strategies')
export class Strategy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;
}
