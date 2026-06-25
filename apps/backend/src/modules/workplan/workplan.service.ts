import {
  Injectable, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WorkPlan, PlanStatus } from './entities/work-plan.entity';
import { WorkPlanAxis, AxisType, AXIS_DISPLAY_ORDER } from './entities/work-plan-axis.entity';
import { AxisActivity, ActivityStatus } from './entities/axis-activity.entity';
import {
  CreateWorkPlanDto, UpdateWorkPlanDto,
  CreateAxisDto, UpdateAxisDto,
  CreateActivityDto, UpdateActivityDto,
} from './dto/workplan.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class WorkPlanService {
  constructor(
    @InjectRepository(WorkPlan)
    private readonly planRepo: Repository<WorkPlan>,

    @InjectRepository(WorkPlanAxis)
    private readonly axisRepo: Repository<WorkPlanAxis>,

    @InjectRepository(AxisActivity)
    private readonly activityRepo: Repository<AxisActivity>,

    private readonly dataSource: DataSource,
  ) {}

  // ── Puede el usuario ver este plan? ──────────────────────
  // Requiere que plan.user esté cargado para la verificación por nodo.
  private canView(plan: WorkPlan, user: User): boolean {
    // Regla universal: siempre puede ver su propio plan
    if (plan.userId === user.id) return true;

    switch (user.role) {
      case UserRole.ADMIN:
      case UserRole.VICERRECTOR_EXTENSION:
      case UserRole.VICERRECTOR_ACADEMICO:
      case UserRole.EQUIPO_EXTENSION:
        return true;
      case UserRole.DECANO:
        return !!user.faculty && plan.faculty === user.faculty;
      case UserRole.COORDINADOR:
        return !!user.program && plan.program === user.program;
      case UserRole.ENLACE:
      case UserRole.MONITOR:
      case UserRole.AUXILIAR:
        // Ver planes de su nodo (el propio ya fue cubierto arriba)
        return !!user.nodoId && plan.user?.nodoId === user.nodoId;
      default:
        return false;
    }
  }

  private canEdit(plan: WorkPlan, user: User): boolean {
    const editorRoles: UserRole[] = [UserRole.ADMIN];
    return plan.userId === user.id || editorRoles.includes(user.role);
  }

  // ══════════════════════════════════════════════════════════
  // PLANES DE TRABAJO
  // ══════════════════════════════════════════════════════════

  // En el método findAll del WorkPlanService, REEMPLAZA la query actual por:
