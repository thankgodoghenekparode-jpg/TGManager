import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  cleanupSchoolSessions,
  MOCK_SESSION_NAMES,
  seedSchoolSessions,
} from './school-sessions-seed';

/**
 * CLI for the mock academic sessions.
 *
 * Usage:
 *   npm run seed:sessions            # load the mock sessions (idempotent)
 *   npm run seed:sessions:cleanup    # delete the mock sessions again
 *
 * The `--cleanup` flag is also accepted directly, e.g.
 *   npx tsx src/seed/sessions.cli.ts --cleanup
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to manage mock sessions.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const shouldCleanup = process.argv.includes('--cleanup');

  try {
    if (shouldCleanup) {
      console.log('🧹  Removing mock academic sessions…');
      const result = await cleanupSchoolSessions(prisma);
      console.log(
        `Done. sessionsRemoved=${result.sessions}, termsRemoved=${result.terms}`,
      );
    } else {
      console.log('🌱  Loading mock academic sessions…');
      const created = await seedSchoolSessions(prisma);
      console.log(
        `Done. sessionsCreated=${created} (managed: ${MOCK_SESSION_NAMES.join(' | ')})`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
