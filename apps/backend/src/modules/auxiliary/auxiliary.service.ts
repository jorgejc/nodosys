/**
 * auxiliary.service.ts — Módulo "Equipo de Nodo" · Registro de actividades
 *
 * MODELO: un DÍA es un contenedor único por fecha y dentro cuelgan las
 * ACTIVIDADES. No hay "registro diario" separado de "participaciones":
 * todo es actividad del día. Una actividad enganchada a una actividad o
 * proceso del enlace es solo una que además tiene `activityId`/`processId`.
 *
 * El trabajo pertenece al NODO DONDE SE HIZO. `nodoId` se copia del perfil
 * del auxiliar al crear el día —nunca llega del body— y a partir de ahí es
 * un hecho histórico que no se reescribe jamás: si la persona pasa del nodo
 * A al B, lo registrado en A sigue diciendo A.
 *
 * De ahí salen las tres reglas, que el código aplica en capas distintas y
 * conviene no confundir:
 *
 *   ESCRITURA (`assertCanWrite`)
 *     Solo el auxiliar, y solo sobre lo suyo. Ni el enlace ni el admin: los
 *     endpoints toman auxiliaryId y nodoId del usuario autenticado, así que
 *     cualquier otro generaría filas a su propio nombre.
 *
 *   PUERTA DE LECTURA (`assertCanReadAuxiliary`)
 *     auxiliar → solo él mismo
 *     enlace   → si el auxiliar es de su nodo AHORA, o si dejó días
 *                registrados en él alguna vez (`hasRowsInNodo`). Un
 *                traslado no le quita al enlace anterior el histórico del
 *                que responde.
 *     admin    → cualquiera
 *
 *   FILAS QUE DEVUELVE (`nodoRowFilter`)
 *     enlace   → solo los días de SU nodo, aunque la persona ya esté en otro
 *     auxiliar → todos los suyos, de todos los nodos por los que pasó
 *     admin    → todos
 *
 * Consecuencia buscada: un mes a caballo entre dos nodos se ve partido —
 * cada enlace ve su parte, el auxiliar la ve entera— y el reporte firmado
 * nombra los nodos de los DÍAS, no el del perfil (ver `buildNodoLabel`).
 *
 * Sin nodo no se registra nada: serían filas huérfanas que ningún enlace
 * podría consultar ni reportar.
 *
 * El módulo registra hechos —fecha, funciones, descripción, evidencia— y no
 * clasifica ni califica el desempeño de nadie.
 */
import {
  Injectable, NotFoundException, Logger, OnModuleInit,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, Between, ILike, DataSource, EntityManager } from 'typeorm';
import { AuxiliaryFunction } from './entities/auxiliary-function.entity';
import { ParticipationType } from './entities/participation-type.entity';
import { AuxiliaryDay } from './entities/auxiliary-day.entity';
import { AuxiliaryActivity } from './entities/auxiliary-activity.entity';
import { AuxiliaryEvidence } from './entities/auxiliary-evidence.entity';
import { ActivityRequest } from '../activities/entities/activity-request.entity';
import { Process } from '../processes/entities/process.entity';
import { Nodo } from '../nodos/entities/nodo.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  CreateDayDto, CreateActivityDto, UpdateActivityDto,
  CreateAuxEvidenceDto, DaysQueryDto,
} from './dto/auxiliary.dto';

/** Un día tiene 24 horas: el registro no puede decir lo contrario. */
export const MAX_DAILY_HOURS = 24;

/** Días por página cuando el cliente no pide otra cosa. */
const DEFAULT_PAGE_SIZE = 10;

/** Totales objetivos del período. Cuentan hechos, no valoran nada. */
export interface MonthSummary {
  year: number;
  month: number;
  daysWithLog: number;
  activityCount: number;
  evidenceCount: number;
  totalHours: number | null;   // null si nadie registró horas
}

/**
 * Catálogo oficial de la Vicerrectoría de Extensión. Vive también en
 * `migration-auxiliar.sql` para producción; aquí sirve para sembrarlo en
 * los entornos que crean el esquema con `synchronize: true` (desarrollo y
 * pruebas), donde ese SQL no se ejecuta y el desplegable quedaría vacío.
 */
const SEED_FUNCTIONS: string[] = [
  'Atención y acompañamiento',
  'Gestión administrativa y documental',
  'Herramientas ofimáticas y documentales',
  'Planeación, organización y ejecución logística de actividades',
  'Acompañamiento de procesos formativos',
  'Realización de procesos de convocatorias',
  'Relacionamiento y articulación con instituciones',
  'Funcionamiento operativo de los espacios del nodo',
  'Recolección de información de actividades',
  'Desempeñar actividades que le sean asignadas',
];

const SEED_PARTICIPATION_TYPES: string[] = [
  'Registro de asistencia / firmas de participantes',
  'Apoyo logístico (montaje, convocatoria, espacio)',
  'Apoyo pedagógico (acompañamiento al docente en la temática)',
  'Creación de contenido o material',
  'Registro fotográfico / evidencias',
  'Relacionamiento institucional',
  'Gestión documental o administrativa',
  'Otro',
];