async findAll(user: User): Promise<WorkPlan[]> {
  const qb = this.planRepo
    .createQueryBuilder('wp')
    .leftJoinAndSelect('wp.user', 'u')
    .leftJoinAndSelect('wp.axes', 'ax')
    .orderBy('wp.created_at', 'DESC');
 
  const { role, id: userId, faculty, program, nodoId } = user;
 
  if (
    role === UserRole.ADMIN ||
    role === UserRole.VICERRECTOR_EXTENSION ||
    role === UserRole.VICERRECTOR_ACADEMICO ||
    role === UserRole.EQUIPO_EXTENSION
  ) {
    // Ven todos los planes de todos los nodos y docentes
  } else if (role === UserRole.DECANO && faculty) {
    // Solo docentes de su facultad
    qb.where('u.faculty = :faculty', { faculty });
  } else if (role === UserRole.COORDINADOR && program) {
    // Solo docentes de su programa
    qb.where('u.program = :program', { program });
  } else if (
    (role === UserRole.ENLACE || role === UserRole.MONITOR || role === UserRole.AUXILIAR)
    && nodoId
  ) {
    // Enlace/monitor/auxiliar: planes de todos los usuarios de su nodo
    qb.where('u.nodo_id = :nodoId', { nodoId });
  } else {
    // Docente sin nodo: solo su propio plan
    qb.where('wp.user_id = :userId', { userId });
  }
 
  return qb.getMany();
}

  async findOne(id: string, user: User): Promise<WorkPlan & { summary: object }> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['user', 'axes', 'axes.activities'],
      order: { axes: { displayOrder: 'ASC' } } as never,
    });

    if (!plan) throw new NotFoundException('Plan de trabajo no encontrado');
    if (!this.canView(plan, user)) {
      throw new ForbiddenException('No tienes permiso para ver este plan');
    }

    // Calcular resumen
    const summary = await this.getPlanSummary(id);

    return { ...plan, summary };
  }

  async create(dto: CreateWorkPlanDto, user: User): Promise<WorkPlan> {
    // Verificar que no exista un plan activo para el mismo semestre
    const existing = await this.planRepo.findOne({
      where: { userId: user.id, semester: dto.semester },
    });
    if (existing && existing.status !== PlanStatus.ARCHIVADO) {
      throw new BadRequestException(
        `Ya existe un plan de trabajo para el semestre ${dto.semester}`,
      );
    }

    const plan = this.planRepo.create({
      userId: user.id,
      resolutionNumber: dto.resolutionNumber ?? null,
      faculty: dto.faculty ?? user.faculty ?? null,
      program: dto.program ?? user.program ?? null,
      semester: dto.semester,
      year: dto.year,
      totalHours: dto.totalHours,
      fillDate: dto.fillDate ? new Date(dto.fillDate) : null,
      status: dto.status ?? PlanStatus.BORRADOR,
      notes: dto.notes ?? null,
    });

    const saved = await this.planRepo.save(plan);

    // Crear los 7 ejes automáticamente con 0 horas
    const axes = Object.values(AxisType).map((axisType, i) =>
      this.axisRepo.create({
        workPlanId: saved.id,
        axisType,
        plannedHours: 0,
        displayOrder: AXIS_DISPLAY_ORDER[axisType] ?? i + 1,
      }),
    );
    await this.axisRepo.save(axes);

    return this.planRepo.findOne({
      where: { id: saved.id },
      relations: ['axes'],
    }) as Promise<WorkPlan>;
  }

  async update(id: string, dto: UpdateWorkPlanDto, user: User): Promise<WorkPlan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    if (!this.canEdit(plan, user)) {
      throw new ForbiddenException('No tienes permiso para editar este plan');
    }
    Object.assign(plan, dto);
    return this.planRepo.save(plan);
  }

  // ══════════════════════════════════════════════════════════
  // EJES MISIONALES
  // ══════════════════════════════════════════════════════════

  async updateAxis(
    planId: string, axisId: string,
    dto: UpdateAxisDto, user: User,
  ): Promise<WorkPlanAxis> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    if (!this.canEdit(plan, user)) throw new ForbiddenException('Sin permiso');

    const axis = await this.axisRepo.findOne({
      where: { id: axisId, workPlanId: planId },
    });
    if (!axis) throw new NotFoundException('Eje no encontrado');

    Object.assign(axis, dto);
    return this.axisRepo.save(axis);
  }

  async getAxisWithActivities(axisId: string): Promise<WorkPlanAxis> {
    const axis = await this.axisRepo.findOne({
      where: { id: axisId },
      relations: ['activities'],
      order: { activities: { sequenceNumber: 'ASC' } } as never,
    });
    if (!axis) throw new NotFoundException('Eje no encontrado');
    return axis;
  }

  // ══════════════════════════════════════════════════════════
  // ACTIVIDADES
  // ══════════════════════════════════════════════════════════

  async createActivity(
    axisId: string, dto: CreateActivityDto, user: User,
  ): Promise<AxisActivity> {
    const axis = await this.axisRepo.findOne({
      where: { id: axisId },
      relations: ['workPlan'],
    });
    if (!axis) throw new NotFoundException('Eje no encontrado');
    if (!this.canEdit(axis.workPlan, user)) throw new ForbiddenException('Sin permiso');

    // Número de secuencia automático
    const count = await this.activityRepo.count({ where: { axisId } });

    // Calcular horas planeadas automáticamente si es docencia directa
    let plannedHours = dto.plannedHours ?? 0;
    if (dto.weeks && dto.hoursPerWeek) {
      plannedHours = dto.weeks * dto.hoursPerWeek;
    }

    const activity = this.activityRepo.create({
      axisId,
      sequenceNumber: count + 1,
      name: dto.name,
      plannedHours,
      executedHours: dto.executedHours ?? 0,
      courseCode: dto.courseCode ?? null,
      groupCode: dto.groupCode ?? null,
      numStudents: dto.numStudents ?? null,
      level: dto.level ?? null,
      courseType: dto.courseType ?? null,
      weeks: dto.weeks ?? null,
      hoursPerWeek: dto.hoursPerWeek ?? null,
      thesisModality: dto.thesisModality ?? null,
      studentName: dto.studentName ?? null,
      specificDescription: dto.specificDescription ?? null,
      dimInclusion: dto.dimInclusion ?? false,
      dimTerritorial: dto.dimTerritorial ?? false,
      dimHuman: dto.dimHuman ?? false,
      dimensionJustification: dto.dimensionJustification ?? null,
      activityStatus: dto.activityStatus ?? ActivityStatus.PENDIENTE,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      evidenceType: dto.evidenceType ?? null,
      evidenceUrl: dto.evidenceUrl ?? null,
      teacherObservations: dto.teacherObservations ?? null,
      deanObservations: dto.deanObservations ?? null,
    });

    return this.activityRepo.save(activity);
  }

  async updateActivity(
    activityId: string, dto: UpdateActivityDto, user: User,
  ): Promise<AxisActivity> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
      relations: ['axis', 'axis.workPlan'],
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (!this.canEdit(activity.axis.workPlan, user)) throw new ForbiddenException('Sin permiso');

    // Recalcular horas si cambian semanas o horas/semana
    if (dto.weeks !== undefined || dto.hoursPerWeek !== undefined) {
      const weeks = dto.weeks ?? activity.weeks;
      const hpw   = dto.hoursPerWeek ?? activity.hoursPerWeek;
      if (weeks && hpw) dto.plannedHours = weeks * hpw;
    }

    Object.assign(activity, dto);
    return this.activityRepo.save(activity);
  }

  async deleteActivity(activityId: string, user: User): Promise<void> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
      relations: ['axis', 'axis.workPlan'],
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (!this.canEdit(activity.axis.workPlan, user)) throw new ForbiddenException('Sin permiso');
    await this.activityRepo.remove(activity);
  }

  async getActivity(id: string): Promise<AxisActivity> {
    const a = await this.activityRepo.findOne({
      where: { id },
      relations: ['axis', 'axis.workPlan'],
    });
    if (!a) throw new NotFoundException('Actividad no encontrada');
    return a;
  }

  // ══════════════════════════════════════════════════════════
  // RESÚMENES Y ESTADÍSTICAS
  // ══════════════════════════════════════════════════════════

  async getPlanSummary(planId: string): Promise<object> {
    const result = await this.dataSource.query(
      'SELECT * FROM v_plan_summary WHERE plan_id = $1',
      [planId],
    );
    return result[0] ?? {};
  }

  async getAxisSummaries(planId: string): Promise<object[]> {
    return this.dataSource.query(
      'SELECT * FROM v_axis_summary WHERE work_plan_id = $1 ORDER BY axis_type',
      [planId],
    );
  }
}
