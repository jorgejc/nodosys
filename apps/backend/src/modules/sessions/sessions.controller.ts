import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseUUIDPipe, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import {
  CreateSessionDto, UpdateSessionDto,
  AddAttendeeDto, UpdateAttendeeDto,
  AddSessionEvidenceDto,
} from './dto/sessions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Bitácoras de Sesiones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly svc: SessionsService) {}

  // ── Sesiones de una actividad ─────────────────────────────

  @Get('activity/:activityId')
  @ApiOperation({ summary: 'Listar sesiones de una actividad' })
  findByActivity(@Param('activityId', ParseUUIDPipe) activityId: string) {
    return this.svc.findByActivity(activityId);
  }

  @Post('activity/:activityId')
  @ApiOperation({ summary: 'Crear sesión (con los 3 momentos pedagógicos)' })
  create(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.create(activityId, dto, user);
  }

  @Get('process/:processId')
  @ApiOperation({ summary: 'Listar sesiones de un proceso' })
  findByProcess(@Param('processId', ParseUUIDPipe) processId: string) {
    return this.svc.findByProcess(processId);
  }

  @Post('process/:processId')
  @ApiOperation({ summary: 'Crear sesión bajo un proceso (sin actividad)' })
  createForProcess(
    @Param('processId', ParseUUIDPipe) processId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.createForProcess(processId, dto, user);
  }

  @Get('activity/:activityId/attendance')
  @ApiOperation({ summary: 'Reporte de asistencia consolidado por actividad' })
  attendanceReport(@Param('activityId', ParseUUIDPipe) activityId: string) {
    return this.svc.getAttendanceReport(activityId);
  }

  // ── Sesión individual ─────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Detalle completo de una sesión (momentos + asistentes)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar sesión y/o sus momentos' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar sesión y renumerar las restantes' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.delete(id, user);
  }

  // ── Asistentes ────────────────────────────────────────────

  @Post(':id/attendees')
  @ApiOperation({ summary: 'Agregar asistente a la sesión' })
  addAttendee(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: AddAttendeeDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addAttendee(sessionId, dto, user);
  }

  @Patch(':id/attendees/:aId')
  @ApiOperation({ summary: 'Actualizar asistencia o faltas de un asistente' })
  updateAttendee(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Param('aId', ParseUUIDPipe) attendeeId: string,
    @Body() dto: UpdateAttendeeDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateAttendee(sessionId, attendeeId, dto, user);
  }

  @Delete(':id/attendees/:aId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar asistente de la sesión' })
  deleteAttendee(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Param('aId', ParseUUIDPipe) attendeeId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.deleteAttendee(sessionId, attendeeId, user);
  }

  // ── Evidencias ────────────────────────────────────────────

  @Get(':id/evidences')
  @ApiOperation({ summary: 'Listar evidencias de una sesión' })
  getEvidences(@Param('id', ParseUUIDPipe) sessionId: string) {
    return this.svc.getEvidences(sessionId);
  }

  @Post(':id/evidences')
  @ApiOperation({ summary: 'Agregar evidencia (URL) a una sesión' })
  addEvidence(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: AddSessionEvidenceDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addEvidence(sessionId, dto, user);
  }

  @Delete('evidences/:eId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una evidencia de sesión' })
  deleteEvidence(
    @Param('eId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.deleteEvidence(evidenceId, user);
  }
}
