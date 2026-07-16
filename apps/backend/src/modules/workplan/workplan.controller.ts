// workplan.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseUUIDPipe, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkPlanService } from './workplan.service';
import {
  CreateWorkPlanDto, UpdateWorkPlanDto,
  UpdateAxisDto, CreateActivityDto, UpdateActivityDto,
} from './dto/workplan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Plan de Trabajo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workplan')
export class WorkPlanController {
  constructor(private readonly svc: WorkPlanService) {}

  // ── Planes ────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Mis planes de trabajo (o todos si es admin/decano)' })
  findAll(@CurrentUser() user: User) {
    return this.svc.findAll(user);
    
  }

  @Post()
  @ApiOperation({ summary: 'Crear plan de trabajo' })
  create(@Body() dto: CreateWorkPlanDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Get('my-tasks')
  @ApiOperation({ summary: 'Tareas del plan propio (para selector de procesos)' })
  findMyTasks(@CurrentUser() user: User) {
    return this.svc.findMyTasks(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del plan con ejes y actividades' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar plan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkPlanDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Resumen de horas del plan' })
  getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPlanSummary(id);
  }

  @Get(':id/axes-summary')
  @ApiOperation({ summary: 'Resumen de horas por eje misional' })
  getAxesSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getAxisSummaries(id);
  }

  @Get(':id/linked-processes')
  @ApiOperation({ summary: 'Mapa taskId → procesos vinculados (para mostrar bitácora desde el plan)' })
  getLinkedProcesses(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.findLinkedProcessesByPlan(id, user);
  }

  // ── Ejes ─────────────────────────────────────────────────
  @Patch(':planId/axes/:axisId')
  @ApiOperation({ summary: 'Actualizar horas de un eje misional' })
  updateAxis(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('axisId', ParseUUIDPipe) axisId: string,
    @Body() dto: UpdateAxisDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateAxis(planId, axisId, dto, user);
  }

  @Get('axes/:axisId')
  @ApiOperation({ summary: 'Actividades de un eje' })
  getAxis(@Param('axisId', ParseUUIDPipe) axisId: string) {
    return this.svc.getAxisWithActivities(axisId);
  }

  // ── Actividades ───────────────────────────────────────────
  @Post('axes/:axisId/activities')
  @ApiOperation({ summary: 'Agregar actividad a un eje' })
  createActivity(
    @Param('axisId', ParseUUIDPipe) axisId: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.createActivity(axisId, dto, user);
  }

  @Get('activities/:id')
  @ApiOperation({ summary: 'Detalle de una actividad' })
  getActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getActivity(id);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Actualizar actividad (hoja 1 y hoja 2)' })
  updateActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateActivity(id, dto, user);
  }

  @Delete('activities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar actividad' })
  deleteActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.deleteActivity(id, user);
  }
}
