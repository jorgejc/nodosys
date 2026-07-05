import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faculty } from './entities/faculty.entity';
import { Program } from './entities/program.entity';
import { Municipality } from './entities/municipality.entity';
import { Strategy } from './entities/strategy.entity';

// ── Datos de facultades y programas ──────────────────────────────────
const SEED_FACULTIES: Array<{
  name: string;
  email: string;
  programs: string[];
}> = [
  {
    name: 'Facultad de Educación',
    email: 'decanaturaeducacion@iudigital.edu.co',
    programs: [
      'Licenciatura en Educación Básica Primaria',
    ],
  },
  {
    name: 'Facultad de Ciencias y Humanidades',
    email: 'decanaturacienciasyhumanidades@iudigital.edu.co',
    programs: [
      'Comunicación y Periodismo Digital',
      'Derecho',
      'Publicidad y Mercadeo Digital',
      'Profesional en Ciencias Ambientales',
      'Profesional en Trabajo Social',
    ],
  },
  {
    name: 'Facultad de Ciencias Económicas, Administrativas y Contables',
    email: 'decanaturaadministracion@iudigital.edu.co',
    programs: [
      'Administración de Empresas',
      'Administración de Empresas Turísticas y Hoteleras',
      'Administración de Seguridad y Salud en el Trabajo',
      'Tecnología en Gestión Comercial Agroempresarial',
      'Tecnología en Gestión Logística Portuaria y del Transporte',
      'Tecnología en Gestión Administrativa',
    ],
  },
  {
    name: 'Facultad de Ingeniería y Ciencias Agropecuarias',
    email: 'decanaturaingenieria@iudigital.edu.co',
    programs: [
      'Ingeniería en Desarrollo Territorial',
      'Ingeniería Mecatrónica',
      'Ingeniería de Software y Datos',
      'Tecnología en Desarrollo de Software',
      'Tecnología en Gestión Catastral y Agrimensura',
      'Tecnología en Desarrollo Comunitario',
    ],
  },
];

// ── Municipios de Antioquia (125) ────────────────────────────────────
const ANTIOQUIA_MUNICIPALITIES = [
  // Valle de Aburrá (10)
  'Barbosa', 'Bello', 'Caldas', 'Copacabana', 'Envigado',
  'Girardota', 'Itagüí', 'La Estrella', 'Medellín', 'Sabaneta',
  // Norte (17)
  'Angostura', 'Belmira', 'Briceño', 'Campamento', 'Carolina del Príncipe',
  'Don Matías', 'Entrerríos', 'Gómez Plata', 'Guadalupe', 'Ituango',
  'San Andrés de Cuerquia', 'San José de la Montaña', 'San Pedro de los Milagros',
  'Santa Rosa de Osos', 'Toledo', 'Valdivia', 'Yarumal',
  // Nordeste (10)
  'Amalfi', 'Anorí', 'Cisneros', 'Remedios', 'San Roque',
  'Santo Domingo', 'Segovia', 'Vegachí', 'Yalí', 'Yolombó',
  // Bajo Cauca (6)
  'Cáceres', 'Caucasia', 'El Bagre', 'Nechí', 'Tarazá', 'Zaragoza',
  // Magdalena Medio (6)
  'Caracolí', 'Maceo', 'Puerto Berrío', 'Puerto Nare', 'Puerto Triunfo', 'Yondó',
  // Oriente (23)
  'Abejorral', 'Alejandría', 'Argelia', 'Cocorná', 'Concepción',
  'El Carmen de Viboral', 'El Peñol', 'El Retiro', 'El Santuario', 'Granada',
  'Guarne', 'Guatapé', 'La Ceja', 'La Unión', 'Marinilla',
  'Nariño', 'Rionegro', 'San Carlos', 'San Francisco', 'San Luis',
  'San Rafael', 'San Vicente Ferrer', 'Sonsón',
  // Suroeste (23)
  'Andes', 'Angelópolis', 'Amagá', 'Betania', 'Betulia',
  'Caramanta', 'Ciudad Bolívar', 'Concordia', 'Fredonia', 'Hispania',
  'Jardín', 'Jericó', 'La Pintada', 'Montebello', 'Pueblorrico',
  'Salgar', 'Santa Bárbara', 'Támesis', 'Tarso', 'Titiribí',
  'Urrao', 'Valparaíso', 'Venecia',
  // Occidente (19)
  'Abriaquí', 'Anzá', 'Armenia', 'Buriticá', 'Caicedo',
  'Cañasgordas', 'Dabeiba', 'Ebéjico', 'Frontino', 'Giraldo',
  'Heliconia', 'Liborina', 'Olaya', 'Peque', 'Sabanalarga',
  'San Jerónimo', 'Santa Fe de Antioquia', 'Sopetrán', 'Uramita',
  // Urabá (11)
  'Apartadó', 'Arboletes', 'Carepa', 'Chigorodó', 'Mutatá',
  'Murindó', 'Necoclí', 'San Juan de Urabá', 'San Pedro de Urabá',
  'Turbo', 'Vigía del Fuerte',
];

