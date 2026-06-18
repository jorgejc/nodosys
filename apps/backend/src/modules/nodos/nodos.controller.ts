import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NodosService } from './nodos.service';

@ApiTags('nodos')
@Controller('nodos')
@UseGuards(JwtAuthGuard)
export class NodosController {
  constructor(private readonly nodosService: NodosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista de nodos activos del sistema' })
  findAll() {
    return this.nodosService.findAll();
  }
}
