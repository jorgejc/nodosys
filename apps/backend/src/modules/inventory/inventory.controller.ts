import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe, UseGuards,
  HttpCode, HttpStatus, ForbiddenException,
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

// Roles con acceso de lectura al inventario
const INVENTORY_ALLOWED = ['admin', 'vicerrector_extension', 'enlace', 'monitor', 'auxiliar'];
// Roles con acceso de escritura (crear, editar, eliminar)
const INVENTORY_WRITE_ALLOWED = ['admin', 'vicerrector_extension', 'enlace'];

@ApiTags('Inventario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Lanza 403 para roles sin acceso de lectura
  private requireAccess(user: User): void {
    if (!INVENTORY_ALLOWED.includes(user.role)) {
      throw new ForbiddenException('No tienes acceso al módulo de inventario');
    }
  }

  // Lanza 403 para roles sin acceso de escritura (monitor/auxiliar solo pueden leer)
  private requireWriteAccess(user: User): void {
    if (!INVENTORY_WRITE_ALLOWED.includes(user.role)) {
      throw new ForbiddenException('No tienes permiso para modificar el inventario');
    }
  }

  // admin / vicerrector_extension: pueden filtrar por nodoId o ver todos.
  // Roles de nodo (enlace/monitor/auxiliar): forzados a su propio nodoId.
  // Devuelve:
  //   undefined → rol global, sin filtro (ve todos los nodos)
  //   string    → filtrar por ese nodo
  //   null      → rol de nodo SIN nodo asignado → SIN acceso (forzar vacío)
  //
  // SEGURIDAD: para roles de nodo con nodoId nulo NO se devuelve undefined,
  // porque eso significaría "sin filtro" y expondría el inventario de todos
  // los nodos. Se devuelve null y cada endpoint responde vacío.
  private effectiveNodo(user: User, requested?: string): string | null | undefined {
    if (user.role === 'admin' || user.role === 'vicerrector_extension') return requested;
    return user.nodoId ?? null;
  }

  // Resumen en cero para roles de nodo sin nodo asignado.
  private emptySummary() {
    return {
      total_units: 0, disponible: 0, en_prestamo: 0, en_reparacion: 0,
      excelente: 0, bueno: 0, regular: 0, malo: 0, dado_de_baja: 0,
      total_categories: 0, total_items: 0,
    };
  }

  // ── Categorías ────────────────────────────────────────────
  @Get('categories')
  @ApiOperation({ summary: 'Listar categorías de inventario' })
  @ApiQuery({ name: 'nodoId', required: false })
  getCategories(@CurrentUser() user: User, @Query('nodoId') nodoId?: string) {
    this.requireAccess(user);
    const nodo = this.effectiveNodo(user, nodoId);
    if (nodo === null) return []; // rol de nodo sin nodo asignado
    return this.inventoryService.getCategories(nodo);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crear categoría' })
  createCategory(
    @Body() body: { name: string; description?: string; icon?: string; nodoId?: string },
    @CurrentUser() user: User,
  ) {
    this.requireWriteAccess(user);
    // Enlace solo puede crear categorías en su propio nodo
    if (user.role === 'enlace') body.nodoId = user.nodoId ?? body.nodoId;
    return this.inventoryService.createCategory(body);
  }

  // ── Números de gabinete (autocomplete) ───────────────────
  @Get('cabinet-numbers')
  @ApiOperation({ summary: 'Lista de cabinet_number distintos en el nodo (para datalist)' })
  @ApiQuery({ name: 'nodoId', required: false })
  getCabinetNumbers(@CurrentUser() user: User, @Query('nodoId') nodoId?: string) {
    this.requireAccess(user);
    const nodo = this.effectiveNodo(user, nodoId);
    if (nodo === null) return []; // rol de nodo sin nodo asignado
    return this.inventoryService.getCabinetNumbers(nodo);
  }

  // ── Resumen y préstamos ───────────────────────────────────
  @Get('summary')
  @ApiOperation({ summary: 'Estadísticas generales del inventario' })
  @ApiQuery({ name: 'nodoId', required: false })
  getSummary(@CurrentUser() user: User, @Query('nodoId') nodoId?: string) {
    this.requireAccess(user);
    const nodo = this.effectiveNodo(user, nodoId);
    if (nodo === null) return this.emptySummary(); // rol de nodo sin nodo asignado
    return this.inventoryService.getSummary(nodo);
  }

  @Get('loans')
  @ApiOperation({ summary: 'Préstamos activos (unidades en_prestamo)' })
  @ApiQuery({ name: 'nodoId', required: false })
  getActiveLoans(@CurrentUser() user: User, @Query('nodoId') nodoId?: string) {
    this.requireAccess(user);
    const nodo = this.effectiveNodo(user, nodoId);
    if (nodo === null) return []; // rol de nodo sin nodo asignado
    return this.inventoryService.getActiveLoans(nodo);
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
    this.requireAccess(user);
    return this.inventoryService.getItems({ nodoId, categoryId, search }, user);
  }

  @Post('items')
  @ApiOperation({ summary: 'Crear ítem en el catálogo' })
  createItem(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: User) {
    this.requireWriteAccess(user);
    if (user.role === 'enlace') dto.nodoId = user.nodoId ?? dto.nodoId;
    return this.inventoryService.createItem(dto, user.id);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Detalle de un ítem con sus unidades' })
  getItem(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    this.requireAccess(user);
    return this.inventoryService.getItemById(id, user);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Actualizar ítem del catálogo' })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: User,
  ) {
    this.requireWriteAccess(user);
    return this.inventoryService.updateItem(id, dto, user);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar ítem (soft-delete)' })
  deleteItem(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    this.requireWriteAccess(user);
    return this.inventoryService.deleteItem(id, user);
  }

  // ── Unidades de un ítem ───────────────────────────────────
  @Get('items/:id/units')
  @ApiOperation({ summary: 'Listar unidades físicas de un ítem' })
  getUnits(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    this.requireAccess(user);
    return this.inventoryService.getUnitsByItem(id, user);
  }

  @Post('items/:id/units')
  @ApiOperation({ summary: 'Agregar una unidad física con serial' })
  addUnit(
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateInventoryUnitDto,
    @CurrentUser() user: User,
  ) {
    this.requireWriteAccess(user);
    return this.inventoryService.addUnit(itemId, dto, user.id, user);
  }

  @Post('items/:id/units/bulk')
  @ApiOperation({ summary: 'Agregar N unidades genéricas en lote (sin serial)' })
  addGenericUnits(
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateGenericUnitsDto,
    @CurrentUser() user: User,
  ) {
    this.requireWriteAccess(user);
    return this.inventoryService.addGenericUnits(itemId, dto, user.id, user);
  }

  // ── Unidades individuales ─────────────────────────────────
  @Get('units/:id')
  @ApiOperation({ summary: 'Detalle de una unidad física' })
  getUnit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    this.requireAccess(user);
    return this.inventoryService.getUnitById(id, user);
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'Actualizar datos de una unidad' })
  updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryUnitDto,
    @CurrentUser() user: User,
  ) {
    this.requireWriteAccess(user);
    return this.inventoryService.updateUnit(id, dto, user);
  }

  @Get('units/:id/movements')
  @ApiOperation({ summary: 'Historial de movimientos de una unidad' })
  getMovements(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    this.requireAccess(user);
    return this.inventoryService.getMovementsByUnit(id, user);
  }

  @Post('units/:id/movements')
  @ApiOperation({ summary: 'Registrar movimiento (salida, devolución, baja...)' })
  registerMovement(
    @Param('id', ParseUUIDPipe) unitId: string,
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: User,
  ) {
    this.requireWriteAccess(user);
    return this.inventoryService.registerMovement(unitId, dto, user.id, user);
  }
}
