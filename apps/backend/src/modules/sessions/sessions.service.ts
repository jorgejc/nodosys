import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CourseSession } from './entities/course-session.entity';
import { SessionMoment, MomentType } from './entities/session-moment.entity';
import { SessionAttendee } from './entities/session-attendee.entity';
import {
  CreateSessionDto, UpdateSessionDto,
  AddAttendeeDto, UpdateAttendeeDto,
} from './dto/sessions.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(CourseSession)
    private readonly sessionRepo: Repository<CourseSession>,

    @InjectRepository(SessionMoment)
    private readonly momentRepo: Repository<SessionMoment>,

    @InjectRepository(SessionAttendee)
    private readonly attendeeRepo: Repository<SessionAttendee>,

    private readonly dataSource: DataSource,
  ) {}

  // ── Permisos ─────────────────────────────────────────────
  private readonly globalRoles = [
    UserRole.ADMIN, UserRole.VICERRECTOR_EXTENSION,
    UserRole.VICERRECTOR_ACADEMICO, UserRole.EQUIPO_EXTENSION,
    UserRole.DECANO, UserRole.COORDINADOR,
  ];

  private canManage(session: CourseSession, user: User): boolean {
    if (this.globalRoles.includes(user.role as UserRole)) return true;
    return session.createdBy === user.id;
  }

  // ── Sesiones ─────────────────────────────────────────────

  async findByActivity(activityId: string): Promise<CourseSession[]> {
    return this.sessionRepo.find({
      where: { activityId },
      relations: ['moments'],
      order: { sessionNumber: 'ASC', date: 'ASC' },
    });
  }

  async findOne(id: string): Promise<CourseSession> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['moments', 'attendees', 'creator'],
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    // Ordenar momentos según el flujo pedagógico
    const ORDER = { explorar: 1, crear: 2, consolidar: 3 };
    session.moments.sort((a, b) => ORDER[a.momentType] - ORDER[b.momentType]);

    return session;
  }

  async create(
    activityId: string,
    dto: CreateSessionDto,
    user: User,
  ): Promise<CourseSession> {
    // Calcular número de sesión automáticamente
    const count = await this.sessionRepo.count({ where: { activityId } });

    const session = this.sessionRepo.create({
      activityId,
      sessionNumber: count + 1,
      date: dto.date,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      topic: dto.topic ?? null,
      location: dto.location ?? null,
      totalRegistered: dto.totalRegistered ?? 0,
      createdBy: user.id,
    });

    const saved = await this.sessionRepo.save(session);

    // Crear los 3 momentos vacíos si no se enviaron, o guardar los enviados
    const momentTypes = [MomentType.EXPLORAR, MomentType.CREAR, MomentType.CONSOLIDAR];
    const momentsToSave = momentTypes.map((mt) => {
      const incoming = dto.moments?.find((m) => m.momentType === mt);
      return this.momentRepo.create({
        sessionId: saved.id,
        momentType: mt,
        objective:        incoming?.objective        ?? null,
        methodology:      incoming?.methodology      ?? null,
        materials:        incoming?.materials        ?? null,
        durationMinutes:  incoming?.durationMinutes  ?? null,
      });
    });

    await this.momentRepo.save(momentsToSave);
    return this.findOne(saved.id);
  }

  async update(
    id: string,
    dto: UpdateSessionDto,
    user: User,
  ): Promise<CourseSession> {
    const session = await this.findOne(id);
    if (!this.canManage(session, user)) {
      throw new ForbiddenException('Sin permiso para editar esta sesión');
    }

    // Actualizar campos de la sesión
    Object.assign(session, {
      date:             dto.date            ?? session.date,
      startTime:        dto.startTime       ?? session.startTime,
      endTime:          dto.endTime         ?? session.endTime,
      topic:            dto.topic           ?? session.topic,
      location:         dto.location        ?? session.location,
      totalRegistered:  dto.totalRegistered ?? session.totalRegistered,
    });
    await this.sessionRepo.save(session);

    // Actualizar momentos si se enviaron
    if (dto.moments?.length) {
      for (const m of dto.moments) {
        const existing = session.moments.find((sm) => sm.momentType === m.momentType);
        if (existing) {
          Object.assign(existing, {
            objective:       m.objective       ?? existing.objective,
            methodology:     m.methodology     ?? existing.methodology,
            materials:       m.materials       ?? existing.materials,
            durationMinutes: m.durationMinutes ?? existing.durationMinutes,
          });
          await this.momentRepo.save(existing);
        }
      }
    }

    return this.findOne(id);
  }

  async delete(id: string, user: User): Promise<void> {
    const session = await this.findOne(id);
    if (!this.canManage(session, user)) {
      throw new ForbiddenException('Sin permiso para eliminar esta sesión');
    }
    await this.sessionRepo.remove(session);

    // Renumerar las sesiones restantes de esa actividad
    const remaining = await this.sessionRepo.find({
      where: { activityId: session.activityId },
      order: { sessionNumber: 'ASC' },
    });
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].sessionNumber = i + 1;
    }
    if (remaining.length) await this.sessionRepo.save(remaining);
  }

  // ── Asistentes ───────────────────────────────────────────

  async addAttendee(
    sessionId: string,
    dto: AddAttendeeDto,
    user: User,
  ): Promise<SessionAttendee> {
    const session = await this.findOne(sessionId);
    if (!this.canManage(session, user)) {
      throw new ForbiddenException('Sin permiso para gestionar asistentes');
    }

    const absences = dto.absencesCount ?? 0;
    const attendee = this.attendeeRepo.create({
      sessionId,
      fullName:       dto.fullName,
      documentNumber: dto.documentNumber ?? null,
      attended:       dto.attended ?? true,
      absencesCount:  absences,
      certifiable:    absences <= 4,
    });
    return this.attendeeRepo.save(attendee);
  }

  async updateAttendee(
    sessionId: string,
    attendeeId: string,
    dto: UpdateAttendeeDto,
    user: User,
  ): Promise<SessionAttendee> {
    const session = await this.findOne(sessionId);
    if (!this.canManage(session, user)) {
      throw new ForbiddenException('Sin permiso para gestionar asistentes');
    }

    const attendee = await this.attendeeRepo.findOne({
      where: { id: attendeeId, sessionId },
    });
    if (!attendee) throw new NotFoundException('Asistente no encontrado');

    Object.assign(attendee, {
      fullName:       dto.fullName       ?? attendee.fullName,
      documentNumber: dto.documentNumber ?? attendee.documentNumber,
      attended:       dto.attended       ?? attendee.attended,
      absencesCount:  dto.absencesCount  ?? attendee.absencesCount,
    });
    attendee.certifiable = attendee.absencesCount <= 4;
    return this.attendeeRepo.save(attendee);
  }

  async deleteAttendee(
    sessionId: string,
    attendeeId: string,
    user: User,
  ): Promise<void> {
    const session = await this.findOne(sessionId);
    if (!this.canManage(session, user)) {
      throw new ForbiddenException('Sin permiso para gestionar asistentes');
    }

    const attendee = await this.attendeeRepo.findOne({
      where: { id: attendeeId, sessionId },
    });
    if (!attendee) throw new NotFoundException('Asistente no encontrado');
    await this.attendeeRepo.remove(attendee);
  }

  // ── Reporte de asistencia por actividad ──────────────────

  async getAttendanceReport(activityId: string): Promise<object[]> {
    const result = await this.dataSource.query(
      `SELECT
         sa.full_name          AS "fullName",
         sa.document_number    AS "documentNumber",
         COUNT(DISTINCT cs.id) AS "totalSessions",
         SUM(CASE WHEN sa.attended THEN 1 ELSE 0 END)::int AS "attendedCount",
         SUM(sa.absences_count)::int                       AS "totalAbsences",
         BOOL_AND(sa.certifiable)                          AS "certifiable"
       FROM session_attendees sa
       JOIN course_sessions cs ON cs.id = sa.session_id
       WHERE cs.activity_id = $1
       GROUP BY sa.full_name, sa.document_number
       ORDER BY sa.full_name`,
      [activityId],
    );
    return result;
  }
}
