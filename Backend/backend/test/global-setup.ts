import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Runs once before the whole e2e suite: points Prisma at the test database
 * and applies all migrations so the schema is current.
 */
export default function globalSetup(): void {
  const root = join(__dirname, '..');

  if (existsSync(join(root, '.env.test'))) {
    dotenv.config({ path: join(root, '.env.test') });
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://zarox:zarox@localhost:5432/zarox_connect_test';
  }

  execSync('npx prisma migrate deploy', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}
