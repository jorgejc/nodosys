/**
 * monitors.service.ts — Módulo "Equipo de Nodo": gestión de monitoras
 *
 * Reglas de acceso (todo lo demás → 403):
 *   monitor → crea/edita SU propio plan, actividades y evidencias; ve solo lo suyo
 *   enlace  → ve las monitoras de SU nodo, sus planes y evidencias;
 *             autoriza semanas por encima del tope; sube su firma; certifica
 *   admin   → todo
 *
 * Aislamiento por nodo: `nodoId` del plan sale del perfil de la monitora y
 * jamás del body. La copia del plan se resincroniza con el perfil en cada
 * lectura/escritura, así que un cambio de nodo mueve el plan al enlace nuevo
 * y se lo quita al anterior. Sin nodo no hay plan: ni se crea ni se puede
 * seguir usando uno existente, porque serían horas que nadie puede certificar.
 */
import {
  Injectable, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, Not, IsNull, DataSource, EntityManager } from 'typeorm';
import { MonitorWorkPlan } from './entities/monitor-work-plan.entity';
import { MonitorWeek } from './entities/monitor-week.entity';
import { MonitorWeekActivity, MAX_WEEKLY_HOURS } from './entities/monitor-week-activity.entity';
import { MonitorEvidence } from './entities/monitor-evidence.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  CreateMonitorPlanDto, CreateWeekActivityDto, UpdateWeekActivityDto,
  CreateEvidenceDto, CreateMonitorWeekDto, UpdateMonitorWeekDto,
} from './dto/monitors.dto';

// Resumen de horas de una semana
export interface WeekSummary {
  weekNumber: number;
  weekLabel: string | null;
  hours: number;
  exceedsCap: boolean;
  activityCount: number;
}

// Total de horas de un rango de semanas (base del certificado)
export interface HoursRange {
  from: number;
  to: number;
  totalHours: number;
  weeks: WeekSummary[];
}

