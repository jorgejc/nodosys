import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faculty } from './entities/faculty.entity';
import { Program } from './entities/program.entity';
import { Municipality } from './entities/municipality.entity';
import { Strategy } from './entities/strategy.entity';
import { MissionAxis } from './entities/mission-axis.entity';
import { CatalogsService } from './catalogs.service';
import {
  FacultiesController,
  ProgramsController,
  MunicipalitiesController,
  StrategiesController,
  MissionAxesController,
} from './catalogs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Faculty, Program, Municipality, Strategy, MissionAxis])],
  providers: [CatalogsService],
  controllers: [
    FacultiesController,
    ProgramsController,
    MunicipalitiesController,
    StrategiesController,
    MissionAxesController,
  ],
  exports: [CatalogsService],
})
export class CatalogsModule {}
