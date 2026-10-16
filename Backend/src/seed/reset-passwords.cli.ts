import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  BCRYPT_ROUNDS,
  DEFAULT_PASSWORD,
} from '../common/default-password.constants';

/**
 * Reset every account's password back to the platform default.
 *
 * Usage:
 *   npm run reset:passwords
 *
 * Intended for demos / handover so every seeded or invited login shares the
 * same starting credential. Users can change their own password afterwards
 * from the account menu — nothing forces a rotation.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to reset passwords.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
    const { count } = await prisma.user.updateMany({ data: { passwordHash } });
    console.log(
      `🔑  Reset ${count} account password(s) to "${DEFAULT_PASSWORD}".`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
