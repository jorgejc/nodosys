import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faculty } from './entities/faculty.entity';
import { Program } from './entities/program.entity';
import { Municipality } from './entities/municipality.entity';
import { Strategy } from './entities/strategy.entity';
import { CatalogsService } from './catalogs.service';
import {
  FacultiesController,
  ProgramsController,
  MunicipalitiesController,
  StrategiesController,
} from './catalogs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Faculty, Program, Municipality, Strategy])],
  providers: [CatalogsService],
  controllers: [
    FacultiesController,
    ProgramsController,
    MunicipalitiesController,
    StrategiesController,
  ],
  exports: [CatalogsService],
})
export class CatalogsModule {}
