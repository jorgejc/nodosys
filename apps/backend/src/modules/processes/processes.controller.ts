import {
  Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { CreateProcessDto, UpdateProcessDto } from './dto/processes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.processesService.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateProcessDto, @CurrentUser() user: User) {
    return this.processesService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.processesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProcessDto,
    @CurrentUser() user: User,
  ) {
    return this.processesService.update(id, dto, user);
  }
}
