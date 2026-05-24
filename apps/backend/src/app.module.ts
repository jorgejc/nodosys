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

@Module({
  imports: [
    // ConfigModule carga las variables de entorno del archivo .env
    // isGlobal:true → disponible en TODA la aplicación sin importar en cada módulo
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // TypeORM conecta con PostgreSQL usando la configuración de database.config.ts
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: databaseConfig }),

    // ─── Aquí iremos agregando los módulos a medida que los creemos ───
    AuthModule,
    UsersModule,
    InventoryModule,
    WorkPlanModule,
    ReportsModule,
    ActivitiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
