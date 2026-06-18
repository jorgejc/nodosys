import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nodo } from './entities/nodo.entity';
import { NodosController } from './nodos.controller';
import { NodosService } from './nodos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Nodo])],
  controllers: [NodosController],
  providers: [NodosService],
  exports: [NodosService],
})
export class NodosModule {}
