/**
 * users.service.ts — Lógica de negocio de usuarios
 *
 * En NestJS, los "Services" contienen la lógica de negocio.
 * El Controller recibe la petición HTTP y llama al Service.
 * El Service habla con la base de datos a través del Repository.
 *
 * Flujo: HTTP Request → Controller → Service → Repository → PostgreSQL
 */
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    // @InjectRepository inyecta el repositorio de TypeORM para la entidad User
    // Con esto podemos hacer: this.usersRepository.find(), .save(), .findOne(), etc.
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // ─── Crear usuario ────────────────────────────────────────
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Verificar si el email ya está registrado
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      // ConflictException → responde con HTTP 409
      throw new ConflictException(`El email ${createUserDto.email} ya está registrado`);
    }

    // Crear instancia de User con los datos del DTO
    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      passwordHash: createUserDto.password, // El @BeforeInsert lo encriptará
      role: createUserDto.role ?? UserRole.DOCENTE,
      nodoId: createUserDto.nodoId ?? null,
      phone: createUserDto.phone ?? null,
      position: createUserDto.position ?? null,
    });

    return this.usersRepository.save(user);
  }

  // ─── Buscar por email (usado en el login) ─────────────────
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  // ─── Buscar por ID ────────────────────────────────────────
  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  // ─── Listar todos los usuarios de un nodo ─────────────────
  async findAll(nodoId?: string): Promise<User[]> {
    const where = nodoId ? { nodoId } : {};
    return this.usersRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  // ─── Actualizar usuario ───────────────────────────────────
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  // ─── Desactivar usuario (soft delete) ────────────────────
  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    return this.usersRepository.save(user);
  }
}
