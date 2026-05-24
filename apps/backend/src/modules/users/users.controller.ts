import {
  Controller, Get, Post, Patch, Param, Body,
  Query, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from './entities/user.entity';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/users — Admin, vicerrectores y decanos pueden listar usuarios
  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.VICERRECTOR_EXTENSION,
    UserRole.VICERRECTOR_ACADEMICO,
    UserRole.EQUIPO_EXTENSION,
    UserRole.DECANO,
    UserRole.COORDINADOR,
    UserRole.ENLACE,
  )
  @ApiOperation({ summary: 'Listar usuarios con filtros' })
  @ApiQuery({ name: 'search',   required: false, description: 'Buscar por nombre, cédula o email' })
  @ApiQuery({ name: 'role',     required: false })
  @ApiQuery({ name: 'faculty',  required: false })
  @ApiQuery({ name: 'program',  required: false })
  @ApiQuery({ name: 'nodoId',   required: false })
  findAll(
    @CurrentUser() currentUser: User,
    @Query('search')  search?:  string,
    @Query('role')    role?:    string,
    @Query('faculty') faculty?: string,
    @Query('program') program?: string,
    @Query('nodoId')  nodoId?:  string,
  ) {
    return this.usersService.findAll(currentUser, { search, role, faculty, program, nodoId });
  }

  // POST /api/users — Solo admin puede crear usuarios directamente
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ENLACE)
  @ApiOperation({ summary: 'Crear usuario (admin o enlace para monitores/auxiliares)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() creator: User) {
    return this.usersService.createByAdmin(dto, creator);
  }

  // GET /api/users/:id
  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  // PATCH /api/users/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.update(id, dto, currentUser);
  }
}