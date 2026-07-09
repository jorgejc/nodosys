import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, ProcessStatus, SessionTemplate } from './entities/process.entity';
import { CourseSession } from '../sessions/entities/course-session.entity';
import { CreateProcessDto, UpdateProcessDto } from './dto/processes.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ProcessesService {
  // Solo admin ve todos los procesos; cualquier otro usuario ve solo los suyos
  private readonly globalRoles: UserRole[] = [
    UserRole.ADMIN,
  ];

  constructor(
    @InjectRepository(Process)
    private readonly repo: Repository<Process>,

    @InjectRepository(CourseSession)
    private readonly sessionRepo: Repository<CourseSession>,
  ) {}

  async create(dto: CreateProcessDto, user: User): Promise<Process> {
    const process = this.repo.create({
      name:            dto.name,
      description:     dto.description ?? null,
      type:            dto.type,
      nodoId:          dto.nodoId ?? user.nodoId ?? null,
      workPlanTaskId:  dto.workPlanTaskId ?? null,
      strategyId:      dto.strategyId ?? null,
      missionAxisId:   dto.missionAxisId ?? null,
      sessionTemplate: dto.sessionTemplate ?? SessionTemplate.TRES_MOMENTOS,
      createdBy:       user.id,
      status:          ProcessStatus.ACTIVO,
    });
    return this.repo.save(process);
  }

  async findAll(user: User): Promise<Process[]> {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'creator')
      .leftJoinAndSelect('p.strategy', 'strategy')
      .leftJoinAndSelect('p.missionAxis', 'missionAxis')
      .select([
        'p.id', 'p.name', 'p.description', 'p.type', 'p.status',
        'p.nodoId', 'p.workPlanTaskId', 'p.strategyId', 'p.missionAxisId', 'p.sessionTemplate',
        'p.createdBy', 'p.createdAt', 'p.updatedAt',
        'creator.id', 'creator.name', 'creator.email',
        'strategy.id', 'strategy.name',
        'missionAxis.id', 'missionAxis.name',
      ])
      .orderBy('p.createdAt', 'DESC');

    if (this.globalRoles.includes(user.role)) {
      // Admin: sin filtro, ve todos
    } else {
      // Docente, enlace y cualquier otro: solo los propios
      qb.where('p.created_by = :uid', { uid: user.id });
    }

    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<Process> {
    const process = await this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'creator')
      .leftJoinAndSelect('p.strategy', 'strategy')
      .leftJoinAndSelect('p.missionAxis', 'missionAxis')
      .select([
        'p.id', 'p.name', 'p.description', 'p.type', 'p.status',
        'p.nodoId', 'p.workPlanTaskId', 'p.strategyId', 'p.missionAxisId', 'p.sessionTemplate',
        'p.createdBy', 'p.createdAt', 'p.updatedAt',
        'creator.id', 'creator.name', 'creator.email',
        'strategy.id', 'strategy.name',
        'missionAxis.id', 'missionAxis.name',
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
      ...(dto.strategyId      !== undefined && { strategyId: dto.strategyId }),
      ...(dto.missionAxisId   !== undefined && { missionAxisId: dto.missionAxisId }),
      ...(dto.sessionTemplate !== undefined && { sessionTemplate: dto.sessionTemplate }),
    });
    return this.repo.save(process);
  }

  // ── Helpers de permisos ────────────────────────────────────

  private canAccess(process: Process, user: User): boolean {
    if (this.globalRoles.includes(user.role)) return true;
    return process.createdBy === user.id;
  }

  private canEdit(process: Process, user: User): boolean {
    if (user.role === UserRole.ADMIN) return true;
    return process.createdBy === user.id;
  }

  async getReport(id: string, user: User) {
    const process = await this.findOne(id, user);

    const sessions = await this.sessionRepo.find({
      where: { processId: id },
      relations: ['moments', 'attendees', 'evidences'],
      order: { sessionNumber: 'ASC' } as never,
    });

    const attendanceMap = new Map<string, {
      fullName: string;
      documentNumber: string | null;
      sessionsAttended: number;
      totalSessions: number;
      absences: number;
    }>();

    for (const session of sessions) {
      for (const attendee of session.attendees) {
        const key = `${attendee.fullName.trim().toLowerCase()}|||${attendee.documentNumber ?? ''}`;
        const rec = attendanceMap.get(key);
        if (rec) {
          rec.totalSessions++;
          if (attendee.attended) rec.sessionsAttended++;
          else rec.absences++;
        } else {
          attendanceMap.set(key, {
            fullName:         attendee.fullName,
            documentNumber:   attendee.documentNumber,
            sessionsAttended: attendee.attended ? 1 : 0,
            totalSessions:    1,
            absences:         attendee.attended ? 0 : 1,
          });
        }
      }
    }

    const consolidatedAttendance = Array.from(attendanceMap.values())
      .map((a) => ({ ...a, certifiable: a.absences <= 4 }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

    const dates = sessions.map((s) => s.date).sort();

    return {
      process,
      sessions,
      consolidatedAttendance,
      totalSessions: sessions.length,
      dateRange: {
        start: dates[0] ?? null,
        end:   dates[dates.length - 1] ?? null,
      },
    };
  }
}
