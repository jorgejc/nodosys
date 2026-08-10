/**
 * auxiliary.controller.ts — Endpoints del registro de actividades del nodo
 *
 * La fecha se escribe una vez al abrir el DÍA; las actividades cuelgan de
 * él y ya no la repiten.
 *
 * Todos exigen JWT. La autorización fina (rol + nodo) vive en
 * AuxiliaryService, que es quien conoce el dueño de cada registro; aquí
 * solo se cablean las rutas.
 */
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuxiliaryService } from './auxiliary.service';
import {
  CreateDayDto, CreateActivityDto, UpdateActivityDto,
  CreateAuxEvidenceDto, DaysQueryDto,
} from './dto/auxiliary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Registro de actividades del nodo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auxiliary')
export class AuxiliaryController {
  constructor(private readonly svc: AuxiliaryService) {}

  // ── Catálogos ─────────────────────────────────────────────
  @Get('functions')
  @ApiOperation({ summary: 'Funciones oficiales del auxiliar (catálogo)' })
  listFunctions(@CurrentUser() user: User) {
    return this.svc.listFunctions(user);
  }

  @Get('participation-types')
  @ApiOperation({ summary: 'Tipos de participación (catálogo)' })
  listParticipationTypes(@CurrentUser() user: User) {
    return this.svc.listParticipationTypes(user);
  }

  @Get('linkable')
  @ApiOperation({ summary: 'Actividades y procesos de MI nodo a los que enganchar' })
  listLinkable(@CurrentUser() user: User) {
    return this.svc.listLinkableOrigins(user);
  }

  // ── Vista del enlace ──────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Auxiliares de mi nodo (enlace) o todos (admin)' })
  listAuxiliaries(@CurrentUser() user: User) {
    return this.svc.listAuxiliaries(user);
  }

  // ── Días con sus actividades ──────────────────────────────
  @Get('me/days')
  @ApiOperation({ summary: 'Mis días: actividades, filtro y paginación' })
  findMyDays(@Query() query: DaysQueryDto, @CurrentUser() user: User) {
    return this.svc.findDays(user.id, query, user);
  }

  @Get(':auxiliaryId/days')
  @ApiOperation({ summary: 'Días de un auxiliar (enlace de su nodo o admin)' })
  findAuxiliaryDays(
    @Param('auxiliaryId', ParseUUIDPipe) auxiliaryId: string,
    @Query() query: DaysQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.findDays(auxiliaryId, query, user);
  }

  @Post('days')
  @ApiOperation({ summary: 'Abrir el bloque de un día (si ya existe, lo devuelve)' })
  createDay(@Body() dto: CreateDayDto, @CurrentUser() user: User) {
    return this.svc.createDay(dto, user);
  }

  @Delete('days/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un día (bloqueado si tiene actividades)' })
  deleteDay(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteDay(id, user);
  }

  // ── Actividades del día ───────────────────────────────────
  @Post('days/:dayId/activities')
  @ApiOperation({ summary: 'Agregar una actividad al día (sin reescribir la fecha)' })
  addActivity(
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.addActivity(dayId, dto, user);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Editar una actividad' })
  updateActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateActivity(id, dto, user);
  }

  @Delete('activities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una actividad' })
  deleteActivity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteActivity(id, user);
  }

  // ── Evidencias ────────────────────────────────────────────
  @Post('evidences')
  @ApiOperation({ summary: 'Adjuntar evidencia (enlace de Drive) a una actividad' })
  addEvidence(@Body() dto: CreateAuxEvidenceDto, @CurrentUser() user: User) {
    return this.svc.addEvidence(dto, user);
  }

  @Delete('evidences/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar evidencia' })
  deleteEvidence(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteEvidence(id, user);
  }
}
