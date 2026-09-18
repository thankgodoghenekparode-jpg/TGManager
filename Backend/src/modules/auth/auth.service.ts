import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtTokenService, TokenContext } from './jwt-token.service';
import { PasswordResetService } from './password-reset.service';
import { AccountRequestsService } from '../account-requests/account-requests.service';
import { LoginDto } from './dto/login.dto';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';
import type { CreatePasswordResetRequestDto } from '../account-requests/dto/account-request.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly tokens: JwtTokenService,
    private readonly passwordReset: PasswordResetService,
    private readonly accountRequests: AccountRequestsService,
  ) {}

  async login(dto: LoginDto, ctx: TokenContext) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.tokens.issueAccessToken(user);
    const refreshToken = await this.tokens.issueRefreshToken(user, ctx);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const memberships = await this.tenantsService.getMyTenants(user.id);

    return {
      user: this.sanitizeUser(user),
      memberships,
      accessToken,
      refreshToken,
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const memberships = await this.tenantsService.getMyTenants(userId);
    return { user: this.sanitizeUser(user), memberships };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.revokeAllRefreshTokens(userId),
    ]);

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user && user.isActive) {
      await this.passwordReset.issueAndEmailForUser(user.id, user.email);
    }

    return {
      message:
        'If that email is registered, a password reset link has been sent.',
    };
  }

  /**
   * Creates a manual PASSWORD reset request that a super admin reviews and
   * approves. Unlike `forgotPassword` (which emails a reset link), this does
   * not email the customer and never changes the password automatically.
   */
  async createPasswordResetRequest(dto: CreatePasswordResetRequestDto) {
    return this.accountRequests.createPasswordResetRequest(dto);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.revokeAllRefreshTokens(record.userId),
    ]);

    return { success: true };
  }

  private revokeAllRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private sanitizeUser(user: User) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
