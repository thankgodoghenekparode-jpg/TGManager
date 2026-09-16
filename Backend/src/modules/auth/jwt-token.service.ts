import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/authenticated-request.interface';

export interface TokenContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issueAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      userRole: user.role,
      type: 'access',
    };
    const expiresIn = (this.config.get<string>('JWT_ACCESS_TTL') ??
      '15m') as StringValue;
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
    });
  }

  async issueRefreshToken(user: User, ctx: TokenContext): Promise<string> {
    const tokenId = randomUUID();
    const ttlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS') ?? 30;
    const expiresIn = `${ttlDays}d` as StringValue;
    const token = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh', jti: tokenId } satisfies JwtPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        userAgent: ctx.userAgent,
        ip: ctx.ip,
      },
    });

    return token;
  }

  async rotateRefreshToken(token: string, ctx: TokenContext) {
    const payload = await this.verifyRefreshToken(token);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user, ctx);
    return { accessToken, refreshToken, user };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    if (!token) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (stored && !stored.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('Invalid token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
