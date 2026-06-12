import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import 'reflect-metadata';

loadEnv({ path: resolve(process.cwd(), '.env'), override: true });
loadEnv({ path: resolve(process.cwd(), '../.env'), override: true });
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve as resolvePath } from 'node:path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
        'http://localhost:3000',
      ],
      credentials: true,
    },
  });

  // Serve locally-stored property media when STORAGE_DRIVER=local (dev fallback).
  const localStorageDir = resolvePath(
    process.env.LOCAL_STORAGE_DIR ?? resolvePath(process.cwd(), 'storage', 'uploads'),
  );
  app.useStaticAssets(localStorageDir, { prefix: '/static/' });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Health endpoint must remain public at `/health` (no `/api/v1` prefix).
  // API controllers will explicitly use `/api/v1/*` routes.

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RE-OS API')
    .setDescription('Real Estate Operating System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Swagger UI for web users (admin) and documentation consumers.
  SwaggerModule.setup('api/v1/docs', app, document);

  // OpenAPI JSON for future app (mobile/web) client generation and integration.
  app
    .getHttpAdapter()
    .getInstance()
    .get('/api/v1/openapi.json', (_req: Request, res: Response) => {
      res.json(document);
    });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
}

bootstrap();

