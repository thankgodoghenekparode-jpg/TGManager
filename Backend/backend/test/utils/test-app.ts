import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.set('json replacer', (key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

/**
 * Extracts `name=value` cookie pairs from a supertest response so they can be
 * replayed on subsequent requests.
 */
export function extractCookies(res: {
  headers: Record<string, unknown>;
}): string {
  const raw = res.headers['set-cookie'] as string[];
  if (!raw) return '';
  return raw.map((cookie) => cookie.split(';')[0]).join('; ');
}
