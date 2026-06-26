import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process } from './entities/process.entity';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Process])],
  controllers: [ProcessesController],
  providers: [ProcessesService],
  exports: [ProcessesService],
})
export class ProcessesModule {}
