/**
 * database.config.ts — Configuración de la Base de Datos
 *
 * TypeORM necesita saber cómo conectarse a PostgreSQL.
 * Toda la configuración viene de las variables de entorno (.env),
 * así nunca tenemos contraseñas hardcodeadas en el código.
 *
 * synchronize: true → en desarrollo TypeORM ajusta la BD automáticamente
 * synchronize: false → en producción usamos migraciones controladas (más seguro)
 */
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USERNAME', 'postgres'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME', 'nodosys_dev'),

  // Busca las entidades (tablas) en todos los módulos
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],

  // Busca las migraciones en la carpeta database/migrations
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],

  // ⚠️ synchronize: true SOLO en desarrollo
  // En producción cambiar a false y usar migraciones
  synchronize: configService.get<string>('NODE_ENV') !== 'production',

  // Ver en consola las queries SQL (útil para depurar, desactivar en producción)
  logging: configService.get<string>('NODE_ENV') === 'development',
});
