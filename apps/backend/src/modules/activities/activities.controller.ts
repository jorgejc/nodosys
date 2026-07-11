// activities.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import {
  CreateActivityRequestDto, UpdateActivityRequestDto,
  ReviewActivityDto, CreateExpenseDto,
  CreateParticipantDto, CreateEvidenceDto,
} from './dto/activities.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Actividades y Viáticos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly svc: ActivitiesService) {}

  // ── Solicitudes ───────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Listar solicitudes (propias o todas si admin/decano)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'processId', required: false })
  @ApiQuery({ name: 'sessionId', required: false })
  findAll(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('processId') processId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.svc.findAll(user, { status, userId, processId, sessionId });
  }

  @Get('last-for-process/:processId')
  @ApiOperation({ summary: 'Última actividad del proceso (para precarga de recursos)' })
  getLastForProcess(
    @Param('processId', ParseUUIDPipe) processId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getLastForProcess(processId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva solicitud de actividad' })
  create(@Body() dto: CreateActivityRequestDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una solicitud con gastos, participantes y evidencias' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar solicitud (solo en borrador/pendiente)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Enviar solicitud para revisión (borrador → pendiente)' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.submit(id, user);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Aprobar o rechazar solicitud (admin/decano)' })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewActivityDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.review(id, dto, user);
  }

  @Patch(':id/executed')
  @ApiOperation({ summary: 'Marcar actividad como ejecutada' })
  markExecuted(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.markExecuted(id, user);
  }

  // ── Gastos ────────────────────────────────────────────────
  @Get(':id/expenses')
  @ApiOperation({ summary: 'Listar gastos de una actividad' })
  getExpenses(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.getExpenses(id, user);
  }

  @Get(':id/expenses/summary')
  @ApiOperation({ summary: 'Resumen de gastos por categoría' })
  getExpenseSummary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.getExpenseSummary(id, user);
  }

  @Post(':id/expenses')
  @ApiOperation({ summary: 'Registrar gasto real de la actividad' })
  addExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addExpense(id, dto, user);
  }

  @Delete('expenses/:expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteExpense(@Param('expenseId', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteExpense(id, user);
  }

  // ── Participantes ─────────────────────────────────────────
  @Get(':id/participants')
  getParticipants(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.getParticipants(id, user);
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Registrar participante' })
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateParticipantDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addParticipant(id, dto, user);
  }

  @Delete('participants/:participantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteParticipant(@Param('participantId', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteParticipant(id, user);
  }

  // ── Evidencias ────────────────────────────────────────────
  @Get(':id/evidence')
  getEvidence(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.getEvidence(id, user);
  }

  @Post(':id/evidence')
  @ApiOperation({ summary: 'Registrar evidencia (URL de Supabase Storage)' })
  addEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEvidenceDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addEvidence(id, dto, user);
  }

  @Delete('evidence/:evidenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvidence(@Param('evidenceId', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteEvidence(id, user);
  }
}
