import * as bcrypt from 'bcrypt';
import { DEFAULT_PASSWORD } from '../common/default-password.constants';
import { derivedLoginEmail } from '../common/login-email.util';
import { PrismaClient } from '../generated/prisma/client';
import {
  SYSTEM_ROLE_DEFS,
  SYSTEM_ROLE_NAMES,
} from '../modules/rbac/system-roles/system-roles.constants';
import { DEMO_SCHOOL_SLUG } from './school-results-seed';

export interface SeedStudentLoginsResult {
  /** Number of students that already had a login and were left untouched. */
  alreadyLinked: number;
  /** Number of student logins created by this run. */
  created: number;
}

/**
 * Backfills portal logins for students who predate enrolment-time provisioning.
 *
 * New students get their login automatically when they are enrolled; this seed
 * exists purely to bring the already-seeded demo students up to the same state
 * so the demo can be explored immediately.
 *
 * Idempotent: any student that already has a `userId` is skipped.
 */
export async function seedStudentLogins(
  prisma: PrismaClient,
): Promise<SeedStudentLoginsResult> {
  const summary: SeedStudentLoginsResult = { alreadyLinked: 0, created: 0 };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SCHOOL_SLUG },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    console.log(
      `   Student logins seed skipped: demo school (${DEMO_SCHOOL_SLUG}) not found.`,
    );
    return summary;
  }

  let studentRole = await prisma.companyRole.findFirst({
    where: { tenantId: tenant.id, name: SYSTEM_ROLE_NAMES.STUDENT },
  });
  if (!studentRole) {
    studentRole = await prisma.companyRole.create({
      data: {
        tenantId: tenant.id,
        name: SYSTEM_ROLE_NAMES.STUDENT,
        description: SYSTEM_ROLE_DEFS.STUDENT.description,
        isSystem: true,
        permissions: [...SYSTEM_ROLE_DEFS.STUDENT.permissions],
      },
    });
  }

  const students = await prisma.student.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      userId: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const student of students) {
    if (student.userId) {
      summary.alreadyLinked += 1;
      continue;
    }

    const email =
      student.email?.trim().toLowerCase() ||
      derivedLoginEmail(student.admissionNumber, tenant.slug, 'students');

    await prisma.$transaction(async (tx) => {
      let account = await tx.user.findUnique({ where: { email } });
      if (!account) {
        account = await tx.user.create({
          data: {
            email,
            firstName: student.firstName,
            lastName: student.lastName,
            passwordHash,
            role: 'USER',
          },
        });
      }

      await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: account.id } },
        create: { tenantId: tenant.id, userId: account.id },
        update: {},
      });

      const assignment = await tx.roleAssignment.findFirst({
        where: {
          tenantId: tenant.id,
          userId: account.id,
          companyRoleId: studentRole.id,
          branchId: null,
        },
      });
      if (!assignment) {
        await tx.roleAssignment.create({
          data: {
            tenantId: tenant.id,
            userId: account.id,
            companyRoleId: studentRole.id,
          },
        });
      }

      await tx.student.update({
        where: { id: student.id },
        data: { userId: account.id },
      });
    });

    summary.created += 1;
  }

  return summary;
}