@Injectable()
export class AuxiliaryService implements OnModuleInit {
  private readonly log = new Logger(AuxiliaryService.name);

  constructor(
    @InjectRepository(AuxiliaryFunction)
    private readonly functionRepo: Repository<AuxiliaryFunction>,

    @InjectRepository(ParticipationType)
    private readonly typeRepo: Repository<ParticipationType>,

    @InjectRepository(AuxiliaryDay)
    private readonly dayRepo: Repository<AuxiliaryDay>,

    @InjectRepository(AuxiliaryActivity)
    private readonly actRepo: Repository<AuxiliaryActivity>,

    @InjectRepository(AuxiliaryEvidence)
    private readonly evidenceRepo: Repository<AuxiliaryEvidence>,

    @InjectRepository(ActivityRequest)
    private readonly activityRepo: Repository<ActivityRequest>,

    @InjectRepository(Process)
    private readonly processRepo: Repository<Process>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    // Solo lectura. Los días guardan nodo_id, y el nombre del nodo
    // ANTERIOR no se puede sacar de users.nodoName (que es el actual):
    // hay que resolverlo contra el catálogo de nodos.
    @InjectRepository(Nodo)
    private readonly nodoRepo: Repository<Nodo>,

    // Necesario para serializar el tope de 24 h: la suma de horas del día
    // y la escritura tienen que ir en la misma transacción, con la fila
    // del día bloqueada.
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════
  // SIEMBRA DE CATÁLOGOS
  // ══════════════════════════════════════════════════════════

  /**
   * En producción los crea `migration-auxiliar.sql`, pero en desarrollo y
   * en pruebas el esquema lo genera `synchronize: true`, que crea las
   * tablas y no ejecuta el SQL. Sin esto, el auxiliar abriría el selector
   * de funciones y lo encontraría vacío: el módulo entero sería inusable.
   */
  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty('funciones del auxiliar', this.functionRepo, SEED_FUNCTIONS);
    await this.seedIfEmpty('tipos de participación', this.typeRepo, SEED_PARTICIPATION_TYPES);
  }

  private async seedIfEmpty(
    etiqueta: string,
    repo: Repository<AuxiliaryFunction> | Repository<ParticipationType>,
    names: string[],
  ): Promise<void> {
    if (await repo.count() > 0) return;
    this.log.log(`Sembrando catálogo: ${etiqueta}…`);
    await repo.save(
      names.map((name, i) => repo.create({ name, displayOrder: i + 1 } as never)) as never,
    );
    this.log.log(`Sembrados ${names.length} · ${etiqueta}`);
  }

  // ══════════════════════════════════════════════════════════
  // PERMISOS
  // ══════════════════════════════════════════════════════════

  /** Roles con acceso al módulo. Cualquier otro recibe 403. */
  private readonly ALLOWED_ROLES: UserRole[] = [
    UserRole.AUXILIAR, UserRole.ENLACE, UserRole.ADMIN,
  ];

  /**
   * Puerta de entrada: el registro del auxiliar es operativo del nodo, no
   * material de supervisión académica. Vicerrectorías, decanos,
   * coordinadores, docentes y monitoras NO entran.
   */
  assertModuleAccess(user: User): void {
    if (!this.ALLOWED_ROLES.includes(user.role)) {
      throw new ForbiddenException('No tienes acceso al registro de actividades del nodo');
    }
  }

  /**
   * Sin nodo no hay registro posible: el día nacería con `nodo_id` null y
   * ningún enlace podría verlo ni incluirlo en un reporte.
   */
  private assertHasNodo(user: User): void {
    if (!user.nodoId) {
      throw new BadRequestException(
        'No tienes un nodo asignado. Pide al administrador que te asigne un ' +
        'nodo: mientras tanto, tus registros no podrían ser consultados por ' +
        'el enlace ni incluidos en el reporte mensual.',
      );
    }
  }

  /**
   * ¿Este auxiliar dejó trabajo hecho en este nodo, alguna vez?
   *
   * Es lo que sostiene el acceso del enlace después de un traslado: el
   * vínculo no es el perfil actual de la persona, son los días.
   */
  private async hasRowsInNodo(auxiliaryId: string, nodoId: string): Promise<boolean> {
    return (await this.dayRepo.count({ where: { auxiliaryId, nodoId } })) > 0;
  }

