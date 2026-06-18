/**
 * app.module.ts — Módulo raíz de la aplicación
 *
 * En NestJS todo se organiza en módulos. Este es el módulo principal
 * que importa la configuración de la base de datos y todos los demás módulos.
 * Piénsalo como el "índice" que conecta todo.
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WorkPlanModule } from './modules/workplan/workplan.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { NodosModule } from './modules/nodos/nodos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: databaseConfig }),

    AuthModule,
    UsersModule,
    InventoryModule,
    WorkPlanModule,
    ReportsModule,
    ActivitiesModule,
    NodosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
