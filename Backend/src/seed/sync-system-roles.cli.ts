import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { SYSTEM_ROLE_DEFS } from '../modules/rbac/system-roles/system-roles.constants';

interface SystemRoleDefLike {
  name: string;
  permissions: readonly string[];
}

/**
 * Backfill the permissions of existing per-tenant system roles (`CompanyRole`
 * rows with `isSystem = true`) so tenants created before a permission was
 * introduced receive it — without clobbering anything.
 *
 * The update is additive: a role's stored permissions are merged with the
 * current {@link SYSTEM_ROLE_DEFS} grant, newest permissions appended. Nothing
 * is ever removed, so tenant-side customisation is preserved.
 *
 * Usage:
 *   npm run roles:sync              # apply
 *   npm run roles:sync -- --dry-run # preview only
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to sync system roles.');
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const defByName = new Map<string, readonly string[]>(
    (Object.values(SYSTEM_ROLE_DEFS) as SystemRoleDefLike[]).map((def) => [
      def.name,
      def.permissions,
    ]),
  );

  try {
    const roles = await prisma.companyRole.findMany({
      where: { isSystem: true },
      select: { id: true, tenantId: true, name: true, permissions: true },
    });

    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    const updatedByRole: Record<string, number> = {};

    for (const role of roles) {
      const def = defByName.get(role.name);
      if (!def) {
        // A system role name we no longer manage; leave it untouched.
        skipped++;
        continue;
      }

      const current = new Set(role.permissions);
      const missing = def.filter((permission) => !current.has(permission));

      if (missing.length === 0) {
        unchanged++;
        continue;
      }

      if (!dryRun) {
        await prisma.companyRole.update({
          where: { id: role.id },
          data: { permissions: [...role.permissions, ...missing] },
        });
      }

      updated++;
      updatedByRole[role.name] = (updatedByRole[role.name] ?? 0) + 1;
    }

    const prefix = dryRun ? '[dry-run] would update' : 'updated';
    console.log(
      `${dryRun ? '[dry-run] ' : ''}Scanned ${roles.length} system role(s) across tenants.`,
    );
    console.log(`${prefix} ${updated}; already current ${unchanged}; unmanaged ${skipped}.`);
    for (const [name, count] of Object.entries(updatedByRole).sort()) {
      console.log(`  ${name}: ${count}`);
    }
    if (updated > 0 && dryRun) {
      console.log('Re-run without --dry-run to apply.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
