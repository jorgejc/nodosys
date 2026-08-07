// reports.controller.ts
import {
  Controller, Get, Param, Query, Res,
  ParseUUIDPipe, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CertificateQueryDto } from '../monitors/dto/monitors.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  private readonly GLOBAL_ROLES = [
    'admin', 'vicerrector_extension', 'vicerrector_academico',
    'equipo_extension', 'decano', 'coordinador',
  ];

  // Devuelve { nodoId, nodoLabel } para los reportes de inventario
  private resolveInventoryNodo(
    user: User,
    requested?: string,
  ): { nodoId?: string; nodoLabel: string } {
    const isGlobal = this.GLOBAL_ROLES.includes(user.role);
    const nodoId   = isGlobal ? requested : (user.nodoId ?? undefined);
    const nodoLabel = user.nodoName
      ? `NODO ${user.nodoName.toUpperCase()}`
      : nodoId ? `NODO ${nodoId.slice(0, 8).toUpperCase()}` : 'TODOS LOS NODOS';
    return { nodoId, nodoLabel };
  }

  // ── Inventario ────────────────────────────────────────────
  @Get('inventory/excel')
  @ApiOperation({ summary: 'Descargar inventario en Excel (.xlsx)' })
  @ApiQuery({ name: 'nodoId', required: false })
  async inventoryExcel(
    @Res() res: Response,
    @CurrentUser() user: User,
    @Query('nodoId') nodoId?: string,
  ) {
    const { nodoId: effectiveNodoId, nodoLabel } = this.resolveInventoryNodo(user, nodoId);
    const buffer = await this.svc.generateInventoryExcel(effectiveNodoId, nodoLabel);
    const filename = `inventario-nodo-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('inventory/pdf')
  @ApiOperation({ summary: 'Descargar inventario en PDF' })
  @ApiQuery({ name: 'nodoId', required: false })
  async inventoryPdf(
    @Res() res: Response,
    @CurrentUser() user: User,
    @Query('nodoId') nodoId?: string,
  ) {
    const { nodoId: effectiveNodoId, nodoLabel } = this.resolveInventoryNodo(user, nodoId);
    const buffer = await this.svc.generateInventoryPdf(effectiveNodoId, nodoLabel);
    const filename = `inventario-nodo-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ── Actividades ───────────────────────────────────────────
  private readonly ACTIVITY_REPORT_ROLES: UserRole[] = [
    UserRole.ADMIN, UserRole.VICERRECTOR_EXTENSION,
    UserRole.ENLACE, UserRole.DOCENTE,
  ];

  @Get('activities/excel')
  @ApiOperation({ summary: 'Reporte de actividades en Excel' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo',   required: false })
  @ApiQuery({ name: 'status',   required: false })
  @ApiQuery({ name: 'userId',   required: false })
  @ApiQuery({ name: 'nodoId',   required: false })
  async activitiesExcel(
    @Res() res: Response,
    @CurrentUser() user: User,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?: string,
    @Query('status')   status?: string,
    @Query('userId')   userId?: string,
    @Query('nodoId')   nodoId?: string,
  ) {
    if (!this.ACTIVITY_REPORT_ROLES.includes(user.role))
      throw new ForbiddenException('Sin permiso para este reporte');
    const buffer = await this.svc.generateActivitiesExcel(user, { dateFrom, dateTo, status, userId, nodoId });
    const filename = `actividades-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('activities/pdf')
  @ApiOperation({ summary: 'Reporte de actividades en PDF' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo',   required: false })
  @ApiQuery({ name: 'status',   required: false })
  @ApiQuery({ name: 'userId',   required: false })
  @ApiQuery({ name: 'nodoId',   required: false })
  async activitiesPdf(
    @Res() res: Response,
    @CurrentUser() user: User,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?: string,
    @Query('status')   status?: string,
    @Query('userId')   userId?: string,
    @Query('nodoId')   nodoId?: string,
  ) {
    if (!this.ACTIVITY_REPORT_ROLES.includes(user.role))
      throw new ForbiddenException('Sin permiso para este reporte');
    const buffer = await this.svc.generateActivitiesPdf(user, { dateFrom, dateTo, status, userId, nodoId });
    const filename = `actividades-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ── Usuarios ──────────────────────────────────────────────
  @Get('users/excel')
  @ApiOperation({ summary: 'Reporte de usuarios en Excel (solo admin)' })
  @ApiQuery({ name: 'role',      required: false })
  @ApiQuery({ name: 'nodoId',    required: false })
  @ApiQuery({ name: 'facultyId', required: false })
  async usersExcel(
    @Res() res: Response,
    @CurrentUser() user: User,
    @Query('role')      role?: string,
    @Query('nodoId')    nodoId?: string,
    @Query('facultyId') facultyId?: string,
  ) {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Solo el administrador puede acceder a este reporte');
    const buffer = await this.svc.generateUsersExcel({ role, nodoId, facultyId });
    const filename = `usuarios-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('users/pdf')
  @ApiOperation({ summary: 'Reporte de usuarios en PDF (solo admin)' })
  @ApiQuery({ name: 'role',      required: false })
  @ApiQuery({ name: 'nodoId',    required: false })
  @ApiQuery({ name: 'facultyId', required: false })
  async usersPdf(
    @Res() res: Response,
    @CurrentUser() user: User,
    @Query('role')      role?: string,
    @Query('nodoId')    nodoId?: string,
    @Query('facultyId') facultyId?: string,
  ) {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Solo el administrador puede acceder a este reporte');
    const buffer = await this.svc.generateUsersPdf({ role, nodoId, facultyId });
    const filename = `usuarios-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ── Plan de trabajo ───────────────────────────────────────
  @Get('workplan/:id/excel')
  @ApiOperation({ summary: 'Descargar plan de trabajo en Excel' })
  async workPlanExcel(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const buffer = await this.svc.generateWorkPlanExcel(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="plan-trabajo-${id.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  }

  @Get('workplan/:id/pdf')
  @ApiOperation({ summary: 'Descargar plan de trabajo en PDF (formato DO-F-002)' })
  async workPlanPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const buffer = await this.svc.generateWorkPlanPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="plan-trabajo-${id.slice(0, 8)}.pdf"`);
    res.send(buffer);
  }

  // ── Monitorías ────────────────────────────────────────────
  // El control de acceso (rol permitido + aislamiento por nodo) lo aplica
  // MonitorsService dentro del servicio, antes de generar el documento.

  @Get('monitors/:planId/excel')
  @ApiOperation({ summary: 'Plan de trabajo de la monitora en Excel' })
  async monitorPlanExcel(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.generateMonitorPlanExcel(planId, user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="plan-monitoria-${planId.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  }

  @Get('monitors/:planId/certificado/pdf')
  @ApiOperation({ summary: 'Certificado de horas ejecutadas en PDF (rango de semanas)' })
  async monitorCertificatePdf(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Query() query: CertificateQueryDto,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.generateMonitorCertificatePdf(
      planId,
      { from: query.from, to: query.to, observaciones: query.observaciones },
      user,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificado-horas-${planId.slice(0, 8)}.pdf"`,
    );
    res.send(buffer);
  }
}
