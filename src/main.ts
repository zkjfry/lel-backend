import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app =
    await NestFactory.create(
      AppModule,
    );

  const isProduction =
    process.env.NODE_ENV ===
    'production';

  // ============================================================
  // SECURITY HEADERS
  // ============================================================

  if (isProduction) {
    app.use(
      helmet(),
    );
  } else {
    // Swagger UI development compatibility
    app.use(
      helmet({
        contentSecurityPolicy:
          false,
      }),
    );
  }

  // ============================================================
  // GLOBAL API PREFIX
  // ============================================================

  app.setGlobalPrefix(
    'api',
  );

  // ============================================================
  // CORS
  // ============================================================

  const corsOrigins =
    (
      process.env
        .CORS_ORIGINS ??
      'http://localhost:5173'
    )
      .split(',')
      .map(
        (origin) =>
          origin.trim(),
      )
      .filter(Boolean);

  app.enableCors({
    origin:
      corsOrigins,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  });

  // ============================================================
  // DTO VALIDATION
  // ============================================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted:
        true,

      transform: true,
    }),
  );

  // ============================================================
  // SWAGGER
  // Development only by default
  // ============================================================

  const swaggerEnabled =
    process.env
      .SWAGGER_ENABLED ===
      'true' ||
    !isProduction;

  if (swaggerEnabled) {
    const swaggerConfig =
      new DocumentBuilder()
        .setTitle(
          'LEL API',
        )
        .setDescription(
          'LEL Tournament Platform Backend API',
        )
        .setVersion(
          '1.0',
        )
        .addBearerAuth()
        .build();

    const documentFactory =
      () =>
        SwaggerModule.createDocument(
          app,
          swaggerConfig,
        );

    SwaggerModule.setup(
      'docs',
      app,
      documentFactory,
      {
        useGlobalPrefix:
          true,

        jsonDocumentUrl:
          'docs-json',

        customSiteTitle:
          'LEL API Docs',
      },
    );
  }

  // ============================================================
  // GRACEFUL SHUTDOWN
  // ============================================================

  app.enableShutdownHooks();

  // ============================================================
  // SERVER
  // ============================================================

  const port =
    Number(
      process.env.PORT ??
        3000,
    );

  await app.listen(
    port,
    '0.0.0.0',
  );

  console.log(
    `LEL API running on port ${port}`,
  );

  if (swaggerEnabled) {
    console.log(
      `Swagger: http://localhost:${port}/api/docs`,
    );
  }
}

bootstrap();