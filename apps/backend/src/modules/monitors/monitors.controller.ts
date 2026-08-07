/**
 * monitors.controller.ts — Endpoints del módulo de Monitorías
 *
 * Todos los endpoints exigen JWT. La autorización fina (rol + nodo) vive en
 * MonitorsService, que es quien conoce el dueño de cada plan; aquí solo se
 * cablean las rutas.
 */
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MonitorsService } from './monitors.service';
import {
  CreateMonitorPlanDto, CreateWeekActivityDto, UpdateWeekActivityDto,
  CreateEvidenceDto, UpdateSignatureDto, WeekRangeQueryDto,
  CreateMonitorWeekDto, UpdateMonitorWeekDto,
} from './dto/monitors.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Monitorías')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('monitors')
export class MonitorsController {
  constructor(private readonly svc: MonitorsService) {}

  // ── Vista de la monitora ──────────────────────────────────
  @Get('me/plan')
  @ApiOperation({ summary: 'Mi plan de monitoría en una vigencia (lo crea si no existe)' })
  @ApiQuery({ name: 'vigencia', required: false, example: '2026-1' })
  findMyPlan(@CurrentUser() user: User, @Query('vigencia') vigencia?: string) {
    return this.svc.findOrCreateMyPlan(user, vigencia || defaultVigencia());
  }

  // ── Firma del enlace ──────────────────────────────────────
  @Get('me/signature')
  @ApiOperation({ summary: 'Mi firma registrada (enlace)' })
  getMySignature(@CurrentUser() user: User) {
    return this.svc.getMySignature(user);
  }

  @Patch('me/signature')
  @ApiOperation({ summary: 'Registrar/actualizar mi firma (enlace) — se reutiliza en los certificados' })
  updateMySignature(@Body() dto: UpdateSignatureDto, @CurrentUser() user: User) {
    return this.svc.updateMySignature(dto.signatureUrl, user);
  }

  // ── Vista del enlace ──────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Monitoras de mi nodo (enlace) o todas (admin)' })
  listMonitors(@CurrentUser() user: User) {
    return this.svc.listMonitors(user);
  }

  @Get(':monitorId/plan')
  @ApiOperation({ summary: 'Plan de trabajo de una monitora' })
  @ApiQuery({ name: 'vigencia', required: false, example: '2026-1' })
  findMonitorPlan(
    @Param('monitorId', ParseUUIDPipe) monitorId: string,
    @CurrentUser() user: User,
    @Query('vigencia') vigencia?: string,
  ) {
    return this.svc.findMonitorPlan(monitorId, vigencia, user);
  }

  // ── Planes ────────────────────────────────────────────────
  @Post('plans')
  @ApiOperation({ summary: 'Crear plan de monitoría' })
  createPlan(@Body() dto: CreateMonitorPlanDto, @CurrentUser() user: User) {
    return this.svc.createPlan(dto, user);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Detalle del plan: semanas, actividades y evidencias' })
  findPlan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.findPlanDetail(id, user);
  }

  @Get('plans/:id/hours')
  @ApiOperation({ summary: 'Total de horas de un rango de semanas (base del certificado)' })
  getHours(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WeekRangeQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.getHoursRange(id, query.from, query.to, user);
  }

  // ── Semanas ───────────────────────────────────────────────
  @Post('plans/:id/weeks')
  @ApiOperation({ summary: 'Crear una semana (número + rango de fechas)' })
  createWeek(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMonitorWeekDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.createWeek(id, dto, user);
  }

  @Patch('weeks/:id')
  @ApiOperation({ summary: 'Editar una semana (número o fechas)' })
  updateWeek(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonitorWeekDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateWeek(id, dto, user);
  }

  @Delete('weeks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una semana (bloqueada si tiene tareas)' })
  deleteWeek(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteWeek(id, user);
  }

  // ── Actividades ───────────────────────────────────────────
  @Post('plans/:id/activities')
  @ApiOperation({ summary: 'Agregar tarea a una semana (tope 12 h/semana)' })
  addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWeekActivityDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addActivity(id, dto, user);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Editar actividad' })
  updateActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeekActivityDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateActivity(id, dto, user);
  }

  @Delete('activities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar actividad' })
  deleteActivity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteActivity(id, user);
  }

  // ── Evidencias ────────────────────────────────────────────
  @Post('plans/:id/evidences')
  @ApiOperation({ summary: 'Agregar evidencia (URL + descripción) a una semana' })
  addEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEvidenceDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addEvidence(id, dto, user);
  }

  @Delete('evidences/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar evidencia' })
  deleteEvidence(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteEvidence(id, user);
  }
}

/** Vigencia por defecto: semestre actual, ej. '2026-1'. */
function defaultVigencia(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() < 6 ? 1 : 2}`;
}
