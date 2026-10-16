import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedStudentLogins } from './school-student-logins-seed';

/**
 * Backfill demo-student logins.
 *
 * Usage:
 *   npm run seed:student-logins   # idempotent
 *
 * New students get a login automatically on enrolment; this only exists to
 * bring the pre-existing seeded students up to the same state.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed student logins.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🌱  Backfilling demo student logins…');
    const result = await seedStudentLogins(prisma);
    console.log(
      `Done. created=${result.created}, alreadyLinked=${result.alreadyLinked}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
