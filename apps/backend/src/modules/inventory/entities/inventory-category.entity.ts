import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

@Entity('inventory_categories')
export class InventoryCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 10, default: '📦' })
  icon: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relación: una categoría tiene muchos ítems
  @OneToMany(() => InventoryItem, (item) => item.category)
  items: InventoryItem[];
}
