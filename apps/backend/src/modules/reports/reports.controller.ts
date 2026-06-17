// reports.controller.ts
import {
  Controller, Get, Param, Query, Res,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

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
}
