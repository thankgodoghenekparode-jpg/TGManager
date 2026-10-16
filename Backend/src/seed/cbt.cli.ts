import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedCbt } from './cbt-seed';

/**
 * CLI for the demo school's CBT practice bank and examinations.
 *
 * Usage:
 *   npm run seed:cbt   # create demo questions and exams (idempotent)
 *
 * Safe to run repeatedly: if the demo school already has CBT questions the
 * seed leaves the existing bank untouched.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed the demo CBT bank.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🌱  Seeding demo CBT questions and examinations…');
    const result = await seedCbt(prisma);
    console.log(
      `Done. topics=${result.topics}, questions=${result.questions}, exams=${result.exams}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