@Injectable()
export class MonitorsService {
  constructor(
    @InjectRepository(MonitorWorkPlan)
    private readonly planRepo: Repository<MonitorWorkPlan>,

    @InjectRepository(MonitorWeek)
    private readonly weekRepo: Repository<MonitorWeek>,

    @InjectRepository(MonitorWeekActivity)
    private readonly activityRepo: Repository<MonitorWeekActivity>,

    @InjectRepository(MonitorEvidence)
    private readonly evidenceRepo: Repository<MonitorEvidence>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    // Necesario para serializar el control del tope semanal: la validación y
    // la escritura tienen que ir en la misma transacción, con la fila de la
    // semana bloqueada.
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════
  // PERMISOS
  // ══════════════════════════════════════════════════════════

  /** Roles con acceso al módulo. Cualquier otro rol recibe 403. */
  private readonly ALLOWED_ROLES: UserRole[] = [
    UserRole.MONITOR, UserRole.ENLACE, UserRole.ADMIN,
  ];

  /**
   * Puerta de entrada del módulo: los planes de monitoras son operativos del
   * nodo (soporte de pago), no de supervisión académica. Vicerrectorías,
   * decanos, coordinadores, docentes y auxiliares NO entran.
   */
  assertModuleAccess(user: User): void {
    if (!this.ALLOWED_ROLES.includes(user.role)) {
      throw new ForbiddenException('No tienes acceso al módulo de monitorías');
    }
  }

  /**
   * Un plan sin nodo es un plan que nadie puede certificar: `sharesNodo`
   * exige que ambos lados tengan nodo, así que ningún enlace lo vería.
   * Se corta antes de crearlo, con un mensaje que dice qué hacer.
   */
  private assertHasNodo(monitor: User): void {
    if (!monitor.nodoId) {
      throw new BadRequestException(
        'La monitora no tiene un nodo asignado. Pide al administrador que la ' +
        'asigne a un nodo antes de crear su plan de trabajo: sin nodo, el ' +
        'enlace no podría ver el plan ni certificar sus horas.',
      );
    }
  }

  /**
   * Igual que `assertHasNodo`, pero sobre un plan YA existente: cubre el caso
   * de la monitora a la que le retiran el nodo después de haber empezado.
   * `syncPlanNodo` deja entonces `plan.nodoId` en null y, sin este corte, la
   * monitora seguiría registrando horas que ningún enlace puede ver ni
   * certificar — trabajo real que no se le pagaría.
   *
   * Se evalúa DESPUÉS del permiso: si fuera antes, quien sondea el plan de
   * otra persona recibiría 400 en vez de 403 y sabría que ese plan existe.
   * En la práctica solo lo alcanza la monitora dueña del plan: el enlace, con
   * `nodoId` null, ya falló en `sharesNodo`. El admin pasa porque es quien
   * asigna los nodos y necesita poder abrir el plan para arreglarlo.
   */
  private assertPlanHasNodo(plan: MonitorWorkPlan, user: User): void {
    if (plan.nodoId || user.role === UserRole.ADMIN) return;
    throw new BadRequestException(
      'Tu plan de monitoría no está asociado a ningún nodo. Pide al ' +
      'administrador que te asigne un nodo: mientras tanto, el enlace no ' +
      'puede ver tus horas ni certificarlas para el pago.',
    );
  }

  /** ¿El enlace/admin puede tocar cosas de este nodo? */
  private sharesNodo(user: User, nodoId: string | null): boolean {
    return !!user.nodoId && !!nodoId && user.nodoId === nodoId;
  }

  private canView(plan: MonitorWorkPlan, user: User): boolean {
    switch (user.role) {
      case UserRole.ADMIN:
        return true;
      case UserRole.MONITOR:
        return plan.monitorId === user.id;
      case UserRole.ENLACE:
        return this.sharesNodo(user, plan.nodoId);
      default:
        return false;
    }
  }

  /**
   * Escritura. La monitora solo escribe en su plan; el enlace solo en planes
   * de su nodo (necesario para autorizar semanas por encima del tope).
   */
  private canEdit(plan: MonitorWorkPlan, user: User): boolean {
    return this.canView(plan, user);
  }

  /** ¿Este usuario puede saltarse el tope de 12 h dejando constancia? */
  private canOverrideCap(user: User): boolean {
    return user.role === UserRole.ENLACE || user.role === UserRole.ADMIN;
  }

  // ══════════════════════════════════════════════════════════
  // PLANES
  // ══════════════════════════════════════════════════════════

  /**
   * Resincroniza `plan.nodoId` con el nodo actual del perfil de la monitora.
   *
   * El nodo se copia al plan para poder filtrar por él sin joins, pero esa
   * copia se queda vieja cuando la monitora cambia de nodo (o cuando entra
   * al sistema antes de que le asignen uno). Si no se refresca, el enlace
   * ANTERIOR sigue viendo y certificando sus horas y el nuevo no la ve.
   * Por eso el perfil manda y el plan se corrige, siempre ANTES de decidir
   * permisos.
   */
  private async syncPlanNodo(plan: MonitorWorkPlan): Promise<MonitorWorkPlan> {
    const monitor = plan.monitor
      ?? await this.userRepo.findOne({ where: { id: plan.monitorId } });
    if (!monitor) return plan;

    const actual = monitor.nodoId ?? null;
    if (actual !== plan.nodoId) {
      await this.planRepo.update({ id: plan.id }, { nodoId: actual });
      plan.nodoId = actual;
    }
    return plan;
  }

  /** Carga un plan y valida permiso de lectura en un solo paso. */
  async getPlanForRead(planId: string, user: User): Promise<MonitorWorkPlan> {
    this.assertModuleAccess(user);
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['monitor'],
    });
    if (!plan) throw new NotFoundException('Plan de monitoría no encontrado');

