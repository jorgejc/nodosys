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
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  BeforeInsert, BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';

// Tipos de rol disponibles en el sistema
export enum UserRole {
  // Operativos del nodo
  ENLACE   = 'enlace',    // Docente ocasional que también gestiona un nodo
  MONITOR  = 'monitor',
  AUXILIAR = 'auxiliar',
 
  // Docentes
  DOCENTE  = 'docente',   // Docente ocasional sin nodo asignado
 
  // Vicerrectorías
  VICERRECTOR_EXTENSION  = 'vicerrector_extension',  // Supervisa todos los nodos
  VICERRECTOR_ACADEMICO  = 'vicerrector_academico',  // Supervisa planes de trabajo
  EQUIPO_EXTENSION       = 'equipo_extension',       // Equipo de apoyo del vicerrector extensión
 
  // Facultad
  DECANO       = 'decano',       // Ve docentes de su facultad
  COORDINADOR  = 'coordinador',  // Ve docentes de su programa
 
  // Sistema
  ADMIN = 'admin',

}

export enum DocumentType {
  CC  = 'CC',   // Cédula de Ciudadanía
  TI  = 'TI',   // Tarjeta de Identidad
  RC  = 'RC',   // Registro Civil
  PA  = 'PA',   // Pasaporte
  CE  = 'CE',   // Cédula de Extranjería
  PEP = 'PEP',  // Permiso Especial de Permanencia
  PPT = 'PPT',  // Permiso de Protección Temporal
  NIT = 'NIT',  // NIT (instituciones)
}

@Entity('users') // Indica que esta clase = tabla users en PostgreSQL
export class User {
  @PrimaryGeneratedColumn('uuid') // UUID autogenerado como clave primaria
  id: string;

  // nullable: true → el docente virtual no tiene nodo asignado
  @Column({ name: 'nodo_id', type: 'uuid', nullable: true })
  nodoId: string | null;

  @Column({ name: 'nodo_name', type: 'varchar', length: 200, nullable: true })
  nodoName: string | null;

  // Documento de identidad
  @Column({ name: 'document_type', type: 'enum', enumName: 'document_type', default: DocumentType.CC, nullable: true })
  documentType: DocumentType | null;

  @Column({ name: 'document_number', type: 'varchar', length: 30, nullable: true })
  documentNumber: string | null;

   @Column({ type: 'varchar', length: 20, nullable: true, unique: false })
  cedula: string | null;


  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ unique: true, type: 'varchar', length: 200 })
  email: string;

  // La contraseña NUNCA se guarda en texto plano, siempre encriptada con bcrypt
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'users_role_enum', default: UserRole.DOCENTE })
  role: UserRole;

  // Facultad a la que pertenece el docente (para revisión del plan de trabajo)
  @Column({ name: 'faculty', type: 'varchar', length: 200, nullable: true })
  faculty: string | null;

  // Programa académico (ej: "Tecnología en Sistemas", "Ingeniería de Software")
  @Column({ name: 'program', type: 'varchar', length: 200, nullable: true })
  program: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  // Cargo o denominación del docente (ej: "Docente Ocasional TC")
  @Column({ type: 'varchar', length: 200, nullable: true })
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
