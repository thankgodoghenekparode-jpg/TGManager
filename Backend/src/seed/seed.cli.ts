import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { runSeed } from './seed';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the seed.');
  }
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const result = await runSeed(prisma);
    console.log(
      `Seed complete: plans=${result.plansSeeded}, demo=${result.demoSeeded}, ` +
        `mockSessions=${result.mockSessionsSeeded}, ` +
        `schoolResults=${result.schoolResults.resultsCreated} created / ` +
        `${result.schoolResults.resultsExisting} existing, ` +
        `timetable=${result.schoolTimetable.periodsCreated} created / ` +
        `${result.schoolTimetable.periodsExisting} existing, ` +
        `studentLogins=${result.studentLogins.created} created / ` +
        `${result.studentLogins.alreadyLinked} existing`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
