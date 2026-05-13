// reports.controller.ts
import {
  Controller, Get, Param, Query, Res,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  // ── Inventario ────────────────────────────────────────────
  @Get('inventory/excel')
  @ApiOperation({ summary: 'Descargar inventario en Excel (.xlsx)' })
  @ApiQuery({ name: 'nodoId', required: false })
  async inventoryExcel(@Res() res: Response, @Query('nodoId') nodoId?: string) {
    const buffer = await this.svc.generateInventoryExcel(nodoId);
    const filename = `inventario-nodo-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('inventory/pdf')
  @ApiOperation({ summary: 'Descargar inventario en PDF' })
  @ApiQuery({ name: 'nodoId', required: false })
  async inventoryPdf(@Res() res: Response, @Query('nodoId') nodoId?: string) {
    const buffer = await this.svc.generateInventoryPdf(nodoId);
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
