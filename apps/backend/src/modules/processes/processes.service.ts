import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, ProcessStatus } from './entities/process.entity';
import { CreateProcessDto, UpdateProcessDto } from './dto/processes.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ProcessesService {
  private readonly globalRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.VICERRECTOR_EXTENSION,
    UserRole.VICERRECTOR_ACADEMICO,
    UserRole.EQUIPO_EXTENSION,
  ];

  constructor(
    @InjectRepository(Process)
    private readonly repo: Repository<Process>,
  ) {}

  async create(dto: CreateProcessDto, user: User): Promise<Process> {
    const process = this.repo.create({
      name:            dto.name,
      description:     dto.description ?? null,
      type:            dto.type,
      nodoId:          dto.nodoId ?? (this.isNodoRole(user.role) ? user.nodoId : null),
      workPlanTaskId:  dto.workPlanTaskId ?? null,
      createdBy:       user.id,
      status:          ProcessStatus.ACTIVO,
    });
    return this.repo.save(process);
  }

  async findAll(user: User): Promise<Process[]> {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'creator')
      .select([
        'p.id', 'p.name', 'p.description', 'p.type', 'p.status',
        'p.nodoId', 'p.workPlanTaskId', 'p.createdBy', 'p.createdAt', 'p.updatedAt',
        'creator.id', 'creator.name', 'creator.email',
      ])
      .orderBy('p.createdAt', 'DESC');

    if (this.globalRoles.includes(user.role)) {
      // sin filtro
    } else if (user.role === UserRole.DECANO || user.role === UserRole.COORDINADOR) {
      qb.where('p.created_by = :uid', { uid: user.id });
    } else if (this.isNodoRole(user.role) && user.nodoId) {
      qb.where('(p.nodo_id = :nodoId OR p.created_by = :uid)', {
        nodoId: user.nodoId,
        uid:    user.id,
      });
    } else {
      qb.where('p.created_by = :uid', { uid: user.id });
    }

    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<Process> {
    const process = await this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'creator')
      .select([
        'p.id', 'p.name', 'p.description', 'p.type', 'p.status',
        'p.nodoId', 'p.workPlanTaskId', 'p.createdBy', 'p.createdAt', 'p.updatedAt',
        'creator.id', 'creator.name', 'creator.email',
      ])
      .where('p.id = :id', { id })
      .getOne();
    if (!process) throw new NotFoundException('Proceso no encontrado');
    if (!this.canAccess(process, user)) throw new ForbiddenException();
    return process;
  }

  async update(id: string, dto: UpdateProcessDto, user: User): Promise<Process> {
    const process = await this.findOne(id, user);
    if (!this.canEdit(process, user)) throw new ForbiddenException('No tienes permisos para editar este proceso');
    Object.assign(process, {
      ...(dto.name            !== undefined && { name: dto.name }),
      ...(dto.description     !== undefined && { description: dto.description }),
      ...(dto.type            !== undefined && { type: dto.type }),
      ...(dto.status          !== undefined && { status: dto.status }),
      ...(dto.nodoId          !== undefined && { nodoId: dto.nodoId }),
      ...(dto.workPlanTaskId  !== undefined && { workPlanTaskId: dto.workPlanTaskId }),
    });
    return this.repo.save(process);
  }

  // ── Helpers de permisos ────────────────────────────────────

  private canAccess(process: Process, user: User): boolean {
    if (this.globalRoles.includes(user.role)) return true;
    if (process.createdBy === user.id) return true;
    if (this.isNodoRole(user.role) && user.nodoId && process.nodoId === user.nodoId) return true;
    return false;
  }

  private canEdit(process: Process, user: User): boolean {
    if (user.role === UserRole.ADMIN) return true;
    return process.createdBy === user.id;
  }

  private isNodoRole(role: UserRole): boolean {
    return [UserRole.ENLACE, UserRole.MONITOR, UserRole.AUXILIAR].includes(role);
  }
}
