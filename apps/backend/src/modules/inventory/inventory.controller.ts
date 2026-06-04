/**
 * inventory.controller.ts — Endpoints del módulo de inventario
 *
 * Estructura de endpoints:
 *
 * GET    /api/inventory/categories         → listar categorías
 * POST   /api/inventory/categories         → crear categoría
 * GET    /api/inventory/summary            → resumen/estadísticas
 * GET    /api/inventory/loans              → préstamos activos
 *
 * GET    /api/inventory/items              → listar ítems (con filtros)
 * POST   /api/inventory/items             → crear ítem del catálogo
 * GET    /api/inventory/items/:id          → detalle de un ítem
 * PATCH  /api/inventory/items/:id          → actualizar ítem
 * DELETE /api/inventory/items/:id          → soft-delete ítem
 *
 * GET    /api/inventory/items/:id/units    → unidades de un ítem
 * POST   /api/inventory/items/:id/units    → agregar unidad (con serial)
 * POST   /api/inventory/items/:id/units/bulk  → agregar N genéricas
 *
 * GET    /api/inventory/units/:id           → detalle de una unidad
 * PATCH  /api/inventory/units/:id           → actualizar unidad
 * GET    /api/inventory/units/:id/movements → historial de movimientos
 * POST   /api/inventory/units/:id/movements → registrar movimiento
 */
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryItemDto, UpdateInventoryItemDto,
  CreateInventoryUnitDto, CreateGenericUnitsDto,
  UpdateInventoryUnitDto, CreateMovementDto,
} from './dto/inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Inventario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Categorías ────────────────────────────────────────────
  @Get('categories')
  @ApiOperation({ summary: 'Listar categorías de inventario' })
  @ApiQuery({ name: 'nodoId', required: false })
  getCategories(@Query('nodoId') nodoId?: string) {
    return this.inventoryService.getCategories(nodoId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crear categoría' })
  createCategory(@Body() body: { name: string; description?: string; icon?: string; nodoId?: string }) {
    return this.inventoryService.createCategory(body);
  }

  // ── Resumen y préstamos ───────────────────────────────────
  @Get('summary')
  @ApiOperation({ summary: 'Estadísticas generales del inventario' })
  @ApiQuery({ name: 'nodoId', required: false })
  getSummary(@Query('nodoId') nodoId?: string) {
    return this.inventoryService.getSummary(nodoId);
  }

  @Get('loans')
  @ApiOperation({ summary: 'Préstamos activos (unidades en_prestamo)' })
  @ApiQuery({ name: 'nodoId', required: false })
  getActiveLoans(@Query('nodoId') nodoId?: string) {
    return this.inventoryService.getActiveLoans(nodoId);
  }

  // ── Ítems del catálogo ────────────────────────────────────
  @Get('items')
  @ApiOperation({ summary: 'Listar ítems del catálogo con conteo de unidades' })
  @ApiQuery({ name: 'nodoId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  getItems(
    @CurrentUser() user: User,
    @Query('nodoId') nodoId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.getItems({ nodoId, categoryId, search });
  }

  @Post('items')
  @ApiOperation({ summary: 'Crear ítem en el catálogo' })
  createItem(
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: User,
  ) {
    return this.inventoryService.createItem(dto, user.id);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Detalle de un ítem con sus unidades' })
  getItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getItemById(id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Actualizar ítem del catálogo' })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar ítem (soft-delete)' })
  deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.deleteItem(id);
  }

  // ── Unidades de un ítem ───────────────────────────────────
  @Get('items/:id/units')
  @ApiOperation({ summary: 'Listar unidades físicas de un ítem' })
  getUnits(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getUnitsByItem(id);
  }

  @Post('items/:id/units')
  @ApiOperation({ summary: 'Agregar una unidad física con serial' })
  addUnit(
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateInventoryUnitDto,
    @CurrentUser() user: User,
  ) {
    return this.inventoryService.addUnit(itemId, dto, user.id);
  }

  @Post('items/:id/units/bulk')
  @ApiOperation({ summary: 'Agregar N unidades genéricas en lote (sin serial)' })
  addGenericUnits(
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateGenericUnitsDto,
    @CurrentUser() user: User,
  ) {
    return this.inventoryService.addGenericUnits(itemId, dto, user.id);
  }

  // ── Unidades individuales ─────────────────────────────────
  @Get('units/:id')
  @ApiOperation({ summary: 'Detalle de una unidad física' })
  getUnit(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getUnitById(id);
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'Actualizar datos de una unidad' })
  updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryUnitDto,
  ) {
    return this.inventoryService.updateUnit(id, dto);
  }

  @Get('units/:id/movements')
  @ApiOperation({ summary: 'Historial de movimientos de una unidad' })
  getMovements(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getMovementsByUnit(id);
  }

  @Post('units/:id/movements')
  @ApiOperation({ summary: 'Registrar movimiento (salida, devolución, baja...)' })
  registerMovement(
    @Param('id', ParseUUIDPipe) unitId: string,
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: User,
  ) {
    return this.inventoryService.registerMovement(unitId, dto, user.id);
  }
}
