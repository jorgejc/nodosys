import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process } from './entities/process.entity';
import { CourseSession } from '../sessions/entities/course-session.entity';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Process, CourseSession])],
  controllers: [ProcessesController],
  providers: [ProcessesService],
  exports: [ProcessesService],
})
export class ProcessesModule {}
