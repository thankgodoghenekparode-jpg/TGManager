import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedCbt } from './cbt-seed';
import { seedCbtDefaults } from '../modules/cbt/cbt-defaults';

/**
 * CLI for the CBT default question banks and examinations.
 *
 * Usage:
 *   npm run seed:cbt            # fill any missing categories on the demo school
 *   npm run seed:cbt -- --reset # wipe the demo school's CBT data and reseed
 *   npm run seed:cbt -- --all   # backfill every SCHOOL tenant missing a category
 *
 * Safe to run repeatedly: a category that already has questions is skipped.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed CBT defaults.');
  }

  const args = new Set(process.argv.slice(2));
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    if (args.has('--all')) {
      console.log('🌱  Backfilling CBT defaults for every school tenant…');
      const tenants = await prisma.tenant.findMany({
        where: { type: 'SCHOOL' },
        select: { id: true, name: true, slug: true },
      });
      for (const tenant of tenants) {
        const result = await seedCbtDefaults(prisma, tenant.id);
        console.log(
          `   ${tenant.name} (${tenant.slug}): +${result.questions} questions, +${result.exams} exams` +
            (result.skipped.length ? `, skipped ${result.skipped.join('/')}` : ''),
        );
      }
      console.log(`Done. Processed ${tenants.length} school tenant(s).`);
      return;
    }

    console.log('🌱  Seeding demo CBT question banks and examinations…');
    const result = await seedCbt(prisma, { reset: args.has('--reset') });
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