    await this.syncPlanNodo(plan);   // el nodo del perfil manda

    if (!this.canView(plan, user)) {
      throw new ForbiddenException('No tienes permiso para ver este plan de monitoría');
    }
    this.assertPlanHasNodo(plan, user);
    return plan;
  }

  private async getPlanForWrite(planId: string, user: User): Promise<MonitorWorkPlan> {
    this.assertModuleAccess(user);
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['monitor'],
    });
    if (!plan) throw new NotFoundException('Plan de monitoría no encontrado');

    await this.syncPlanNodo(plan);

    if (!this.canEdit(plan, user)) {
      throw new ForbiddenException('No tienes permiso para editar este plan de monitoría');
    }
    this.assertPlanHasNodo(plan, user);
    return plan;
  }

  /**
   * Plan completo: semanas → tareas → evidencias (anidado). Las semanas son
   * la unidad visual; cada semana trae sus tareas con horas y estado del tope,
   * y cada tarea sus evidencias.
   */
  async findPlanDetail(planId: string, user: User) {
    const plan = await this.getPlanForRead(planId, user);

    // Garantiza que toda actividad tenga su semana (idempotente). Cubre datos
    // creados antes de que la semana fuera una entidad propia.
    await this.ensureWeeksForPlan(plan.id);

    const [weeks, activities, evidences] = await Promise.all([
      this.weekRepo.find({ where: { workPlanId: plan.id }, order: { weekNumber: 'ASC' } }),
      this.activityRepo.find({
        where: { workPlanId: plan.id },
        order: { weekNumber: 'ASC', createdAt: 'ASC' },
      }),
      this.evidenceRepo.find({
        where: { workPlanId: plan.id },
        order: { uploadedAt: 'DESC' },
      }),
    ]);

    // Evidencias agrupadas por tarea (flujo nuevo)
    const evByActivity = new Map<string, MonitorEvidence[]>();
    for (const e of evidences) {
      if (!e.activityId) continue;
      const list = evByActivity.get(e.activityId) ?? [];
      list.push(e);
      evByActivity.set(e.activityId, list);
    }

    const nestedWeeks = weeks.map((w) => {
      const acts = activities
        .filter((a) => a.weekId === w.id)
        .map((a) => ({
          id:           a.id,
          weekId:       a.weekId,
          weekNumber:   a.weekNumber,
          description:  a.description,
          hours:        Number(a.hours),
          overrideNote: a.overrideNote,
          createdAt:    a.createdAt,
          evidences:    evByActivity.get(a.id) ?? [],
        }));
      const hours = this.round1(acts.reduce((s, a) => s + a.hours, 0));
      return {
        id:            w.id,
        weekNumber:    w.weekNumber,
        startDate:     w.startDate,
        endDate:       w.endDate,
        hours,
        exceedsCap:    hours > MAX_WEEKLY_HOURS,
        activityCount: acts.length,
        activities:    acts,
      };
    });

    return {
      id:         plan.id,
      monitorId:  plan.monitorId,
      nodoId:     plan.nodoId,
      vigencia:   plan.vigencia,
      createdAt:  plan.createdAt,
      updatedAt:  plan.updatedAt,
      monitor:    plan.monitor ? this.publicMonitor(plan.monitor) : undefined,
      weeks:      nestedWeeks,
      // Evidencias viejas que no cuelgan de una tarea (compatibilidad)
      looseEvidences: evidences.filter((e) => !e.activityId),
      totalHours: this.round1(activities.reduce((s, a) => s + Number(a.hours), 0)),
    };
  }

  /**
   * Backfill idempotente: crea una semana por cada week_number que tenga
   * actividades huérfanas (sin week_id) y las enlaza. No hace nada si ya está
   * todo enlazado, así que es barato llamarlo en cada lectura del plan.
   */
  private async ensureWeeksForPlan(planId: string): Promise<void> {
    const orphans = await this.activityRepo.find({
      where: { workPlanId: planId, weekId: IsNull() },
    });
    if (orphans.length === 0) return;

    const numbers = [...new Set(orphans.map((a) => a.weekNumber))];
    for (const weekNumber of numbers) {
      let week = await this.weekRepo.findOne({ where: { workPlanId: planId, weekNumber } });
      if (!week) {
        week = await this.weekRepo.save(
          this.weekRepo.create({ workPlanId: planId, weekNumber, startDate: null, endDate: null }),
        );
      }
      await this.activityRepo.update(
        { workPlanId: planId, weekNumber, weekId: IsNull() },
        { weekId: week.id },
      );
    }
  }

  // ══════════════════════════════════════════════════════════
  // SEMANAS
  // ══════════════════════════════════════════════════════════

  /** Crea una semana (número + rango de fechas) en el plan. */
  async createWeek(planId: string, dto: CreateMonitorWeekDto, user: User): Promise<MonitorWeek> {
    const plan = await this.getPlanForWrite(planId, user);

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la de inicio');
    }

    const existing = await this.weekRepo.findOne({
      where: { workPlanId: plan.id, weekNumber: dto.weekNumber },
    });
    if (existing) {
      throw new BadRequestException(`La semana ${dto.weekNumber} ya existe en este plan`);
    }

    return this.weekRepo.save(
      this.weekRepo.create({
        workPlanId: plan.id,
        weekNumber: dto.weekNumber,
        startDate:  dto.startDate,
        endDate:    dto.endDate,
      }),
    );
  }

  /** Carga una semana validando permiso de escritura sobre su plan. */
  private async getWeekForWrite(weekId: string, user: User): Promise<MonitorWeek> {
    this.assertModuleAccess(user);
    const week = await this.weekRepo.findOne({ where: { id: weekId } });
    if (!week) throw new NotFoundException('Semana no encontrada');
    await this.getPlanForWrite(week.workPlanId, user);
    return week;
  }

  async updateWeek(weekId: string, dto: UpdateMonitorWeekDto, user: User): Promise<MonitorWeek> {
    const week = await this.getWeekForWrite(weekId, user);

    const startDate = dto.startDate ?? week.startDate;
    const endDate   = dto.endDate   ?? week.endDate;
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la de inicio');
    }

    if (dto.weekNumber !== undefined && dto.weekNumber !== week.weekNumber) {
      const clash = await this.weekRepo.findOne({
        where: { workPlanId: week.workPlanId, weekNumber: dto.weekNumber },
      });
      if (clash) throw new BadRequestException(`La semana ${dto.weekNumber} ya existe en este plan`);
      // Mantener el weekNumber denormalizado de las actividades en sincronía
      await this.activityRepo.update(
        { weekId: week.id },
        { weekNumber: dto.weekNumber },
      );
      week.weekNumber = dto.weekNumber;
    }

    if (dto.startDate !== undefined) week.startDate = dto.startDate;
    if (dto.endDate   !== undefined) week.endDate   = dto.endDate;

    return this.weekRepo.save(week);
  }

  /** Borra una semana. Bloquea si todavía tiene tareas (evita pérdidas). */
  async deleteWeek(weekId: string, user: User): Promise<void> {
    const week = await this.getWeekForWrite(weekId, user);

    const count = await this.activityRepo.count({ where: { weekId: week.id } });
    if (count > 0) {
      throw new BadRequestException(
        `La semana ${week.weekNumber} tiene ${count} tarea(s). Elimínalas antes de borrar la semana.`,
      );
    }

    await this.weekRepo.delete(week.id);
  }

  /**
   * Plan propio de la monitora en una vigencia. Si no existe, se crea vacío
   * para que la vista no tenga que hacer dos llamadas.
   */
  async findOrCreateMyPlan(user: User, vigencia: string) {
    this.assertModuleAccess(user);
    if (user.role !== UserRole.MONITOR) {
      throw new ForbiddenException('Solo las monitoras tienen plan de monitoría propio');
    }

    // Antes de todo, no solo al crear: si la monitora ya tenía plan y le
    // retiraron el nodo, seguir dejándola entrar solo sirve para que acumule
    // horas que nadie podrá certificarle.
    this.assertHasNodo(user);

    let plan = await this.planRepo.findOne({
      where: { monitorId: user.id, vigencia },
    });

    if (!plan) {
      // Sin nodo el plan nacería con nodo_id null y NINGÚN enlace podría
      // verlo ni certificarlo nunca, ni siquiera después de asignarle el
      // nodo. Mejor un error que se entiende que un plan huérfano.
      plan = await this.planRepo.save(
        this.planRepo.create({
          monitorId: user.id,
          nodoId:    user.nodoId ?? null,   // del usuario, nunca del body
          vigencia,
        }),
      );
    }

    return this.findPlanDetail(plan.id, user);
  }

  /** Crear plan. La monitora solo para sí misma; el admin para cualquiera. */
  async createPlan(dto: CreateMonitorPlanDto, user: User): Promise<MonitorWorkPlan> {
    this.assertModuleAccess(user);

    let monitorId = user.id;

    if (dto.monitorId && dto.monitorId !== user.id) {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('No puedes crear un plan a nombre de otra persona');
      }
      monitorId = dto.monitorId;
    } else if (user.role !== UserRole.MONITOR) {
      throw new ForbiddenException('Solo las monitoras tienen plan de monitoría propio');
    }

    const monitor = await this.userRepo.findOne({ where: { id: monitorId } });
    if (!monitor) throw new NotFoundException('Monitora no encontrada');
    if (monitor.role !== UserRole.MONITOR) {
      throw new BadRequestException('El usuario indicado no tiene rol monitor');
    }
    this.assertHasNodo(monitor);   // sin nodo el plan quedaría invisible

    const existing = await this.planRepo.findOne({
      where: { monitorId, vigencia: dto.vigencia },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe un plan de monitoría para la vigencia ${dto.vigencia}`,
      );
    }

    return this.planRepo.save(
      this.planRepo.create({
        monitorId,
        nodoId:   monitor.nodoId ?? null,   // del perfil de la monitora
        vigencia: dto.vigencia,
      }),
    );
  }

  // ══════════════════════════════════════════════════════════
  // LISTADO DE MONITORAS (vista del enlace)
  // ══════════════════════════════════════════════════════════

  /**
   * Monitoras visibles para el usuario.
   *   enlace → solo las de su nodo (sin nodo asignado: lista vacía)
   *   admin  → todas
   *   monitor→ 403 (no lista compañeras)
   */
  async listMonitors(user: User) {
    this.assertModuleAccess(user);

    if (user.role === UserRole.MONITOR) {
      throw new ForbiddenException('No tienes permiso para listar monitoras');
    }

    if (user.role === UserRole.ENLACE && !user.nodoId) {
      return [];   // enlace sin nodo asignado no ve monitoras de nadie
    }

    const monitors = await this.userRepo.find({
      where: user.role === UserRole.ADMIN
        ? { role: UserRole.MONITOR }
        : { role: UserRole.MONITOR, nodoId: user.nodoId as string },
      order: { name: 'ASC' },
    });

    // Adjuntar sus planes (ya filtrados por el mismo criterio de nodo)
    const plans = monitors.length
      ? await this.planRepo
          .createQueryBuilder('p')
          .where('p.monitor_id IN (:...ids)', { ids: monitors.map((m) => m.id) })
          .orderBy('p.vigencia', 'DESC')
          .getMany()
      : [];

    return monitors.map((m) => ({
      ...this.publicMonitor(m),
      plans: plans
        .filter((p) => p.monitorId === m.id)
        .map((p) => ({ id: p.id, vigencia: p.vigencia })),
    }));
  }

  /** Plan de una monitora concreta (vista del enlace). */
  async findMonitorPlan(monitorId: string, vigencia: string | undefined, user: User) {
    this.assertModuleAccess(user);

    if (user.role === UserRole.MONITOR && monitorId !== user.id) {
      throw new ForbiddenException('No tienes permiso para ver el plan de otra monitora');
    }

    const plan = await this.planRepo.findOne({
      where: vigencia ? { monitorId, vigencia } : { monitorId },
      order: { vigencia: 'DESC' },
    });
    if (!plan) throw new NotFoundException('Esta monitora aún no tiene plan de trabajo');

    return this.findPlanDetail(plan.id, user);
  }

  // ══════════════════════════════════════════════════════════
  // ACTIVIDADES POR SEMANA
  // ══════════════════════════════════════════════════════════

  async addActivity(
    planId: string, dto: CreateWeekActivityDto, user: User,
  ): Promise<MonitorWeekActivity> {
    const plan = await this.getPlanForWrite(planId, user);

    // Todo el control del tope va dentro de la transacción, con la fila de la
    // semana bloqueada: si no, dos peticiones simultáneas leen las mismas
    // horas "ya registradas", ambas se creen por debajo del tope y entre las
    // dos lo superan sin autorización de nadie.
    return this.dataSource.transaction(async (m) => {
      const week = await this.lockWeek(m, dto.weekId);

      // La semana ya existe y debe pertenecer a este plan (flujo nuevo: no se
      // vuelve a escribir el nombre de la semana).
      if (!week || week.workPlanId !== plan.id) {
        throw new BadRequestException('La semana indicada no pertenece a este plan');
      }

      await this.assertWeeklyCap(
        m, plan.id, week.weekNumber, dto.hours, null, dto.overrideNote, user,
      );

      const repo = m.getRepository(MonitorWeekActivity);
      return repo.save(
        repo.create({
          workPlanId:   plan.id,
          weekId:       week.id,
          weekNumber:   week.weekNumber,   // denormalizado desde la semana
          weekLabel:    null,
          description:  dto.description,
          hours:        dto.hours,
          overrideNote: this.canOverrideCap(user) ? (dto.overrideNote ?? null) : null,
        }),
      );
    });
  }

  async updateActivity(
    activityId: string, dto: UpdateWeekActivityDto, user: User,
  ): Promise<MonitorWeekActivity> {
    this.assertModuleAccess(user);

    const existing = await this.activityRepo.findOne({ where: { id: activityId } });
    if (!existing) throw new NotFoundException('Actividad no encontrada');

    const plan = await this.getPlanForWrite(existing.workPlanId, user);

    return this.dataSource.transaction(async (m) => {
      // El candado del tope cuelga de la fila de la semana. Una tarea sin
      // semana (dato viejo, anterior a que la semana fuera entidad) no tiene
      // qué bloquear: seguir sin candado dejaría un hueco por donde dos
      // peticiones simultáneas se saltan las 12 h. Se corta aquí, antes de
      // escribir nada, y se dice cómo repararlo.
      if (!existing.weekId) {
        throw new BadRequestException(
          'Esta tarea todavía no está asociada a una semana. Abre el plan de ' +
          'trabajo para completar la migración y vuelve a intentarlo.',
        );
      }
      await this.lockWeek(m, existing.weekId);

      const repo = m.getRepository(MonitorWeekActivity);
      const activity = await repo.findOne({ where: { id: activityId } });
      if (!activity) throw new NotFoundException('Actividad no encontrada');

      const hours = dto.hours ?? Number(activity.hours);

      // El tope se evalúa sobre la semana de la tarea (la edición no la mueve
      // de semana; para eso se borra y se crea en otra).
      await this.assertWeeklyCap(
        m, plan.id, activity.weekNumber, hours, activity.id, dto.overrideNote, user,
      );

      activity.hours = hours;
      if (dto.description !== undefined) activity.description = dto.description;
      if (dto.overrideNote !== undefined && this.canOverrideCap(user)) {
        activity.overrideNote = dto.overrideNote ?? null;
      }

      return repo.save(activity);
    });
  }

  /**
   * Bloquea la fila de la semana (SELECT ... FOR UPDATE) para serializar a
   * quien escriba tareas en ella. Cualquier otra transacción que quiera la
   * misma semana espera aquí hasta que esta haga commit.
   */
  private async lockWeek(m: EntityManager, weekId: string): Promise<MonitorWeek | null> {
    return m.getRepository(MonitorWeek)
      .createQueryBuilder('w')
      .setLock('pessimistic_write')
      .where('w.id = :id', { id: weekId })
      .getOne();
  }

  async deleteActivity(activityId: string, user: User): Promise<void> {
    this.assertModuleAccess(user);

    const activity = await this.activityRepo.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    await this.getPlanForWrite(activity.workPlanId, user);
    await this.activityRepo.delete(activity.id);
  }

  /**
   * Tope de 12 h por semana.
   *   monitor        → bloqueo duro (400)
   *   enlace / admin → permitido si deja una nota de autorización
   */
  private async assertWeeklyCap(
    m: EntityManager,
    planId: string,
    weekNumber: number,
    newHours: number,
    excludeActivityId: string | null,
    overrideNote: string | undefined,
    user: User,
  ): Promise<void> {
    const siblings = await m.getRepository(MonitorWeekActivity).find({
      where: { workPlanId: planId, weekNumber },
    });

    const others = siblings
      .filter((a) => a.id !== excludeActivityId)
      .reduce((s, a) => s + Number(a.hours), 0);

    const total = this.round1(others + Number(newHours));
    if (total <= MAX_WEEKLY_HOURS) return;

    // La semana ya está por encima del tope (el enlace la autorizó). Un cambio
    // que NO empeora el total no se bloquea: si no, la monitora no podría ni
    // corregir una descripción ni bajarse las horas en esa semana, solo
    // borrar la tarea entera.
    const currentTotal = this.round1(siblings.reduce((s, a) => s + Number(a.hours), 0));
    if (total <= currentTotal) return;

    if (!this.canOverrideCap(user)) {
      throw new BadRequestException(
        `La semana ${weekNumber} quedaría en ${total} h y el tope es de ` +
        `${MAX_WEEKLY_HOURS} h. Ajusta las horas o pide autorización a tu enlace.`,
      );
    }

    if (!overrideNote?.trim()) {
      throw new BadRequestException(
        `La semana ${weekNumber} supera el tope de ${MAX_WEEKLY_HOURS} h (${total} h). ` +
        'Para autorizarla debes registrar una nota de justificación.',
      );
    }
  }

  // ══════════════════════════════════════════════════════════
  // EVIDENCIAS
  // ══════════════════════════════════════════════════════════

  async addEvidence(
    planId: string, dto: CreateEvidenceDto, user: User,
  ): Promise<MonitorEvidence> {
    const plan = await this.getPlanForWrite(planId, user);

    // La evidencia documenta una TAREA concreta del plan
    const activity = await this.activityRepo.findOne({ where: { id: dto.activityId } });
    if (!activity || activity.workPlanId !== plan.id) {
      throw new BadRequestException('La tarea indicada no pertenece a este plan');
    }

    return this.evidenceRepo.save(
      this.evidenceRepo.create({
        workPlanId: plan.id,
        activityId: activity.id,
        weekNumber: activity.weekNumber,   // legacy: copiado de la tarea
        fileUrl:    dto.fileUrl,
        caption:    dto.caption ?? null,
      }),
    );
  }

  async deleteEvidence(evidenceId: string, user: User): Promise<void> {
    this.assertModuleAccess(user);

    const evidence = await this.evidenceRepo.findOne({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');

    await this.getPlanForWrite(evidence.workPlanId, user);
    // Borrado lógico: la evidencia respalda horas ya certificadas. Desaparece
    // de la vista, pero la fila queda para auditoría del trámite de pago.
    await this.evidenceRepo.softDelete(evidence.id);
  }

  // ══════════════════════════════════════════════════════════
  // HORAS DE UN RANGO DE SEMANAS (base del certificado)
  // ══════════════════════════════════════════════════════════

  async getHoursRange(
    planId: string, from: number, to: number, user: User,
  ): Promise<HoursRange> {
    const plan = await this.getPlanForRead(planId, user);

    if (from > to) {
      throw new BadRequestException('La semana inicial no puede ser mayor que la final');
    }

    const activities = await this.activityRepo.find({
      where: { workPlanId: plan.id },
      order: { weekNumber: 'ASC' },
    });

    const inRange = activities.filter(
      (a) => a.weekNumber >= from && a.weekNumber <= to,
    );

    return {
      from, to,
      totalHours: this.round1(inRange.reduce((s, a) => s + Number(a.hours), 0)),
      weeks: this.summarizeWeeks(inRange),
    };
  }

  // ══════════════════════════════════════════════════════════
  // FIRMA DEL ENLACE
  // ══════════════════════════════════════════════════════════

  /** El enlace (o el admin) sube su propia firma. Se reutiliza en cada certificado. */
  async updateMySignature(signatureUrl: string, user: User): Promise<{ signatureUrl: string }> {
    this.assertModuleAccess(user);

    if (!this.canOverrideCap(user)) {   // monitor no firma certificados
      throw new ForbiddenException('Solo el enlace puede registrar su firma');
    }

    await this.userRepo.update({ id: user.id }, { signatureUrl });
    return { signatureUrl };
  }

  async getMySignature(user: User): Promise<{ signatureUrl: string | null }> {
    this.assertModuleAccess(user);
    const me = await this.userRepo.findOne({ where: { id: user.id } });
    return { signatureUrl: me?.signatureUrl ?? null };
  }

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════

  /** Redondea a un decimal para evitar 12.000000000000002 al sumar. */
  private round1(n: number): number {
    return Math.round(n * 10) / 10;
  }

  /** Agrupa actividades por semana y marca las que superan el tope. */
  private summarizeWeeks(activities: MonitorWeekActivity[]): WeekSummary[] {
    const byWeek = new Map<number, WeekSummary>();

    for (const a of activities) {
      const current = byWeek.get(a.weekNumber) ?? {
        weekNumber:    a.weekNumber,
        weekLabel:     a.weekLabel,
        hours:         0,
        exceedsCap:    false,
        activityCount: 0,
      };
      current.hours = this.round1(current.hours + Number(a.hours));
      current.activityCount += 1;
      current.weekLabel = current.weekLabel ?? a.weekLabel;
      current.exceedsCap = current.hours > MAX_WEEKLY_HOURS;
      byWeek.set(a.weekNumber, current);
    }

    return [...byWeek.values()].sort((x, y) => x.weekNumber - y.weekNumber);
  }

  /** Proyección del usuario monitora sin datos sensibles (nunca el hash). */
  private publicMonitor(u: User) {
    return {
      id:             u.id,
      name:           u.name,
      email:          u.email,
      documentType:   u.documentType,
      documentNumber: u.documentNumber,
      program:        u.program,
      faculty:        u.faculty,
      nodoId:         u.nodoId,
      nodoName:       u.nodoName,
      phone:          u.phone,
    };
  }

  /** Datos del enlace que firma (para el certificado). Uso interno de Reports. */
  async findNodoEnlace(nodoId: string | null): Promise<User | null> {
    if (!nodoId) return null;
    return this.userRepo.findOne({
      where: { nodoId, role: UserRole.ENLACE, isActive: true, signatureUrl: Not(IsNull()) },
    });
  }
}
