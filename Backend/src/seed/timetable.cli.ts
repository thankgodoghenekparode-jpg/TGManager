import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedSchoolTimetable } from './school-timetable-seed';

/**
 * CLI for the demo school's weekly timetable.
 *
 * Usage:
 *   npm run seed:timetable   # build a full demo timetable (idempotent)
 *
 * Safe to run repeatedly: if the demo school already has any periods the seed
 * leaves the existing timetable untouched.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed the demo timetable.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🌱  Seeding demo school timetable…');
    const result = await seedSchoolTimetable(prisma);
    console.log(
      `Done. classes=${result.classes}, created=${result.periodsCreated}, ` +
        `existing=${result.periodsExisting}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
