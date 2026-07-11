/**
 * activities.service.ts — Lógica del módulo de actividades y viáticos
 */
import {
  Injectable, NotFoundException,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ActivityRequest, RequestStatus } from './entities/activity-request.entity';
import { ActivityExpense } from './entities/activity-expense.entity';
import { ActivityParticipant } from './entities/activity-participant.entity';
import { ActivityEvidence } from './entities/activity-evidence.entity';
import { CourseSession } from '../sessions/entities/course-session.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  CreateActivityRequestDto, UpdateActivityRequestDto,
  ReviewActivityDto, CreateExpenseDto,
  CreateParticipantDto, CreateEvidenceDto,
} from './dto/activities.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(ActivityRequest)
    private readonly requestRepo: Repository<ActivityRequest>,
    @InjectRepository(ActivityExpense)
    private readonly expenseRepo: Repository<ActivityExpense>,
    @InjectRepository(ActivityParticipant)
    private readonly participantRepo: Repository<ActivityParticipant>,
    @InjectRepository(ActivityEvidence)
    private readonly evidenceRepo: Repository<ActivityEvidence>,
    @InjectRepository(CourseSession)
    private readonly sessionRepo: Repository<CourseSession>,
    private readonly dataSource: DataSource,
  ) {}

  // Solo admin y vicerrector_extension ven/revisan TODAS las actividades
  private readonly GLOBAL_REVIEWERS: UserRole[] = [
    UserRole.ADMIN, UserRole.VICERRECTOR_EXTENSION,
  ];

  private canView(request: ActivityRequest, user: User): boolean {
    if (this.GLOBAL_REVIEWERS.includes(user.role)) return true;
    return request.userId === user.id;
  }

  private canEdit(request: ActivityRequest, user: User): boolean {
    return request.userId === user.id &&
      [RequestStatus.BORRADOR, RequestStatus.PENDIENTE].includes(request.status);
  }

  private isReviewer(user: User): boolean {
    return this.GLOBAL_REVIEWERS.includes(user.role);
  }

  // ══════════════════════════════════════════════════════════
  // SOLICITUDES
  // ══════════════════════════════════════════════════════════

  async findAll(
    user: User,
    filters?: { status?: string; userId?: string; processId?: string; sessionId?: string },
  ): Promise<ActivityRequest[]> {
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('r.strategy', 'strategy')
      .leftJoinAndSelect('r.municipality', 'municipality')
      .orderBy('r.activity_date', 'DESC');

    if (!this.isReviewer(user)) {
      qb.where('r.user_id = :uid', { uid: user.id });
    }

    if (filters?.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters?.userId && this.isReviewer(user)) {
      qb.andWhere('r.user_id = :userId', { userId: filters.userId });
    }
    if (filters?.processId) {
      qb.andWhere('r.process_id = :processId', { processId: filters.processId });
    }
    if (filters?.sessionId) {
      qb.andWhere('r.session_id = :sessionId', { sessionId: filters.sessionId });
    }

    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<ActivityRequest> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['user', 'expenses', 'participants', 'evidence', 'strategy', 'municipality'],
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (!this.canView(request, user)) throw new ForbiddenException('Sin permiso para ver esta solicitud');

    if (request.expenses)
      request.expenses.sort((a, b) => (a.expenseDate > b.expenseDate ? 1 : -1));
    if (request.participants)
      request.participants.sort((a, b) => (a.registeredAt > b.registeredAt ? 1 : -1));
    if (request.evidence)
      request.evidence.sort((a, b) => (a.uploadedAt > b.uploadedAt ? 1 : -1));

    return request;
  }

  // Retorna la última actividad creada para un proceso (para precarga "Usar datos anteriores")
  async getLastForProcess(processId: string, user: User): Promise<ActivityRequest | null> {
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .where('r.process_id = :processId', { processId })
      .orderBy('r.created_at', 'DESC')
      .limit(1);

    if (!this.isReviewer(user)) {
      qb.andWhere('r.user_id = :uid', { uid: user.id });
    }

    return qb.getOne();
  }

  async create(dto: CreateActivityRequestDto, user: User): Promise<ActivityRequest> {
    const total = (dto.requiresFood ? (dto.foodAmount ?? 0) : 0)
      + (dto.requiresTransport ? (dto.transportAmount ?? 0) : 0)
      + (dto.requiresAccommodation ? (dto.accommodationAmount ?? 0) : 0)
      + (dto.requiresMaterials ? (dto.materialsAmount ?? 0) : 0)
      + (dto.requiresOther ? (dto.otherAmount ?? 0) : 0);

    // Si viene con session_id, heredar process_id de esa sesión
    let resolvedProcessId: string | null = null;
    if (dto.sessionId) {
      const session = await this.sessionRepo.findOne({ where: { id: dto.sessionId } });
      resolvedProcessId = session?.processId ?? null;
    }

    const request = this.requestRepo.create({
      userId:              user.id,
      title:               dto.title,
      description:         dto.description ?? null,
      activityDate:        new Date(dto.activityDate),
      endDate:             dto.endDate ? new Date(dto.endDate) : null,
      location:            dto.location ?? null,
      estimatedParticipants: dto.estimatedParticipants ?? 0,
      axisActivityId:      dto.axisActivityId ?? null,
      sessionId:           dto.sessionId ?? null,
      processId:           resolvedProcessId,
      strategyId:          dto.strategyId ?? null,
      municipalityId:      dto.municipalityId ?? null,
      resourceDetail:      dto.resourceDetail ?? null,
      paymentType:         dto.paymentType ?? null,
      hasElectronicInvoiceProvider: dto.hasElectronicInvoiceProvider ?? false,
      requiresFood:         dto.requiresFood ?? false,
      foodAmount:           dto.requiresFood ? (dto.foodAmount ?? 0) : 0,
      requiresTransport:    dto.requiresTransport ?? false,
      transportAmount:      dto.requiresTransport ? (dto.transportAmount ?? 0) : 0,
      requiresAccommodation: dto.requiresAccommodation ?? false,
      accommodationAmount:  dto.requiresAccommodation ? (dto.accommodationAmount ?? 0) : 0,
      requiresMaterials:    dto.requiresMaterials ?? false,
      materialsAmount:      dto.requiresMaterials ? (dto.materialsAmount ?? 0) : 0,
      requiresOther:        dto.requiresOther ?? false,
      otherDescription:     dto.otherDescription ?? null,
      otherAmount:          dto.requiresOther ? (dto.otherAmount ?? 0) : 0,
      requiresAdvance:      dto.requiresAdvance ?? false,
      advanceAmount:        dto.requiresAdvance ? (dto.advanceAmount ?? 0) : 0,
      totalEstimated:       total,
      status:               RequestStatus.BORRADOR,
    });
    return this.requestRepo.save(request);
  }

  async update(id: string, dto: UpdateActivityRequestDto, user: User): Promise<ActivityRequest> {
    const request = await this.findOne(id, user);
    if (!this.canEdit(request, user)) {
      throw new BadRequestException('No puedes editar una solicitud aprobada, rechazada o ejecutada');
    }
    Object.assign(request, dto);
    return this.requestRepo.save(request);
  }

  async submit(id: string, user: User): Promise<ActivityRequest> {
    const request = await this.findOne(id, user);
    if (request.userId !== user.id) throw new ForbiddenException('Solo el autor puede enviar la solicitud');
    if (request.status !== RequestStatus.BORRADOR) {
      throw new BadRequestException('Solo se pueden enviar solicitudes en borrador');
    }
    request.status = RequestStatus.PENDIENTE;
    return this.requestRepo.save(request);
  }

  async review(id: string, dto: ReviewActivityDto, reviewer: User): Promise<ActivityRequest> {
    if (!this.isReviewer(reviewer)) throw new ForbiddenException('Solo el administrador o el vicerrector de extensión pueden revisar solicitudes');

    const request = await this.findOne(id, reviewer);
    if (request.status !== RequestStatus.PENDIENTE) {
      throw new BadRequestException('Solo se pueden revisar solicitudes pendientes');
    }
    if (dto.decision === 'rechazada' && !dto.rejectionReason) {
      throw new BadRequestException('Debes indicar el motivo del rechazo');
    }

    request.status          = dto.decision === 'aprobada' ? RequestStatus.APROBADA : RequestStatus.RECHAZADA;
    request.reviewedBy      = reviewer.id;
    request.reviewedAt      = new Date();
    request.reviewerNotes   = dto.reviewerNotes ?? null;
    request.rejectionReason = dto.rejectionReason ?? null;

    if (dto.decision === 'aprobada') {
      const result = await this.dataSource.query('SELECT generate_activity_code() AS code');
      request.activityCode = result[0]?.code ?? `ACT-${Date.now()}`;
    }

    return this.requestRepo.save(request);
  }

  async markExecuted(id: string, user: User): Promise<ActivityRequest> {
    const request = await this.findOne(id, user);
    if (request.userId !== user.id && !this.isReviewer(user)) throw new ForbiddenException('Sin permiso');
    if (request.status !== RequestStatus.APROBADA && request.status !== RequestStatus.EN_EJECUCION) {
      throw new BadRequestException('La solicitud debe estar aprobada para marcarla como ejecutada');
    }
    request.status = RequestStatus.EJECUTADA;
    return this.requestRepo.save(request);
  }

  // ══════════════════════════════════════════════════════════
  // GASTOS REALES
  // ══════════════════════════════════════════════════════════

  async addExpense(requestId: string, dto: CreateExpenseDto, user: User): Promise<ActivityExpense> {
    const request = await this.findOne(requestId, user);
    if (request.userId !== user.id) throw new ForbiddenException('Solo el autor puede registrar gastos');
    if (![RequestStatus.APROBADA, RequestStatus.EN_EJECUCION, RequestStatus.EJECUTADA].includes(request.status)) {
      throw new BadRequestException('Solo puedes registrar gastos en solicitudes aprobadas');
    }

    if (request.status === RequestStatus.APROBADA) {
      request.status = RequestStatus.EN_EJECUCION;
      await this.requestRepo.save(request);
    }

    const expense = this.expenseRepo.create({
      requestId,
      registeredBy: user.id,
      expenseDate:  new Date(dto.expenseDate),
      category:     dto.category,
      description:  dto.description ?? null,
      amount:       dto.amount,
      receiptUrl:   dto.receiptUrl ?? null,
    });
    return this.expenseRepo.save(expense);
  }

  async getExpenses(requestId: string, user: User): Promise<ActivityExpense[]> {
    await this.findOne(requestId, user);
    return this.expenseRepo.find({ where: { requestId }, order: { expenseDate: 'ASC' } });
  }

  async deleteExpense(expenseId: string, user: User): Promise<void> {
    const expense = await this.expenseRepo.findOne({ where: { id: expenseId }, relations: ['request'] });
    if (!expense) throw new NotFoundException('Gasto no encontrado');
    if (expense.request.userId !== user.id) throw new ForbiddenException('Sin permiso');
    await this.expenseRepo.remove(expense);
  }

  // ══════════════════════════════════════════════════════════
  // PARTICIPANTES
  // ══════════════════════════════════════════════════════════

  async addParticipant(requestId: string, dto: CreateParticipantDto, user: User): Promise<ActivityParticipant> {
    await this.findOne(requestId, user);
    const participant = this.participantRepo.create({ requestId, ...dto });
    return this.participantRepo.save(participant);
  }

  async getParticipants(requestId: string, user: User): Promise<ActivityParticipant[]> {
    await this.findOne(requestId, user);
    return this.participantRepo.find({ where: { requestId }, order: { registeredAt: 'ASC' } });
  }

  async deleteParticipant(participantId: string, user: User): Promise<void> {
    const p = await this.participantRepo.findOne({ where: { id: participantId }, relations: ['request'] });
    if (!p) throw new NotFoundException('Participante no encontrado');
    if (p.request.userId !== user.id && !this.isReviewer(user)) throw new ForbiddenException('Sin permiso');
    await this.participantRepo.remove(p);
  }

  // ══════════════════════════════════════════════════════════
  // EVIDENCIAS
  // ══════════════════════════════════════════════════════════

  async addEvidence(requestId: string, dto: CreateEvidenceDto, user: User): Promise<ActivityEvidence> {
    await this.findOne(requestId, user);
    const evidence = this.evidenceRepo.create({
      requestId,
      uploadedBy:   user.id,
      evidenceType: dto.evidenceType,
      storageUrl:   dto.storageUrl,
      fileName:     dto.fileName ?? null,
      caption:      dto.caption ?? null,
      fileSizeKb:   dto.fileSizeKb ?? null,
    });
    return this.evidenceRepo.save(evidence);
  }

  async getEvidence(requestId: string, user: User): Promise<ActivityEvidence[]> {
    await this.findOne(requestId, user);
    return this.evidenceRepo.find({ where: { requestId }, order: { uploadedAt: 'ASC' } });
  }

  async deleteEvidence(evidenceId: string, user: User): Promise<void> {
    const ev = await this.evidenceRepo.findOne({ where: { id: evidenceId }, relations: ['request'] });
    if (!ev) throw new NotFoundException('Evidencia no encontrada');
    if (ev.request.userId !== user.id && !this.isReviewer(user)) throw new ForbiddenException('Sin permiso');
    await this.evidenceRepo.remove(ev);
  }

  async getExpenseSummary(requestId: string, user: User): Promise<object> {
    await this.findOne(requestId, user);
    const result = await this.dataSource.query(
      `SELECT
        category,
        COUNT(*) AS items,
        SUM(amount) AS total
       FROM activity_expenses
       WHERE request_id = $1
       GROUP BY category
       ORDER BY total DESC`,
      [requestId],
    );
    const grandTotal = result.reduce((s: number, r: { total: string }) => s + parseFloat(r.total), 0);
    return { byCategory: result, grandTotal };
  }
}
