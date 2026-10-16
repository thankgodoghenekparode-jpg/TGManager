import { PrismaClient } from '../generated/prisma/client';
import { DEMO_SCHOOL_SLUG } from './school-results-seed';
import {
  resetCbtForTenant,
  seedCbtDefaults,
  type SeedDefaultsResult,
} from '../modules/cbt/cbt-defaults';

export type SeedCbtResult = SeedDefaultsResult;

export interface SeedCbtOptions {
  /** Delete the demo school's existing CBT data before seeding. */
  reset?: boolean;
}

/**
 * Seeds the demo school's CBT practice bank and one examination per category
 * (WAEC, NECO, JAMB and Mock Examination).
 *
 * Idempotent per category, so re-running is safe. Pass `{ reset: true }` (the
 * CLI's `--reset` flag) to wipe the demo school's CBT data first and write a
 * clean set.
 */
export async function seedCbt(
  prisma: PrismaClient,
  options: SeedCbtOptions = {},
): Promise<SeedCbtResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SCHOOL_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.log(`   CBT seed skipped: demo school (${DEMO_SCHOOL_SLUG}) not found.`);
    return { questions: 0, exams: 0, topics: 0, skipped: [] };
  }

  if (options.reset) {
    await resetCbtForTenant(prisma, tenant.id);
    console.log('   CBT seed: existing demo CBT data cleared (--reset).');
  }

  const author = await prisma.schoolStaff.findFirst({
    where: { tenantId: tenant.id, email: 'teacher.math@tgeasymodel.edu.ng' },
    select: { userId: true },
  });

  const result = await seedCbtDefaults(prisma, tenant.id, {
    createdByUserId: author?.userId ?? null,
  });
  if (result.skipped.length > 0) {
    console.log(
      `   CBT seed: left existing content for ${result.skipped.join(', ')} untouched.`,
    );
  }
  return result;
}