// ── Nodos nacionales fuera de Antioquia ──────────────────────────────
const NATIONAL_MUNICIPALITIES: Array<{ name: string; department: string }> = [
  { name: 'San Andrés',  department: 'Archipiélago de San Andrés, Providencia y Santa Catalina' },
  { name: 'Cumaribo',    department: 'Vichada' },
  { name: 'El Tambo',    department: 'Cauca' },
  { name: 'Argelia',     department: 'Cauca' },
];

// ── Estrategias ──────────────────────────────────────────────────────
const SEED_STRATEGIES = [
  'Educación Precedente',
  'Comunidad Docente',
  'Ambientes Abiertos para el Aprendizaje',
  'Acompañamiento Comunitario en Territorio',
  'Investigación',
  'Relacionamiento y Gestión',
  'Juguemos ConCiencia, Robótica y Festivales Científicos',
  'Otro',
];

@Injectable()
export class CatalogsService implements OnModuleInit {
  private readonly log = new Logger(CatalogsService.name);

  constructor(
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
    @InjectRepository(Program)
    private readonly programRepo: Repository<Program>,
    @InjectRepository(Municipality)
    private readonly municipalityRepo: Repository<Municipality>,
    @InjectRepository(Strategy)
    private readonly strategyRepo: Repository<Strategy>,
  ) {}

  async onModuleInit() {
    await this.seedFacultiesAndPrograms();
    await this.seedMunicipalities();
    await this.seedStrategies();
  }

  private async seedFacultiesAndPrograms() {
    if (await this.facultyRepo.count() > 0) return;
    this.log.log('Seeding faculties and programs…');
    for (const fd of SEED_FACULTIES) {
      const faculty = await this.facultyRepo.save(
        this.facultyRepo.create({ name: fd.name, email: fd.email }),
      );
      await this.programRepo.save(
        fd.programs.map(name => this.programRepo.create({ name, facultyId: faculty.id })),
      );
    }
    this.log.log(`Seeded ${SEED_FACULTIES.length} faculties and ${SEED_FACULTIES.reduce((s, f) => s + f.programs.length, 0)} programs`);
  }

  private async seedMunicipalities() {
    if (await this.municipalityRepo.count() > 0) return;
    this.log.log('Seeding municipalities…');
    const rows = [
      ...ANTIOQUIA_MUNICIPALITIES.map(name => ({ name, department: 'Antioquia' })),
      ...NATIONAL_MUNICIPALITIES,
    ];
    await this.municipalityRepo.save(rows.map(r => this.municipalityRepo.create(r)));
    this.log.log(`Seeded ${rows.length} municipalities`);
  }

  private async seedStrategies() {
    if (await this.strategyRepo.count() > 0) return;
    this.log.log('Seeding strategies…');
    await this.strategyRepo.save(
      SEED_STRATEGIES.map(name => this.strategyRepo.create({ name })),
    );
    this.log.log(`Seeded ${SEED_STRATEGIES.length} strategies`);
  }

  // ── Queries ──────────────────────────────────────────────────────

  findAllFaculties(): Promise<Faculty[]> {
    return this.facultyRepo.find({
      relations: ['programs'],
      order: { name: 'ASC' },
    });
  }

  findProgramsByFaculty(facultyId: string): Promise<Program[]> {
    return this.programRepo.find({
      where: { facultyId },
      order: { name: 'ASC' },
    });
  }

  findAllPrograms(): Promise<Program[]> {
    return this.programRepo.find({
      relations: ['faculty'],
      order: { name: 'ASC' },
    });
  }

  findAllMunicipalities(): Promise<Municipality[]> {
    return this.municipalityRepo.find({
      order: { department: 'ASC', name: 'ASC' },
    });
  }

  findAllStrategies(): Promise<Strategy[]> {
    return this.strategyRepo.find({ order: { name: 'ASC' } });
  }
}
