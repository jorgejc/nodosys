/**
 * user.entity.ts — Entidad Usuario
 *
 * En TypeORM, una entidad es una clase de TypeScript que representa
 * una tabla en la base de datos. Los decoradores (@Column, @Entity, etc.)
 * le dicen a TypeORM cómo mapear cada propiedad a una columna.
 *
 * Esta entidad representa a CUALQUIER docente ocasional de IU Digital:
 *   - Enlace de nodo (tiene nodo asignado)
 *   - Docente virtual (sin nodo, nodo_id es null)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';

// Tipos de rol disponibles en el sistema
export enum UserRole {
  ENLACE = 'enlace',       // Coordinador de nodo
  MONITOR = 'monitor',     // Estudiante monitor
  AUXILIAR = 'auxiliar',  // Auxiliar del nodo
  DOCENTE = 'docente',     // Docente ocasional virtual (sin nodo)
}

@Entity('users') // Indica que esta clase = tabla users en PostgreSQL
export class User {
  @PrimaryGeneratedColumn('uuid') // UUID autogenerado como clave primaria
  id: string;

  // nullable: true → el docente virtual no tiene nodo asignado
  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true, length: 200 })
  email: string;

  // La contraseña NUNCA se guarda en texto plano, siempre encriptada con bcrypt
  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.DOCENTE,
  })
  role: UserRole;

  @Column({ length: 30, nullable: true })
  phone: string | null;

  // Cargo o denominación del docente (ej: "Docente Ocasional TC")
  @Column({ length: 200, nullable: true })
  position: string | null;

  // ¿El usuario puede iniciar sesión?
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── HOOKS ───────────────────────────────────────────────
  // @BeforeInsert y @BeforeUpdate ejecutan código automáticamente
  // ANTES de guardar en la BD. Aquí encriptamos la contraseña.

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    // Solo encripta si la contraseña cambió (no está ya encriptada)
    if (this.passwordHash && !this.passwordHash.startsWith('$2')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    }
  }

  // Método helper para comparar contraseña ingresada vs. la guardada
  async comparePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.passwordHash);
  }
}
