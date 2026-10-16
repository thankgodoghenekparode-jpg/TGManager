import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

export interface CbtStudentRef {
  id: string;
  status: string;
  currentClassId: string | null;
  firstName: string;
  lastName: string;
}

/**
 * Resolves the student record behind the signed-in user.
 *
 * Every student-facing CBT route goes through this so an account without an
 * (active) student record can never touch attempts, even if its RBAC role
 * happens to include `cbt.take`.
 */
export async function requireStudentRecord(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
): Promise<CbtStudentRef> {
  const student = await prisma.student.findFirst({
    where: { tenantId, userId },
    select: {
      id: true,
      status: true,
      currentClassId: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!student) {
    throw new ForbiddenException(
      'This account is not linked to a student record in this school.',
    );
  }
  if (student.status !== 'ACTIVE') {
    throw new ForbiddenException(
      'Your student record is not active. Please contact the school office.',
    );
  }
  return student;
}
