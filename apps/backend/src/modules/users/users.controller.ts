import {
  Controller, Get, Post, Patch, Param, Body,
  Query, ParseUUIDPipe, UseGuards, ForbiddenException,
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

  // GET /api/users/nodos — selector de nodos (cualquier rol autenticado lo puede leer)
  @Get('nodos')
  @ApiOperation({ summary: 'Lista de nodos registrados en el sistema' })
  getNodos() {
    return this.usersService.getNodos();
  }

  // GET /api/users — solo admin puede listar usuarios
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar usuarios con filtros (solo admin)' })
  @ApiQuery({ name: 'search',   required: false })
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

  // POST /api/users — solo admin puede crear usuarios
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear usuario (solo admin)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() creator: User) {
    return this.usersService.createByAdmin(dto, creator);
  }

  // GET /api/users/:id — admin o el propio usuario
  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID (admin o self)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('Solo puedes ver tu propio perfil');
    }
    return this.usersService.findById(id);
  }

  // PATCH /api/users/:id — admin o el propio usuario
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar usuario (admin o self)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('Solo puedes editar tu propio perfil');
    }
    return this.usersService.update(id, dto, currentUser);
  }
}
