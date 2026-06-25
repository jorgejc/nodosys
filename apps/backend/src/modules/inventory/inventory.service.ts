/**
 * inventory.service.ts — Lógica de negocio del inventario
 *
 * Maneja:
 *  - CRUD de ítems del catálogo
 *  - CRUD de unidades físicas (con serial, estado, ubicación)
 *  - Registro de movimientos (salida, devolución, baja, cambio estado)
 *  - Consultas de resumen (cuántos hay, en qué estado, dónde están)
 */
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InventoryCategory } from './entities/inventory-category.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryUnit, UnitCondition, UnitStatus } from './entities/inventory-unit.entity';
import { InventoryMovement, MovementType } from './entities/inventory-movement.entity';
import {
  CreateInventoryItemDto, UpdateInventoryItemDto,
  CreateInventoryUnitDto, CreateGenericUnitsDto,
  UpdateInventoryUnitDto, CreateMovementDto,
} from './dto/inventory.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryCategory)
    private readonly categoryRepo: Repository<InventoryCategory>,

    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,

    @InjectRepository(InventoryUnit)
    private readonly unitRepo: Repository<InventoryUnit>,

    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
  ) {}

  // ══════════════════════════════════════════════════════════
  // CATEGORÍAS
  // ══════════════════════════════════════════════════════════

  private readonly DEFAULT_CATEGORIES = [
    { name: 'Equipos de cómputo',      icon: '💻', description: 'Computadores, tablets, periféricos y accesorios' },
    { name: 'Mobiliario',              icon: '🪑', description: 'Mesas, sillas, estantes y enseres' },
    { name: 'Material didáctico',      icon: '📚', description: 'Libros, guías, kits pedagógicos y manipulativos' },
    { name: 'Equipos audiovisuales',   icon: '📽️', description: 'Proyectores, pantallas, micrófonos y altavoces' },
    { name: 'Papelería y consumibles', icon: '📝', description: 'Resmas, marcadores, tóner y suministros de oficina' },
    { name: 'Otros',                   icon: '📦', description: 'Elementos varios no clasificados' },
  ];

  async getCategories(nodoId?: string): Promise<InventoryCategory[]> {
    const where = nodoId ? { nodoId } : {};
    const cats = await this.categoryRepo.find({ where, order: { name: 'ASC' } });

    // Primera vez que este nodo accede: crear categorías base automáticamente
    if (cats.length === 0 && nodoId) {
      const defaults = this.categoryRepo.create(
        this.DEFAULT_CATEGORIES.map(c => ({ ...c, nodoId })),
      );
      return this.categoryRepo.save(defaults);
    }

    return cats;
  }

  async createCategory(data: {
    name: string; description?: string; icon?: string; nodoId?: string;
  }): Promise<InventoryCategory> {
    const category = this.categoryRepo.create(data);
    return this.categoryRepo.save(category);
  }

  // ══════════════════════════════════════════════════════════
  // ÍTEMS DEL CATÁLOGO
  // ══════════════════════════════════════════════════════════

  async getItems(
  filters: { nodoId?: string; categoryId?: string; search?: string },
  user?: User,
): Promise<InventoryItem[]> {
  // ── Filtro por nodo según rol ──────────────────────────
  const globalRoles = [
    'admin', 'vicerrector_extension', 'vicerrector_academico',
    'equipo_extension', 'decano', 'coordinador',
  ];
  if (user && !globalRoles.includes(user.role)) {
    if (user.nodoId) {
      // Enlace/docente/monitor/auxiliar — solo ve su nodo
      filters.nodoId = user.nodoId;
    } else {
      // Sin nodo asignado — no ve ningún inventario
      return [];
    }
  }
  // globalRoles sin filtro → ven todos los nodos

  // ── Query ──────────────────────────────────────────────
  const qb = this.itemRepo
    .createQueryBuilder('item')
    .leftJoinAndSelect('item.category', 'category')
    .leftJoin('item.units', 'units')
    .addSelect('COUNT(units.id)', 'totalUnits')
    .addSelect(
      `COUNT(CASE WHEN units.status = 'disponible' THEN 1 END)`,
      'availableUnits',
    )
    .addSelect(
      `COUNT(CASE WHEN units.condition = 'malo' OR units.condition = 'dado_de_baja' THEN 1 END)`,
      'damagedUnits',
    )
    .where('item.deleted_at IS NULL')
    .groupBy('item.id, category.id')
    .orderBy('category.name', 'ASC')
    .addOrderBy('item.name', 'ASC');

  if (filters.nodoId) {
    qb.andWhere('item.nodo_id = :nodoId', { nodoId: filters.nodoId });
  }
  if (filters.categoryId) {
    qb.andWhere('item.category_id = :categoryId', { categoryId: filters.categoryId });
  }
  if (filters.search) {
    qb.andWhere(
      '(LOWER(item.name) LIKE :search OR LOWER(item.brand) LIKE :search OR LOWER(item.model) LIKE :search)',
      { search: `%${filters.search.toLowerCase()}%` },
    );
  }

  const raw = await qb.getRawAndEntities();

  return raw.entities.map((item, i) => {
    const r = raw.raw[i];
    return Object.assign(item, {
      totalUnits:     parseInt(r.totalUnits    ?? '0'),
      availableUnits: parseInt(r.availableUnits ?? '0'),
      damagedUnits:   parseInt(r.damagedUnits   ?? '0'),
    });
  });
}

  async getItemById(id: string): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['category', 'units'],
      order: { units: { createdAt: 'ASC' } } as never,
    });
    if (!item) throw new NotFoundException(`Ítem ${id} no encontrado`);
    return item;
  }

  async createItem(
    dto: CreateInventoryItemDto,
    userId: string,
  ): Promise<InventoryItem> {
    // Verificar que la categoría exista
    const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
    if (!category) {
      throw new BadRequestException(`Categoría ${dto.categoryId} no existe`);
    }

    const item = this.itemRepo.create({
      name: dto.name,
      categoryId: dto.categoryId,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      description: dto.description ?? null,
      trackByUnit: dto.trackByUnit ?? true,
      nodoId: dto.nodoId ?? null,
      registeredBy: userId,
    });

    return this.itemRepo.save(item);
  }

  async updateItem(id: string, dto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const item = await this.getItemById(id);
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.getItemById(id);

    // Verificar que no tenga unidades activas
    const activeUnits = await this.unitRepo.count({
      where: { itemId: id, status: UnitStatus.DISPONIBLE },
    });
    if (activeUnits > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el ítem tiene ${activeUnits} unidades disponibles. Da de baja las unidades primero.`,
      );
    }

    // Soft delete: marcar como eliminado sin borrar de la BD
    item.deletedAt = new Date();
    await this.itemRepo.save(item);
  }

  // ══════════════════════════════════════════════════════════
  // UNIDADES FÍSICAS
  // ══════════════════════════════════════════════════════════

  async getUnitsByItem(itemId: string): Promise<InventoryUnit[]> {
    await this.getItemById(itemId); // Verifica que el ítem exista
    return this.unitRepo.find({
      where: { itemId },
      order: { createdAt: 'ASC' },
    });
  }

  async getUnitById(id: string): Promise<InventoryUnit> {
    const unit = await this.unitRepo.findOne({
      where: { id },
      relations: ['item', 'item.category'],
    });
    if (!unit) throw new NotFoundException(`Unidad ${id} no encontrada`);
    return unit;
  }

  // Agregar una unidad con serial (equipos electrónicos)
  async addUnit(
    itemId: string,
    dto: CreateInventoryUnitDto,
    userId: string,
  ): Promise<InventoryUnit> {
    await this.getItemById(itemId);

    // Si tiene serial, verificar que no esté duplicado
    if (dto.serialNumber) {
      const existing = await this.unitRepo.findOne({
        where: { serialNumber: dto.serialNumber },
      });
      if (existing) {
        throw new BadRequestException(
          `Ya existe una unidad con el serial ${dto.serialNumber}`,
        );
      }
    }

    const unit = this.unitRepo.create({
      itemId,
      serialNumber: dto.serialNumber ?? null,
      internalCode: dto.internalCode ?? null,
      condition: dto.condition ?? UnitCondition.BUENO,
      location: dto.location ?? 'Nodo',
      acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
      acquisitionValue: dto.acquisitionValue ?? null,
      notes: dto.notes ?? null,
      registeredBy: userId,
    });

    const saved = await this.unitRepo.save(unit);

    // Registrar movimiento de entrada automáticamente
    await this.movementRepo.save(
      this.movementRepo.create({
        unitId: saved.id,
        registeredBy: userId,
        movementType: MovementType.ENTRADA,
        movementDate: dto.acquisitionDate
          ? new Date(dto.acquisitionDate)
          : new Date(),
        notes: 'Ingreso inicial al inventario',
      }),
    );

    return saved;
  }

  // Agregar N unidades genéricas de una vez (sillas, mesas...)
  async addGenericUnits(
    itemId: string,
    dto: CreateGenericUnitsDto,
    userId: string,
  ): Promise<InventoryUnit[]> {
    await this.getItemById(itemId);

    const units: InventoryUnit[] = [];
    for (let i = 0; i < dto.quantity; i++) {
      const unit = this.unitRepo.create({
        itemId,
        serialNumber: null, // Sin serial
        condition: dto.condition ?? UnitCondition.BUENO,
        location: dto.location ?? 'Nodo',
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
        acquisitionValue: dto.acquisitionValue ?? null,
        registeredBy: userId,
      });
      units.push(unit);
    }

    const saved = await this.unitRepo.save(units);

    // Registrar movimiento de entrada para cada unidad
    const movements = saved.map((u) =>
      this.movementRepo.create({
        unitId: u.id,
        registeredBy: userId,
        movementType: MovementType.ENTRADA,
        movementDate: dto.acquisitionDate
          ? new Date(dto.acquisitionDate)
          : new Date(),
        notes: `Ingreso inicial en lote de ${dto.quantity} unidades`,
      }),
    );
    await this.movementRepo.save(movements);

    return saved;
  }

  async updateUnit(id: string, dto: UpdateInventoryUnitDto): Promise<InventoryUnit> {
    const unit = await this.getUnitById(id);
    Object.assign(unit, dto);
    return this.unitRepo.save(unit);
  }

  // ══════════════════════════════════════════════════════════
  // MOVIMIENTOS
  // ══════════════════════════════════════════════════════════

  async registerMovement(
    unitId: string,
    dto: CreateMovementDto,
    userId: string,
  ): Promise<InventoryMovement> {
    const unit = await this.getUnitById(unitId);

    // Validaciones según el tipo de movimiento
    if (dto.movementType === MovementType.SALIDA && !dto.destination) {
      throw new BadRequestException('Para registrar una salida debes indicar el destino');
    }

    if (dto.movementType === MovementType.DEVOLUCION && unit.status !== UnitStatus.EN_PRESTAMO) {
      throw new BadRequestException('Esta unidad no está registrada como "en préstamo"');
    }

    // Actualizar estado de la unidad según el movimiento
    switch (dto.movementType) {
      case MovementType.SALIDA:
        unit.status = UnitStatus.EN_PRESTAMO;
        break;
      case MovementType.DEVOLUCION:
        unit.status = UnitStatus.DISPONIBLE;
        break;
      case MovementType.BAJA:
        unit.status = UnitStatus.DADO_DE_BAJA;
        unit.condition = UnitCondition.DADO_DE_BAJA;
        break;
      case MovementType.CAMBIO_ESTADO:
        if (dto.newCondition) {
          unit.condition = dto.newCondition as UnitCondition;
        }
        break;
      case MovementType.CAMBIO_UBICACION:
        if (dto.newLocation) {
          unit.location = dto.newLocation;
        }
        break;
    }

    await this.unitRepo.save(unit);

    const movement = this.movementRepo.create({
      unitId,
      registeredBy: userId,
      movementType: dto.movementType,
      movementDate: new Date(dto.movementDate),
      destination: dto.destination ?? null,
      responsible: dto.responsible ?? null,
      responsibleId: dto.responsibleId ?? null,
      expectedReturnDate: dto.expectedReturnDate
        ? new Date(dto.expectedReturnDate)
        : null,
      previousCondition: dto.previousCondition ?? null,
      newCondition: dto.newCondition ?? null,
      previousLocation: dto.previousLocation ?? null,
      newLocation: dto.newLocation ?? null,
      notes: dto.notes ?? null,
    });

    return this.movementRepo.save(movement);
  }

  async getMovementsByUnit(unitId: string): Promise<InventoryMovement[]> {
    return this.movementRepo.find({
      where: { unitId },
      order: { movementDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async getActiveLoans(nodoId?: string): Promise<InventoryUnit[]> {
    const qb = this.unitRepo
      .createQueryBuilder('unit')
      .leftJoinAndSelect('unit.item', 'item')
      .leftJoinAndSelect('item.category', 'category')
      .leftJoinAndSelect('unit.movements', 'movement',
        "movement.movement_type = 'salida'")
      .where("unit.status = 'en_prestamo'")
      .orderBy('unit.updated_at', 'DESC');

    if (nodoId) {
      qb.andWhere('item.nodo_id = :nodoId', { nodoId });
    }

    return qb.getMany();
  }

  // ══════════════════════════════════════════════════════════
  // RESUMEN / ESTADÍSTICAS
  // ══════════════════════════════════════════════════════════
  async getSummary(nodoId?: string): Promise<object> {
    const where = nodoId ? 'WHERE i.nodo_id = $1' : '';

    const result = await this.unitRepo.query(
      `
      SELECT
        COUNT(u.id)                                               AS total_units,
        COUNT(CASE WHEN u.status = 'disponible' THEN 1 END)      AS disponible,
        COUNT(CASE WHEN u.status = 'en_prestamo' THEN 1 END)     AS en_prestamo,
        COUNT(CASE WHEN u.status = 'en_reparacion' THEN 1 END)   AS en_reparacion,
        COUNT(CASE WHEN u.condition = 'excelente' THEN 1 END)    AS excelente,
        COUNT(CASE WHEN u.condition = 'bueno' THEN 1 END)        AS bueno,
        COUNT(CASE WHEN u.condition = 'regular' THEN 1 END)      AS regular,
        COUNT(CASE WHEN u.condition = 'malo' THEN 1 END)         AS malo,
        COUNT(CASE WHEN u.condition = 'dado_de_baja' THEN 1 END) AS dado_de_baja,
        COUNT(DISTINCT i.category_id)                            AS total_categories,
        COUNT(DISTINCT i.id)                                     AS total_items
      FROM inventory_units u
      JOIN inventory_items i ON i.id = u.item_id
      ${where}
      `,
      nodoId ? [nodoId] : [],
    );

    return result[0];
  }
}
