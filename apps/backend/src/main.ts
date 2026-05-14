/**
 * main.ts — Punto de entrada del servidor NestJS
 *
 * Aquí arranca toda la aplicación. Configura:
 *  - Prefijo global de la API (/api)
 *  - Validación automática de datos entrantes (pipes)
 *  - Documentación Swagger (accesible en /api/docs)
 *  - CORS para que el frontend pueda comunicarse
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global: todos los endpoints quedan como /api/...
  app.setGlobalPrefix('api');

  // Validación automática: si un dato no cumple las reglas del DTO, rechaza la petición
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Elimina campos que no están en el DTO
      forbidNonWhitelisted: true, // Lanza error si llegan campos extra
      transform: true,        // Convierte automáticamente los tipos (string → number, etc.)
    }),
  );

  // ── CORS: permite localhost en desarrollo Y Vercel en producción ──
  const allowedOrigins = [
    'http://localhost:5173',   // Vite dev local
    'http://localhost:3000',   // Alternativa local
    'http://localhost:4200',   // Por si usas otro puerto
    process.env.FRONTEND_URL, // URL de producción en Vercel
  ].filter(Boolean) as string[];
 
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (Postman, curl, Swagger)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS bloqueado para origen: ${origin}`);
        callback(new Error(`Origen no permitido por CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Documentación automática Swagger
  const config = new DocumentBuilder()
    .setTitle('NodoSys API')
    .setDescription('Sistema Integral de Gestión · Nodo Arboletes · IU Digital')
    .setVersion('1.0')
    .addBearerAuth() // Autenticación JWT en Swagger
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // Disponible en http://localhost:3001/api/docs

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`\n🚀 NodoSys Backend corriendo en http://localhost:${port}/api`);
  console.log(`📖 Documentación Swagger: http://localhost:${port}/api/docs\n`);
  console.log(`✅ CORS permitido para: ${allowedOrigins.join(', ')}\n`);
}

bootstrap();