  /** ¿Puede este usuario ver los registros de este auxiliar? */
  private async assertCanReadAuxiliary(auxiliaryId: string, user: User): Promise<User> {
    this.assertModuleAccess(user);

    const auxiliary = await this.userRepo.findOne({ where: { id: auxiliaryId } });
    if (!auxiliary) throw new NotFoundException('Auxiliar no encontrado');
    if (auxiliary.role !== UserRole.AUXILIAR) {
      throw new BadRequestException('El usuario indicado no tiene rol auxiliar');
    }

    switch (user.role) {
      case UserRole.ADMIN:
        return auxiliary;

      case UserRole.AUXILIAR:
        if (auxiliary.id !== user.id) {
          throw new ForbiddenException('No tienes permiso para ver los registros de otra persona');
        }
        this.assertHasNodo(user);
        return auxiliary;

      case UserRole.ENLACE: {
        // La puerta no es "esta persona es de mi nodo ahora", sino "hay
        // trabajo hecho en mi nodo". Si el auxiliar se trasladó, el enlace
        // anterior sigue respondiendo por lo que se hizo mientras estuvo
        // con él y lo tiene que poder consultar y reportar.
        if (!user.nodoId) {
          throw new ForbiddenException('Este auxiliar no pertenece a tu nodo');
        }
        const esDeMiNodoAhora = auxiliary.nodoId === user.nodoId;
        if (!esDeMiNodoAhora && !(await this.hasRowsInNodo(auxiliaryId, user.nodoId))) {
          throw new ForbiddenException('Este auxiliar no pertenece a tu nodo');
        }
        return auxiliary;
      }

      default:
        throw new ForbiddenException('No tienes acceso al registro de actividades del nodo');
    }
  }

  /**
   * Escritura: SOLO el propio auxiliar sobre su propio registro.
   *
   * Ni el enlace ni el admin. El enlace consulta y reporta, pero el
   * registro debe reflejar lo que el auxiliar declara. Y el admin tampoco:
   * los endpoints toman auxiliaryId y nodoId del usuario autenticado, así
   * que escribiría filas a SU nombre y con nodo null, invisibles para todo
   * el mundo. Una corrección administrativa se hace sobre la base.
   */
  private assertCanWrite(auxiliaryId: string, user: User): void {
    this.assertModuleAccess(user);

    if (user.role !== UserRole.AUXILIAR || auxiliaryId !== user.id) {
      throw new ForbiddenException('Solo el auxiliar registra su propia actividad');
    }
    this.assertHasNodo(user);
  }

  /**
   * Filtro de días por nodo, según quién lee.
   *
   * El enlace ve el trabajo hecho EN SU NODO, no el historial completo de
   * la persona. Sin esto, un auxiliar trasladado del nodo A al B le
   * enseñaría al enlace de B todo lo que hizo en A: una fuga entre nodos
   * que aparece sola el día que mueven a alguien de contrato.
   */
  private nodoRowFilter(user: User): { nodoId?: string } {
    return user.role === UserRole.ENLACE ? { nodoId: user.nodoId as string } : {};
  }

  // ══════════════════════════════════════════════════════════
  // CATÁLOGOS
  // ══════════════════════════════════════════════════════════

