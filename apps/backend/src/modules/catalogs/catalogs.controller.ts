import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CatalogsService } from './catalogs.service';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('faculties')
export class FacultiesController {
  constructor(private readonly svc: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar facultades (con programas)' })
  findAll() { return this.svc.findAllFaculties(); }

  @Get(':id/programs')
  @ApiOperation({ summary: 'Programas de una facultad' })
  getPrograms(@Param('id') id: string) { return this.svc.findProgramsByFaculty(id); }
}

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('programs')
export class ProgramsController {
  constructor(private readonly svc: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los programas' })
  findAll() { return this.svc.findAllPrograms(); }
}

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('municipalities')
export class MunicipalitiesController {
  constructor(private readonly svc: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar municipios' })
  findAll() { return this.svc.findAllMunicipalities(); }
}

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly svc: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar estrategias' })
  findAll() { return this.svc.findAllStrategies(); }
}
