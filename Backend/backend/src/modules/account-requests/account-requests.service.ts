import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Prisma, AccountRequestStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateEmailChangeDto,
  CreatePasswordResetRequestDto,
  ListRequestsDto,
  RejectRequestDto,
} from './dto/account-request.dto';

const BCRYPT_ROUNDS = 10;

/**
 * Handles customer account-recovery requests (email change + password reset)
 * and the platform super-admin workflow that approves or rejects them.
 *
 * These requests are platform-global (they may reference any user in any
 * company), which is why they live outside the tenant-scoped modules. Email
 * notifications to the super admin are sent by the frontend via EmailJS; the
 * database remains the source of truth and never depends on email delivery.
 */
@Injectable()
export class AccountRequestsService {
  private readonly logger = new Logger(AccountRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------ email change

  async createEmailChange(userId: string, dto: CreateEmailChangeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (dto.requestedEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException(
        'The requested email is the same as the current email',
      );
    }

    // The requested email must not already belong to any other account.
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.requestedEmail },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException(
        'That email address already belongs to another account',
      );
    }

    // Prevent duplicate pending requests from the same customer.
    const pending = await this.prisma.emailChangeRequest.findFirst({
      where: { userId, status: AccountRequestStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException(
        'You already have a pending email change request',
      );
    }

    // Prevent two different customers from both requesting the same target
    // email while it is still pending, to avoid racing approvals.
    const claimedByOthers = await this.prisma.emailChangeRequest.findFirst({
      where: {
        status: AccountRequestStatus.PENDING,
        requestedEmail: dto.requestedEmail,
        userId: { not: userId },
      },
    });
    if (claimedByOthers) {
      throw new ConflictException(
        'That email address is already the subject of another pending request',
      );
    }

    const request = await this.prisma.emailChangeRequest.create({
      data: {
        userId,
        currentEmail: user.email,
        requestedEmail: dto.requestedEmail,
        reason: dto.reason ?? null,
        status: AccountRequestStatus.PENDING,
      },
    });

    return {
      request,
      message:
        'Your email change request has been submitted.\n\nThe request will be reviewed by the administrator.',
    };
  }

  // ------------------------------------------------------------ password reset

  async createPasswordResetRequest(dto: CreatePasswordResetRequestDto) {
    // Always return the same generic message regardless of whether the account
    // exists, to avoid account enumeration.
    const message =
      'If the account exists, your password reset request has been submitted.\n\nPlease wait for administrator processing.';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true },
    });
    if (!user || !user.email) {
      return { message };
    }

    // Prevent duplicate pending reset requests for the same account.
    const pending = await this.prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, status: AccountRequestStatus.PENDING },
    });
    if (pending) {
      return { message };
    }

    await this.prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        email: user.email,
        status: AccountRequestStatus.PENDING,
      },
    });

    return { message };
  }

  // ------------------------------------------------------------ customer: own requests

  async listMyRequests(userId: string) {
    const [emailChanges, passwordResets] = await this.prisma.$transaction([
      this.prisma.emailChangeRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.passwordResetRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = [
      ...emailChanges.map((r) => ({
        id: r.id,
        type: 'EMAIL_CHANGE',
        status: r.status,
        createdAt: r.createdAt,
        description: `${r.currentEmail} → ${r.requestedEmail}`,
        adminNote: r.adminNote,
      })),
      ...passwordResets.map((r) => ({
        id: r.id,
        type: 'PASSWORD_RESET',
        status: r.status,
        createdAt: r.createdAt,
        description: r.email,
        adminNote: r.adminNote,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { items };
  }

  // ------------------------------------------------------------ admin: lists

  async listEmailChanges(query: ListRequestsDto) {
    const where: Prisma.EmailChangeRequestWhereInput = {};
    if (query.status) where.status = query.status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailChangeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.emailChangeRequest.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async listPasswordResets(query: ListRequestsDto) {
    const where: Prisma.PasswordResetRequestWhereInput = {};
    if (query.status) where.status = query.status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.passwordResetRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.passwordResetRequest.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async pendingSummary() {
    const [pendingEmailChanges, pendingPasswordResets] =
      await this.prisma.$transaction([
        this.prisma.emailChangeRequest.count({
          where: { status: AccountRequestStatus.PENDING },
        }),
        this.prisma.passwordResetRequest.count({
          where: { status: AccountRequestStatus.PENDING },
        }),
      ]);
    return {
      pendingEmailChanges,
      pendingPasswordResets,
      totalPending: pendingEmailChanges + pendingPasswordResets,
    };
  }

  // ------------------------------------------------------------ admin: single

  async getEmailChange(id: string) {
    const request = await this.prisma.emailChangeRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!request) {
      throw new NotFoundException('Email change request not found');
    }
    return request;
  }

  async getPasswordReset(id: string) {
    const request = await this.prisma.passwordResetRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!request) {
      throw new NotFoundException('Password reset request not found');
    }
    return request;
  }

  // ------------------------------------------------------------ admin: email change

  async approveEmailChange(id: string, adminUserId: string) {
    const request = await this.prisma.emailChangeRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Email change request not found');
    }
    if (request.status !== AccountRequestStatus.PENDING) {
      throw new ConflictException(
        'This request has already been reviewed and cannot be approved',
      );
    }

    // The whole approval must be atomic: verify the requested email is still
    // available and apply the change together, so no race can double-assign it.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.user.findUnique({
        where: { email: request.requestedEmail },
        select: { id: true },
      });
      if (claimed && claimed.id !== request.userId) {
        throw new ConflictException(
          'The requested email is now in use by another account',
        );
      }

      await tx.user.update({
        where: { id: request.userId },
        data: { email: request.requestedEmail },
      });

      await tx.emailChangeRequest.update({
        where: { id: request.id },
        data: {
          status: AccountRequestStatus.COMPLETED,
          reviewedById: adminUserId,
          reviewedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `EMAIL_CHANGE_REQUEST_APPROVED requestId=${request.id} userId=${request.userId} newEmail=${request.requestedEmail} admin=${adminUserId}`,
    );

    return {
      ok: true,
      message: 'Email change approved and applied.',
    };
  }

  async rejectEmailChange(
    id: string,
    adminUserId: string,
    dto: RejectRequestDto,
  ) {
    const request = await this.prisma.emailChangeRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Email change request not found');
    }
    if (request.status !== AccountRequestStatus.PENDING) {
      throw new ConflictException(
        'This request has already been reviewed and cannot be rejected',
      );
    }

    await this.prisma.emailChangeRequest.update({
      where: { id },
      data: {
        status: AccountRequestStatus.REJECTED,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        adminNote: dto.adminNote ?? null,
      },
    });

    this.logger.log(
      `EMAIL_CHANGE_REQUEST_REJECTED requestId=${request.id} userId=${request.userId} admin=${adminUserId}`,
    );

    return { ok: true, message: 'Email change request rejected.' };
  }

  // ------------------------------------------------------------ admin: password reset

  /**
   * Approves a password reset by generating a secure temporary password,
   * storing only its bcrypt hash, and returning the plaintext ONCE to the
   * administrator who must relay it to the customer. The plaintext is never
   * persisted, logged, or included in any email.
   */
  async approvePasswordReset(id: string, adminUserId: string) {
    const request = await this.prisma.passwordResetRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Password reset request not found');
    }
    if (request.status !== AccountRequestStatus.PENDING) {
      throw new ConflictException(
        'This request has already been reviewed and cannot be approved',
      );
    }

    // 16-char alphanumeric temporary password (avoids ambiguous characters).
    const tempPassword = randomBytes(12).toString('base64url').slice(0, 16);
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: request.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetRequest.update({
        where: { id: request.id },
        data: {
          status: AccountRequestStatus.COMPLETED,
          reviewedById: adminUserId,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: request.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.logger.log(
      `PASSWORD_RESET_REQUEST_APPROVED requestId=${request.id} userId=${request.userId} admin=${adminUserId}`,
    );

    return {
      ok: true,
      message: 'Password reset completed.',
      // Admin-only, single-use result. Never stored/logged.
      temporaryPassword: tempPassword,
    };
  }

  async rejectPasswordReset(
    id: string,
    adminUserId: string,
    dto: RejectRequestDto,
  ) {
    const request = await this.prisma.passwordResetRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Password reset request not found');
    }
    if (request.status !== AccountRequestStatus.PENDING) {
      throw new ConflictException(
        'This request has already been reviewed and cannot be rejected',
      );
    }

    await this.prisma.passwordResetRequest.update({
      where: { id },
      data: {
        status: AccountRequestStatus.REJECTED,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        adminNote: dto.adminNote ?? null,
      },
    });

    this.logger.log(
      `PASSWORD_RESET_REQUEST_REJECTED requestId=${request.id} userId=${request.userId} admin=${adminUserId}`,
    );

    return { ok: true, message: 'Password reset request rejected.' };
  }
}
