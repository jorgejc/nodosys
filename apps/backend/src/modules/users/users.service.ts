/**
 * users.service.ts — Lógica de negocio de usuarios
 *
 * En NestJS, los "Services" contienen la lógica de negocio.
 * El Controller recibe la petición HTTP y llama al Service.
 * El Service habla con la base de datos a través del Repository.
 *
 * Flujo: HTTP Request → Controller → Service → Repository → PostgreSQL
 */
import {
  Injectable, ConflictException,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Or } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
 
// Roles que pueden ver usuarios de forma ampliada
const MANAGER_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.VICERRECTOR_EXTENSION,
  UserRole.VICERRECTOR_ACADEMICO,
  UserRole.EQUIPO_EXTENSION,
];
 
// Roles que el enlace puede crear en su nodo
const ENLACE_ASSIGNABLE: UserRole[] = [UserRole.MONITOR, UserRole.AUXILIAR];
 
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}
 
  async findAll(
    currentUser: User,
    filters: {
      search?: string;
      role?: string;
      faculty?: string;
      program?: string;
      nodoId?: string;
    },
  ): Promise<User[]> {
    const qb = this.repo.createQueryBuilder('u')
      .select([
      'u.id', 'u.name', 'u.email', 'u.role',
      'u.documentType', 'u.documentNumber',
      'u.faculty', 'u.program', 'u.nodoId', 'u.nodoName',
      'u.phone', 'u.position', 'u.isActive', 'u.createdAt',
      ])
      .orderBy('u.name', 'ASC');
 
    // ── Restricciones según rol del que consulta ──────────
    if (currentUser.role === UserRole.ENLACE) {
      // El enlace solo ve usuarios de su nodo
      qb.where('u.nodo_id = :nodoId', { nodoId: currentUser.nodoId });
    } else if (currentUser.role === UserRole.DECANO || currentUser.role === UserRole.COORDINADOR) {
      // El decano/coordinador solo ve docentes de su facultad
      qb.where('u.faculty = :faculty', { faculty: currentUser.faculty });
    }
    // Admin, vicerrectores y equipo extensión ven todos
 
    // ── Filtros adicionales ────────────────────────────────
    if (filters.search) {
      const s = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(u.name) LIKE :s OR LOWER(u.email) LIKE :s OR u.cedula LIKE :s)',
        { s },
      );
    }
    if (filters.role)    qb.andWhere('u.role = :role', { role: filters.role });
    if (filters.faculty) qb.andWhere('LOWER(u.faculty) LIKE :fac', { fac: `%${filters.faculty.toLowerCase()}%` });
    if (filters.program) qb.andWhere('LOWER(u.program) LIKE :prg', { prg: `%${filters.program.toLowerCase()}%` });
    if (filters.nodoId)  qb.andWhere('u.nodo_id = :nodoId', { nodoId: filters.nodoId });
 
    return qb.getMany();
  }
 
  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }
 
  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }
 
  // Crear usuario desde el panel de admin
  async createByAdmin(dto: CreateUserDto, creator: User): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`El email ${dto.email} ya está registrado`);
 
    // El enlace solo puede crear monitores y auxiliares
    if (creator.role === UserRole.ENLACE) {
      if (!ENLACE_ASSIGNABLE.includes(dto.role as UserRole)) {
        throw new ForbiddenException('El enlace solo puede crear usuarios con rol monitor o auxiliar');
      }
    }
 
    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      passwordHash: dto.password,
      role: dto.role as UserRole ?? UserRole.DOCENTE,
      nodoId: dto.nodoId ?? creator.nodoId ?? null,
      faculty: dto.faculty ?? null,
      program: dto.program ?? null,
      phone: dto.phone ?? null,
      position: dto.position ?? null,
    });
 
    return this.repo.save(user);
  }
 
  // Registro público (primer uso o auto-registro)
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`El email ${dto.email} ya está registrado`);
    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      passwordHash: dto.password,
      role: dto.role as UserRole ?? UserRole.DOCENTE,
      nodoId: dto.nodoId ?? null,
      faculty: dto.faculty ?? null,
      program: dto.program ?? null,
      phone: dto.phone ?? null,
      position: dto.position ?? null,
    });
    return this.repo.save(user);
  }
 
  async update(id: string, dto: UpdateUserDto, currentUser: User): Promise<User> {
    const user = await this.findById(id);
 
    // El enlace solo puede editar usuarios de su nodo
    if (currentUser.role === UserRole.ENLACE) {
      if (user.nodoId !== currentUser.nodoId) {
        throw new ForbiddenException('Solo puedes editar usuarios de tu nodo');
      }
    }
 
    Object.assign(user, dto);
    return this.repo.save(user);
  }
 
  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    return this.repo.save(user);
  }
}