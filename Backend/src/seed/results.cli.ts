import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedSchoolResults } from './school-results-seed';

/**
 * CLI for the demo school's term results.
 *
 * Usage:
 *   npm run seed:results    # fill in results for the demo school (idempotent)
 *
 * Safe to run repeatedly: existing scores are never overwritten, only missing
 * student × subject × term rows are inserted.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed demo results.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🌱  Seeding demo school term results…');
    const result = await seedSchoolResults(prisma);
    console.log(
      `Done. terms=${result.terms}, students=${result.students}, ` +
        `created=${result.resultsCreated}, existing=${result.resultsExisting}, ` +
        `approvals=${result.approvalsCreated}, ` +
        `positionsCorrected=${result.positionsCorrected}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
