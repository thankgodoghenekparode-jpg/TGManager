import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../../common/mailer/mailer.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issues a single-use password-reset token for the given user and emails the
   * reset link to them. If email delivery fails (no SMTP configured/error), the
   * raw token is logged server-side for development so it can still be shared.
   */
  async issueAndEmailForUser(
    userId: string,
    email: string,
  ): Promise<{ sent: boolean; token?: string }> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    const sent = await this.mailer.sendPasswordReset(email, resetUrl);
    if (!sent) {
      this.logger.log(
        `Password reset token for ${email}: ${rawToken} ` +
          '(email not delivered; share this token directly)',
      );
      return { sent: false, token: rawToken };
    }

    return { sent: true };
  }
}
