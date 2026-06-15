/**
 * activities.service.ts — Lógica del módulo de actividades y viáticos
 *
 * Gestiona el ciclo completo:
 *  1. El docente crea la solicitud con los viáticos estimados
 *  2. La envía (pendiente)
 *  3. El admin/decano aprueba o rechaza
 *  4. Al aprobar → genera código ACT-YYYY-NNN
 *  5. El docente ejecuta la actividad y registra gastos reales
 *  6. Sube evidencias (fotos, facturas, participantes)
 *  7. El sistema genera el reporte completo
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
    private readonly dataSource: DataSource,
  ) {}

  // ── ¿Puede el usuario ver esta solicitud? ─────────────────
  private canView(request: ActivityRequest, user: User): boolean {
    const reviewerRoles: UserRole[] = [
      UserRole.ADMIN, UserRole.VICERRECTOR_EXTENSION, UserRole.DECANO, UserRole.COORDINADOR,
    ];
    return request.userId === user.id || reviewerRoles.includes(user.role);
  }

  private canEdit(request: ActivityRequest, user: User): boolean {
    return request.userId === user.id &&
      [RequestStatus.BORRADOR, RequestStatus.PENDIENTE].includes(request.status);
  }

  private isReviewer(user: User): boolean {
    return [UserRole.ADMIN, UserRole.VICERRECTOR_EXTENSION, UserRole.DECANO].includes(user.role);
  }

  // ══════════════════════════════════════════════════════════
  // SOLICITUDES
  // ══════════════════════════════════════════════════════════

  async findAll(user: User, filters?: { status?: string; userId?: string }): Promise<ActivityRequest[]> {
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .orderBy('r.activity_date', 'DESC');

    // Docentes y enlaces solo ven sus propias solicitudes
    if (!this.isReviewer(user)) {
      qb.where('r.user_id = :uid', { uid: user.id });
    }

    if (filters?.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters?.userId && this.isReviewer(user)) {
      qb.andWhere('r.user_id = :userId', { userId: filters.userId });
    }

    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<ActivityRequest> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['user', 'expenses', 'participants', 'evidence'],
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (!this.canView(request, user)) throw new ForbiddenException('Sin permiso para ver esta solicitud');

    // Ordenar las subcolecciones en la aplicación — TypeORM no soporta
    // order por relaciones OneToMany en findOne sin JOIN explícito.
    if (request.expenses)
      request.expenses.sort((a, b) => (a.expenseDate > b.expenseDate ? 1 : -1));
    if (request.participants)
      request.participants.sort((a, b) => (a.registeredAt > b.registeredAt ? 1 : -1));
    if (request.evidence)
      request.evidence.sort((a, b) => (a.uploadedAt > b.uploadedAt ? 1 : -1));

    return request;
  }

  async create(dto: CreateActivityRequestDto, user: User): Promise<ActivityRequest> {
    const total = (dto.requiresFood ? (dto.foodAmount ?? 0) : 0)
      + (dto.requiresTransport ? (dto.transportAmount ?? 0) : 0)
      + (dto.requiresAccommodation ? (dto.accommodationAmount ?? 0) : 0)
      + (dto.requiresMaterials ? (dto.materialsAmount ?? 0) : 0)
      + (dto.requiresOther ? (dto.otherAmount ?? 0) : 0);

    const request = this.requestRepo.create({
      userId: user.id,
      title: dto.title,
      description: dto.description ?? null,
      activityDate: new Date(dto.activityDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      location: dto.location ?? null,
      expectedParticipants: dto.expectedParticipants ?? 0,
      axisActivityId: dto.axisActivityId ?? null,
      requiresFood: dto.requiresFood ?? false,
      foodAmount: dto.requiresFood ? (dto.foodAmount ?? 0) : 0,
      requiresTransport: dto.requiresTransport ?? false,
      transportAmount: dto.requiresTransport ? (dto.transportAmount ?? 0) : 0,
      requiresAccommodation: dto.requiresAccommodation ?? false,
      accommodationAmount: dto.requiresAccommodation ? (dto.accommodationAmount ?? 0) : 0,
      requiresMaterials: dto.requiresMaterials ?? false,
      materialsAmount: dto.requiresMaterials ? (dto.materialsAmount ?? 0) : 0,
      requiresOther: dto.requiresOther ?? false,
      otherDescription: dto.otherDescription ?? null,
      otherAmount: dto.requiresOther ? (dto.otherAmount ?? 0) : 0,
      requiresAdvance: dto.requiresAdvance ?? false,
      advanceAmount: dto.requiresAdvance ? (dto.advanceAmount ?? 0) : 0,
      totalEstimated: total,
      status: RequestStatus.BORRADOR,
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

  // Enviar para revisión (borrador → pendiente)
  async submit(id: string, user: User): Promise<ActivityRequest> {
    const request = await this.findOne(id, user);
    if (request.userId !== user.id) throw new ForbiddenException('Solo el autor puede enviar la solicitud');
    if (request.status !== RequestStatus.BORRADOR) {
      throw new BadRequestException('Solo se pueden enviar solicitudes en borrador');
    }
    request.status = RequestStatus.PENDIENTE;
    return this.requestRepo.save(request);
  }

  // Aprobar o rechazar (admin/decano)
  async review(id: string, dto: ReviewActivityDto, reviewer: User): Promise<ActivityRequest> {
    if (!this.isReviewer(reviewer)) throw new ForbiddenException('Solo administradores o decanos pueden revisar solicitudes');

    const request = await this.findOne(id, reviewer);
    if (request.status !== RequestStatus.PENDIENTE) {
      throw new BadRequestException('Solo se pueden revisar solicitudes pendientes');
    }
    if (dto.decision === 'rechazada' && !dto.rejectionReason) {
      throw new BadRequestException('Debes indicar el motivo del rechazo');
    }

    request.status     = dto.decision === 'aprobada' ? RequestStatus.APROBADA : RequestStatus.RECHAZADA;
    request.reviewedBy = reviewer.id;
    request.reviewedAt = new Date();
    request.reviewerNotes  = dto.reviewerNotes ?? null;
    request.rejectionReason = dto.rejectionReason ?? null;

    // Generar código al aprobar
    if (dto.decision === 'aprobada') {
      const result = await this.dataSource.query('SELECT generate_activity_code() AS code');
      request.activityCode = result[0]?.code ?? `ACT-${Date.now()}`;
    }

    return this.requestRepo.save(request);
  }

  // Marcar como ejecutada
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

    // Cambiar a en_ejecucion si estaba solo aprobada
    if (request.status === RequestStatus.APROBADA) {
      request.status = RequestStatus.EN_EJECUCION;
      await this.requestRepo.save(request);
    }

    const expense = this.expenseRepo.create({
      requestId,
      registeredBy: user.id,
      expenseDate: new Date(dto.expenseDate),
      category: dto.category,
      description: dto.description ?? null,
      amount: dto.amount,
      receiptUrl: dto.receiptUrl ?? null,
    });
    return this.expenseRepo.save(expense);
  }

  async getExpenses(requestId: string, user: User): Promise<ActivityExpense[]> {
    await this.findOne(requestId, user); // verifica acceso
    return this.expenseRepo.find({
      where: { requestId },
      order: { expenseDate: 'ASC' },
    });
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
      uploadedBy: user.id,
      evidenceType: dto.evidenceType,
      storageUrl: dto.storageUrl,
      fileName: dto.fileName ?? null,
      caption: dto.caption ?? null,
      fileSizeKb: dto.fileSizeKb ?? null,
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

  // ── Resumen de gastos de una solicitud ────────────────────
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
