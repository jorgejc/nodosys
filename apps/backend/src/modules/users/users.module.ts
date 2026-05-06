import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  // TypeOrmModule.forFeature registra la entidad User en este módulo
  // Esto nos da acceso al Repository<User> para hacer queries a la BD
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController],
  // exports permite que otros módulos (ej: AuthModule) usen UsersService
  exports: [UsersService],
})
export class UsersModule {}
