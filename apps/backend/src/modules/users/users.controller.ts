import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';

@ApiTags('Usuarios')
@ApiBearerAuth() // Todos los endpoints de usuarios requieren token JWT
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/users
  @Get()
  @Roles(UserRole.ENLACE)
  @ApiOperation({ summary: 'Listar usuarios (solo enlace)' })
  @ApiQuery({ name: 'nodoId', required: false })
  findAll(@Query('nodoId') nodoId?: string) {
    return this.usersService.findAll(nodoId);
  }

  // POST /api/users
  @Post()
  @Roles(UserRole.ENLACE)
  @ApiOperation({ summary: 'Crear nuevo usuario (solo enlace)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // GET /api/users/:id
  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  // PATCH /api/users/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de usuario' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }
}
