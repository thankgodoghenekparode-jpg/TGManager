import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');

if (existsSync(join(root, '.env.test'))) {
  dotenv.config({ path: join(root, '.env.test') });
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://zarox:zarox@localhost:5432/zarox_connect_test';
}
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL_DAYS ??= '30';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.COOKIE_SECURE ??= 'false';