  async listFunctions(user: User): Promise<AuxiliaryFunction[]> {
    this.assertModuleAccess(user);
    return this.functionRepo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  async listParticipationTypes(user: User): Promise<ParticipationType[]> {
    this.assertModuleAccess(user);
    return this.typeRepo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  /**
   * Actividades y procesos del nodo a los que enganchar una actividad.
   *
   * Endpoint propio y no /activities ni /processes: esos filtran por "lo
   * que creaste tú", y el auxiliar no crea ninguno de los dos, así que le
   * devolverían siempre una lista vacía.
   */
  async listLinkableOrigins(user: User) {
    this.assertModuleAccess(user);

    const nodoId = user.role === UserRole.ADMIN ? null : user.nodoId ?? null;
    if (user.role !== UserRole.ADMIN && !nodoId) {
      this.assertHasNodo(user);
    }

    const activityQb = this.activityRepo
      .createQueryBuilder('r')
      .innerJoin('r.user', 'u')
      .select(['r.id', 'r.title', 'r.activityDate'])
      .orderBy('r.activity_date', 'DESC')
      .limit(200);

    // activity_requests no tiene nodo_id: el nodo de una actividad es el
    // de quien la creó, así que se filtra por el perfil de su dueño.
    if (nodoId) activityQb.where('u.nodo_id = :nodoId', { nodoId });

    const processQb = this.processRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.name', 'p.type', 'p.status'])
      .orderBy('p.created_at', 'DESC')
      .limit(200);

    if (nodoId) processQb.where('p.nodo_id = :nodoId', { nodoId });

    const [activities, processes] = await Promise.all([
      activityQb.getMany(),
      processQb.getMany(),
    ]);

    return {
      activities: activities.map((a) => ({ id: a.id, title: a.title, date: a.activityDate })),
      processes:  processes.map((p) => ({ id: p.id, name: p.name, type: p.type, status: p.status })),
    };
  }

  // ══════════════════════════════════════════════════════════
  // DÍAS
  // ══════════════════════════════════════════════════════════

  /**
   * Abre el bloque de un día. Si ya existe, lo devuelve: la fecha no se
   * duplica nunca, y pedirla dos veces es lo normal cuando alguien vuelve
   * a registrar algo del mismo día.
   */
  async createDay(dto: CreateDayDto, user: User): Promise<AuxiliaryDay> {
    this.assertCanWrite(user.id, user);

    const existing = await this.dayRepo.findOne({
      where: { auxiliaryId: user.id, logDate: dto.logDate },
    });
    if (existing) return existing;

    return this.saveTranslatingDuplicate(
      () => this.dayRepo.save(
        this.dayRepo.create({
          auxiliaryId: user.id,
          nodoId:      user.nodoId ?? null,   // del perfil, nunca del body
          logDate:     dto.logDate,
        }),
      ),
      // Si dos peticiones simultáneas abren el mismo día, la segunda choca
      // con el índice único: se relee en vez de devolver un 500.
      async () => {
        const ya = await this.dayRepo.findOne({
          where: { auxiliaryId: user.id, logDate: dto.logDate },
        });
        if (!ya) throw new BadRequestException('No se pudo abrir el día, inténtalo de nuevo');
        return ya;
      },
    );
  }

  /**
   * El trabajo se registra en el nodo ACTUAL del auxiliar.
   *
   * Tras un traslado de A a B, los días viejos siguen siendo del nodo A —
   * ese es su hecho histórico— y quedan cerrados a escritura. Sin esta
   * guardia, la persona podría seguir añadiendo actividades a días del
   * nodo anterior y el enlace de A vería aparecer trabajo nuevo en un
   * registro que ya firmó.
   *
   * Efecto buscado, y duro a propósito: lo registrado en un nodo del que
   * ya saliste no se toca más, ni para corregir una errata. La corrección
   * de un dato pasado es administrativa, no del propio interesado.
   */
  private assertWritableDay(day: AuxiliaryDay, user: User): void {
    if (day.nodoId !== user.nodoId) {
      throw new ForbiddenException(
        'Solo puedes registrar actividades en tu nodo actual. Este día ' +
        'pertenece a otro nodo y su registro ya no se modifica.',
      );
    }
  }

  /** Carga un día validando permiso de escritura sobre él. */
  private async getDayForWrite(dayId: string, user: User): Promise<AuxiliaryDay> {
    this.assertModuleAccess(user);
    const day = await this.dayRepo.findOne({ where: { id: dayId } });
    if (!day) throw new NotFoundException('Día no encontrado');
    // Primero "esto no es tuyo", después "es tuyo pero de otro nodo":
    // así los dos 403 no se pisan y cada uno dice lo que pasa.
    this.assertCanWrite(day.auxiliaryId, user);
    this.assertWritableDay(day, user);
    return day;
  }

  /** Borra un día. Bloquea si todavía tiene actividades (evita pérdidas). */
  async deleteDay(dayId: string, user: User): Promise<void> {
    const day = await this.getDayForWrite(dayId, user);

    const count = await this.actRepo.count({ where: { dayId: day.id } });
    if (count > 0) {
      throw new BadRequestException(
        `El ${day.logDate} tiene ${count} actividad(es). Elimínalas antes de borrar el día.`,
      );
    }

    await this.dayRepo.delete(day.id);
  }

  /**
   * Traduce la violación del índice único a algo con sentido.
   *
   * El chequeo previo es un read-then-write: entre la lectura y la
   * escritura cabe otra petición idéntica (doble clic, doble envío). El
   * índice la corta, pero el error de Postgres saldría como 500.
   */
  private async saveTranslatingDuplicate<T>(
    save: () => Promise<T>,
    onDuplicate: (() => Promise<T>) | string,
  ): Promise<T> {
    try {
      return await save();
    } catch (err) {
      const code = (err as { driverError?: { code?: string }; code?: string })
        ?.driverError?.code ?? (err as { code?: string })?.code;
      if (code === '23505') {
        if (typeof onDuplicate === 'string') throw new BadRequestException(onDuplicate);
        return onDuplicate();
      }
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════
  // ACTIVIDADES DEL DÍA
  // ══════════════════════════════════════════════════════════

  async addActivity(
    dayId: string, dto: CreateActivityDto, user: User,
  ): Promise<AuxiliaryActivity> {
    const day = await this.getDayForWrite(dayId, user);

    const functions = await this.resolveFunctions(dto.functionIds);
    const types     = await this.resolveTypes(dto.typeIds ?? []);
    const origin    = await this.resolveOrigin(dto, day.nodoId as string);

    // Todo el control del tope va dentro de la transacción, con la fila del
    // día bloqueada: si no, dos peticiones simultáneas leen las mismas
    // horas "ya registradas", ambas se creen por debajo de 24 y entre las
    // dos meten el doble. Esa suma acaba impresa en el PDF que firma el
    // enlace.
    return this.dataSource.transaction(async (m) => {
      await this.lockDay(m, day.id);
      await this.assertDailyHoursCap(m, day.id, dto.hours ?? null, null);

      const repo = m.getRepository(AuxiliaryActivity);
      return repo.save(
        repo.create({
          dayId:       day.id,
          description: dto.description,
          hours:       dto.hours ?? null,
          activityId:  origin.activityId,
          processId:   origin.processId,
          functions,
          types,
        }),
      );
    });
  }

  /**
   * Bloquea la fila del día (SELECT ... FOR UPDATE) para serializar a quien
   * escriba actividades en él. El día es la fila natural: el tope es "24 h
   * en esta fecha", así que dos peticiones del mismo día esperan y las de
   * días distintos no se estorban.
   */
  private async lockDay(m: EntityManager, dayId: string): Promise<AuxiliaryDay | null> {
    return m.getRepository(AuxiliaryDay)
      .createQueryBuilder('d')
      .setLock('pessimistic_write')
      .where('d.id = :id', { id: dayId })
      .getOne();
  }

  private async getActivityForWrite(
    activityId: string, user: User,
  ): Promise<AuxiliaryActivity> {
    this.assertModuleAccess(user);
    const activity = await this.actRepo.findOne({
      where: { id: activityId },
      relations: ['day', 'functions', 'types'],
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    this.assertCanWrite(activity.day.auxiliaryId, user);
    // Misma regla que en el día: no se escribe hacia el nodo anterior, ni
    // editando una actividad vieja ni colgándole una evidencia.
    this.assertWritableDay(activity.day, user);
    return activity;
  }

  async updateActivity(
    activityId: string, dto: UpdateActivityDto, user: User,
  ): Promise<AuxiliaryActivity> {
    const existing = await this.getActivityForWrite(activityId, user);

    const functions = dto.functionIds !== undefined
      ? await this.resolveFunctions(dto.functionIds) : undefined;
    const types = dto.typeIds !== undefined
      ? await this.resolveTypes(dto.typeIds) : undefined;

    return this.dataSource.transaction(async (m) => {
      await this.lockDay(m, existing.dayId);

      const repo = m.getRepository(AuxiliaryActivity);
      // Se relee DENTRO de la transacción: otra petición pudo cambiarle las
      // horas mientras esperábamos el candado.
      const activity = await repo.findOne({
        where: { id: activityId },
        relations: ['functions', 'types'],
      });
      if (!activity) throw new NotFoundException('Actividad no encontrada');

      // El enganche no se cambia por edición: si la actividad colgaba de
      // otra cosa, se borra y se crea de nuevo. Así lo que muestra la
      // tarjeta no puede desincronizarse del registro original.
      const nextHours = dto.hours !== undefined ? dto.hours : activity.hours;
      await this.assertDailyHoursCap(m, activity.dayId, nextHours, activity.id);

      if (dto.description !== undefined) activity.description = dto.description;
      if (dto.hours       !== undefined) activity.hours       = dto.hours;
      if (functions       !== undefined) activity.functions   = functions;
      if (types           !== undefined) activity.types       = types;

      return repo.save(activity);
    });
  }

  async deleteActivity(activityId: string, user: User): Promise<void> {
    const activity = await this.getActivityForWrite(activityId, user);
    await this.actRepo.delete(activity.id);
  }

  /**
   * Tope de 24 h por día, ahora sobre la suma de las actividades del día.
   *
   * Sin esto caben tantas horas como actividades se registren, y esa suma
   * acaba impresa en el reporte mensual que firma el enlace.
   */
  private async assertDailyHoursCap(
    m: EntityManager,
    dayId: string,
    newHours: number | null,
    excludeActivityId: string | null,
  ): Promise<void> {
    if (newHours === null) return;   // la actividad sin horas no suma

    // Se lee por el manager de la transacción, con el día ya bloqueado:
    // leerlo fuera dejaría el hueco que este candado viene a cerrar.
    const sameDay = await m.getRepository(AuxiliaryActivity).find({ where: { dayId } });
    const others = sameDay
      .filter((a) => a.id !== excludeActivityId)
      .reduce((s, a) => s + Number(a.hours ?? 0), 0);

    const total = Math.round((others + Number(newHours)) * 10) / 10;
    if (total <= MAX_DAILY_HOURS) return;

    throw new BadRequestException(
      `Ese día quedaría con ${total} h registradas y un día tiene ` +
      `${MAX_DAILY_HOURS}. Revisa las horas de las actividades del día.`,
    );
  }

  /** Resuelve las funciones del catálogo, rechazando ids inventados. */
  private async resolveFunctions(functionIds: string[]): Promise<AuxiliaryFunction[]> {
    const unique = [...new Set(functionIds)];
    if (unique.length === 0) {
      throw new BadRequestException('Indica al menos una función');
    }

    const functions = await this.functionRepo.find({ where: { id: In(unique) } });
    if (functions.length !== unique.length) {
      throw new BadRequestException('Alguna de las funciones no existe en el catálogo');
    }
    return functions;
  }

  /** Los tipos de participación son opcionales: una actividad puede no tenerlos. */
  private async resolveTypes(typeIds: string[]): Promise<ParticipationType[]> {
    const unique = [...new Set(typeIds)];
    if (unique.length === 0) return [];

    const types = await this.typeRepo.find({ where: { id: In(unique) } });
    if (types.length !== unique.length) {
      throw new BadRequestException('Alguno de los tipos de participación no existe en el catálogo');
    }
    return types;
  }

  /**
   * Valida el enganche y devuelve los campos resueltos.
   *
   * Ojo con las actividades: `activity_requests` NO tiene columna de nodo.
   * El nodo de una actividad es el de quien la creó, así que la pertenencia
   * se comprueba a través del perfil de su dueño. Los procesos sí tienen
   * `nodo_id` propio y se validan directamente.
   */
  private async resolveOrigin(
    dto: { activityId?: string; processId?: string },
    nodoId: string,
  ): Promise<{ activityId: string | null; processId: string | null }> {
    if (dto.activityId && dto.processId) {
      throw new BadRequestException(
        'Una actividad se engancha a una actividad del nodo o a un proceso, no a los dos',
      );
    }

    if (dto.activityId) {
      const activity = await this.activityRepo.findOne({
        where: { id: dto.activityId },
        relations: ['user'],
      });
      if (!activity) throw new BadRequestException('La actividad indicada no existe');
      if (!activity.user?.nodoId || activity.user.nodoId !== nodoId) {
        throw new ForbiddenException('Esa actividad no pertenece a tu nodo');
      }
      return { activityId: activity.id, processId: null };
    }

    if (dto.processId) {
      const process = await this.processRepo.findOne({ where: { id: dto.processId } });
      if (!process) throw new BadRequestException('El proceso indicado no existe');
      if (!process.nodoId || process.nodoId !== nodoId) {
        throw new ForbiddenException('Ese proceso no pertenece a tu nodo');
      }
      return { activityId: null, processId: process.id };
    }

    return { activityId: null, processId: null };   // actividad suelta
  }

  // ══════════════════════════════════════════════════════════
  // EVIDENCIAS
  // ══════════════════════════════════════════════════════════

  async addEvidence(dto: CreateAuxEvidenceDto, user: User): Promise<AuxiliaryEvidence> {
    await this.getActivityForWrite(dto.activityId, user);

    return this.evidenceRepo.save(
      this.evidenceRepo.create({
        activityId: dto.activityId,
        fileUrl:    dto.fileUrl,
        caption:    dto.caption ?? null,
      }),
    );
  }

  async deleteEvidence(evidenceId: string, user: User): Promise<void> {
    this.assertModuleAccess(user);

    const evidence = await this.evidenceRepo.findOne({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');

    if (evidence.activityId) {
      await this.getActivityForWrite(evidence.activityId, user);
    } else if (user.role !== UserRole.ADMIN) {
      // Evidencia suelta (se borró la actividad de la que colgaba, o es
      // legacy sin migrar): solo el admin la toca.
      throw new ForbiddenException('Esta evidencia ya no está asociada a una actividad');
    }

    // Borrado lógico: es el soporte documental del reporte mensual
    await this.evidenceRepo.softDelete(evidence.id);
  }

  // ══════════════════════════════════════════════════════════
  // CONSULTA DE DÍAS
  // ══════════════════════════════════════════════════════════

  /** Primer y último día del mes, como 'YYYY-MM-DD'. */
  private monthRange(year: number, month: number): { from: string; to: string } {
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
  }

  /**
   * Los días de un auxiliar en un período, con sus actividades.
   *
   * Pagina sobre DÍAS, no sobre actividades: la unidad que ve el usuario es
   * la tarjeta del día, y partir un día por la mitad entre dos páginas
   * daría una lectura falsa de cuánto se hizo esa fecha.
   */
  async findDays(auxiliaryId: string, query: DaysQueryDto, user: User) {
    const auxiliary = await this.assertCanReadAuxiliary(auxiliaryId, user);

    const rango = this.monthRange(query.year, query.month);
    // El filtro por fechas se recorta al mes consultado: pedir "desde" o
    // "hasta" nunca puede sacar al usuario del período que está mirando.
    const from = query.from && query.from > rango.from ? query.from : rango.from;
    const to   = query.to   && query.to   < rango.to   ? query.to   : rango.to;

    const page     = query.page     ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const candidatos = await this.dayRepo.find({
      where: {
        auxiliaryId,
        ...this.nodoRowFilter(user),
        logDate: Between(from, to),
      },
      order: { logDate: 'DESC' },
    });

    // Búsqueda por texto: se queda con los días que tengan alguna actividad
    // que la contenga. Filtrar aquí y no en SQL mantiene el conteo de
    // páginas coherente con lo que se muestra.
    const search = query.search?.trim();
    const dayIds = candidatos.map((d) => d.id);
    const coincidentes = search && dayIds.length
      ? new Set(
          (await this.actRepo.find({
            where: { dayId: In(dayIds), description: ILike(`%${search}%`) },
            select: { dayId: true },
          })).map((a) => a.dayId),
        )
      : null;

    const filtrados = coincidentes
      ? candidatos.filter((d) => coincidentes.has(d.id))
      : candidatos;

    const total      = filtrados.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pagina     = filtrados.slice((page - 1) * pageSize, page * pageSize);

    const actividades = await this.loadActivities(pagina.map((d) => d.id));
    const evidencias  = await this.findEvidencesFor(actividades.map((a) => a.id));
    const evByAct     = this.groupBy(evidencias, (e) => e.activityId as string);
    const actsByDay   = this.groupBy(actividades, (a) => a.dayId);

    const days = pagina.map((d) => {
      const acts = (actsByDay.get(d.id) ?? []).map((a) => this.publicActivity(a, evByAct));
      const conHoras = acts.filter((a) => a.hours !== null && a.hours !== undefined);
      return {
        id:            d.id,
        logDate:       d.logDate,
        nodoId:        d.nodoId,
        createdAt:     d.createdAt,
        activities:    acts,
        activityCount: acts.length,
        totalHours: conHoras.length
          ? Math.round(conHoras.reduce((s, a) => s + Number(a.hours), 0) * 10) / 10
          : null,
      };
    });

    return {
      auxiliary: this.publicAuxiliary(auxiliary),
      year: query.year, month: query.month,
      days,
      pagination: { page, pageSize, total, totalPages },
      nodos: await this.resolveRowNodos(filtrados),
      summary: await this.buildSummary(auxiliaryId, query.year, query.month, user),
    };
  }

  /** Todo el mes sin paginar. Es lo que consume el reporte PDF. */
  async findMonth(auxiliaryId: string, year: number, month: number, user: User) {
    const auxiliary = await this.assertCanReadAuxiliary(auxiliaryId, user);
    const { from, to } = this.monthRange(year, month);

    const dias = await this.dayRepo.find({
      where: { auxiliaryId, ...this.nodoRowFilter(user), logDate: Between(from, to) },
      order: { logDate: 'ASC' },
    });

    const actividades = await this.loadActivities(dias.map((d) => d.id));
    const evidencias  = await this.findEvidencesFor(actividades.map((a) => a.id));
    const evByAct     = this.groupBy(evidencias, (e) => e.activityId as string);
    const actsByDay   = this.groupBy(actividades, (a) => a.dayId);

    const days = dias.map((d) => ({
      id:      d.id,
      logDate: d.logDate,
      nodoId:  d.nodoId,
      activities: (actsByDay.get(d.id) ?? []).map((a) => this.publicActivity(a, evByAct)),
    }));

    const conHoras = actividades.filter((a) => a.hours !== null && a.hours !== undefined);

    return {
      auxiliary: this.publicAuxiliary(auxiliary),
      year, month,
      days,
      nodos: await this.resolveRowNodos(dias),
      summary: {
        year, month,
        daysWithLog:   dias.length,
        activityCount: actividades.length,
        evidenceCount: evidencias.length,
        totalHours: conHoras.length
          ? Math.round(conHoras.reduce((s, a) => s + Number(a.hours), 0) * 10) / 10
          : null,   // null y no 0: nadie registró horas ≠ trabajó 0 horas
      } as MonthSummary,
    };
  }

  /** Totales del mes completo, aunque la vista esté paginada. */
  private async buildSummary(
    auxiliaryId: string, year: number, month: number, user: User,
  ): Promise<MonthSummary> {
    const { from, to } = this.monthRange(year, month);

    const dias = await this.dayRepo.find({
      where: { auxiliaryId, ...this.nodoRowFilter(user), logDate: Between(from, to) },
    });

    if (dias.length === 0) {
      return { year, month, daysWithLog: 0, activityCount: 0, evidenceCount: 0, totalHours: null };
    }

    const actividades = await this.actRepo.find({ where: { dayId: In(dias.map((d) => d.id)) } });
    const evidencias  = await this.findEvidencesFor(actividades.map((a) => a.id));
    const conHoras    = actividades.filter((a) => a.hours !== null && a.hours !== undefined);

    return {
      year, month,
      daysWithLog:   dias.length,
      activityCount: actividades.length,
      evidenceCount: evidencias.length,
      totalHours: conHoras.length
        ? Math.round(conHoras.reduce((s, a) => s + Number(a.hours), 0) * 10) / 10
        : null,
    };
  }

  private async loadActivities(dayIds: string[]): Promise<AuxiliaryActivity[]> {
    if (dayIds.length === 0) return [];
    return this.actRepo.find({
      where: { dayId: In(dayIds) },
      relations: ['functions', 'types', 'activity', 'process'],
      order: { createdAt: 'ASC' },
    });
  }

  /** Evidencias vivas de un conjunto de actividades. */
  private async findEvidencesFor(activityIds: string[]): Promise<AuxiliaryEvidence[]> {
    if (activityIds.length === 0) return [];
    return this.evidenceRepo.find({ where: { activityId: In(activityIds) } });
  }

  private publicActivity(
    a: AuxiliaryActivity,
    evByAct: Map<string, AuxiliaryEvidence[]>,
  ) {
    return {
      id:          a.id,
      dayId:       a.dayId,
      description: a.description,
      hours:       a.hours,
      activityId:  a.activityId,
      processId:   a.processId,
      // El nombre del enganche sale del registro original; si es suelta, la
      // descripción es lo único que la identifica.
      linkLabel:   a.activity?.title ?? a.process?.name ?? null,
      isLinked:    !!(a.activityId || a.processId),
      functions:   (a.functions ?? []).map((f) => ({ id: f.id, name: f.name })),
      types:       (a.types ?? []).map((t) => ({ id: t.id, name: t.name })),
      evidences:   evByAct.get(a.id) ?? [],
      createdAt:   a.createdAt,
    };
  }

  /**
   * Nodos presentes en un conjunto de días, con su nombre.
   *
   * Devuelve lista, no un valor único, porque un período puede estar a
   * caballo entre dos nodos: el reporte tiene que poder decirlo en vez de
   * elegir uno y firmar que todo se hizo allí.
   */
  private async resolveRowNodos(
    rows: { nodoId: string | null }[],
  ): Promise<{ id: string; name: string | null }[]> {
    const ids = [...new Set(rows.map((r) => r.nodoId).filter((id): id is string => !!id))];
    if (ids.length === 0) return [];

    const nodos = await this.nodoRepo.find({ where: { id: In(ids) } });
    const nombre = new Map(nodos.map((n) => [n.id, n.name]));

    return ids.map((id) => ({ id, name: nombre.get(id) ?? null }));
  }

  // ══════════════════════════════════════════════════════════
  // AUXILIARES VISIBLES (vista del enlace)
  // ══════════════════════════════════════════════════════════

  /**
   * Auxiliares que puede consultar el usuario.
   *   enlace → los de su nodo AHORA, más los que dejaron trabajo hecho en
   *            él y luego se trasladaron (sin nodo asignado: lista vacía)
   *   admin  → todos
   *   auxiliar → 403 (no lista a sus pares)
   *
   * Los trasladados tienen que aparecer aquí: si no, el enlace podría abrir
   * su registro por URL —la puerta se lo permite— pero no tendría cómo
   * llegar a él desde la interfaz.
   */
  async listAuxiliaries(user: User) {
    this.assertModuleAccess(user);

    if (user.role === UserRole.AUXILIAR) {
      throw new ForbiddenException('No tienes permiso para listar auxiliares');
    }

    if (user.role === UserRole.ADMIN) {
      const todos = await this.userRepo.find({
        where: { role: UserRole.AUXILIAR },
        order: { name: 'ASC' },
      });
      return todos.map((a) => this.publicAuxiliary(a));
    }

    if (!user.nodoId) return [];
    const nodoId = user.nodoId;

    const [actuales, conHistorico] = await Promise.all([
      this.userRepo.find({ where: { role: UserRole.AUXILIAR, nodoId }, order: { name: 'ASC' } }),
      this.findAuxiliaryIdsWithRowsIn(nodoId),
    ]);

    const yaEstan = new Set(actuales.map((a) => a.id));
    const faltantes = conHistorico.filter((id) => !yaEstan.has(id));

    const trasladados = faltantes.length
      ? await this.userRepo.find({
          where: { id: In(faltantes), role: UserRole.AUXILIAR },
          order: { name: 'ASC' },
        })
      : [];

    return [...actuales, ...trasladados]
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      .map((a) => this.publicAuxiliary(a));
  }

  /** Ids de auxiliares con al menos un día registrado en este nodo. */
  private async findAuxiliaryIdsWithRowsIn(nodoId: string): Promise<string[]> {
    const dias = await this.dayRepo.find({ where: { nodoId }, select: { auxiliaryId: true } });
    return [...new Set(dias.map((d) => d.auxiliaryId))];
  }

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════

  private groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const k = key(item);
      const list = map.get(k) ?? [];
      list.push(item);
      map.set(k, list);
    }
    return map;
  }

  /** Proyección del auxiliar sin datos sensibles (nunca el hash). */
  private publicAuxiliary(u: User) {
    return {
      id:             u.id,
      name:           u.name,
      email:          u.email,
      documentType:   u.documentType,
      documentNumber: u.documentNumber,
      nodoId:         u.nodoId,
      nodoName:       u.nodoName,
      phone:          u.phone,
    };
  }

  /** Datos del auxiliar para el reporte. Uso interno de Reports. */
  async getAuxiliaryForReport(auxiliaryId: string, user: User): Promise<User> {
    return this.assertCanReadAuxiliary(auxiliaryId, user);
  }
}
