import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import {
  DTO_SCHEMAS,
  MULTIPART_BODY_SCHEMAS,
} from './common/swagger/dto-schemas';
import { zodToOpenApiSchema } from './common/swagger/zod-to-openapi';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.set('json replacer', (key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  if (config.get<string>('TRUST_PROXY') === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(cookieParser());

  const securityHeaders = new SecurityHeadersMiddleware();
  app.use(securityHeaders.use.bind(securityHeaders));

  const rateLimitEnabled =
    config.get<string>('RATE_LIMIT_ENABLED') === 'true' &&
    config.get<string>('NODE_ENV') !== 'test';
  const rateLimiter = new RateLimitMiddleware({
    enabled: rateLimitEnabled,
    windowMs: config.get<number>('RATE_LIMIT_WINDOW_MS') ?? 60_000,
    maxRequests: config.get<number>('RATE_LIMIT_MAX') ?? 300,
    maxAuthRequests: config.get<number>('RATE_LIMIT_AUTH_MAX') ?? 15,
  });
  app.use(rateLimiter.use.bind(rateLimiter));

  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1');

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isLocalDevelopment =
    config.get<string>('NODE_ENV') !== 'production' &&
    config.get<string>('NODE_ENV') !== 'prod';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const localOrigin =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (origins.includes(origin) || (isLocalDevelopment && localOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TGManager API')
    .setDescription(
      'Multi-tenant company management system covering attendance, ' +
        'staff, schedules, chat, documents, forms, inventory, memos, ' +
        'workflows, roles, integrations, and platform administration. All tenant-scoped ' +
        'endpoints require authentication via the `tgmanager_access` cookie ' +
        'obtained through /auth/login. Integration ' +
        'endpoints use `X-Api-Key` header authentication.',
    )
    .setVersion('1.0')
    .setContact('TGManager', '', '')
    .addCookieAuth('tgmanager_access')
    .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'X-Api-Key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Register request-body DTOs as named models so they show up in the
  // "Schemas" section and can be referenced from request bodies via $ref.
  document.components = document.components ?? {};
  document.components.schemas = document.components.schemas ?? {};
  const schemas = document.components.schemas as Record<string, unknown>;
  for (const [name, schema] of Object.entries(DTO_SCHEMAS)) {
    schemas[name] = zodToOpenApiSchema(schema);
  }
  for (const [name, multipart] of Object.entries(MULTIPART_BODY_SCHEMAS)) {
    const base = multipart.base
      ? zodToOpenApiSchema(multipart.base)
      : undefined;
    schemas[name] = {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: multipart.fileDescription,
        },
        ...(base?.properties ?? {}),
      },
    };
  }

  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs on http://localhost:${port}/api/docs`);
}

void bootstrap();
