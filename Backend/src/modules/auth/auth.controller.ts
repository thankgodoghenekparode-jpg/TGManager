import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../../common/constants/cookies';
import { CSRF_COOKIE } from '../../common/csrf/csrf.constants';
import { generateCsrfToken } from '../../common/csrf/csrf.util';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { JwtPayload } from '../../common/types/authenticated-request.interface';
import { ttlToMs } from '../../common/utils/ttl.util';
import { AuthService } from './auth.service';
import { loginSchema } from './dto/login.dto';
import type { LoginDto } from './dto/login.dto';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './dto/password.dto';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { createPasswordResetRequestSchema } from '../account-requests/dto/account-request.dto';
import type { CreatePasswordResetRequestDto } from '../account-requests/dto/account-request.dto';
import { JwtTokenService } from './jwt-token.service';
import type { TokenContext } from './jwt-token.service';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokens: JwtTokenService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in',
    description:
      'Authenticates with email and password and sets the auth cookies. Returns the logged-in user.',
  })
  @ApiBody({ schema: schemaRef('LoginDto') })
  @ApiOkResponse({ description: 'Logged in; auth cookies set.' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.context(req));
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh the session',
    description:
      'Rotates the refresh token (read from the cookie) and re-issues the access cookie. Returns the user, or null when no session exists.',
  })
  @ApiOkResponse({ description: 'Session refreshed; new cookies set.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;
    if (!refreshToken) {
      this.clearAuthCookies(res);
      return { user: null };
    }

    try {
      const result = await this.tokens.rotateRefreshToken(
        refreshToken,
        this.context(req),
      );
      this.setAuthCookies(res, result);
      const { passwordHash: _ph, ...user } = result.user;
      return { user };
    } catch {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Session expired, please log in again');
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Log out',
    description: 'Revokes the refresh token and clears the auth cookies.',
  })
  @ApiNoContentResponse({ description: 'Logged out; cookies cleared.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;
    if (refreshToken) {
      await this.tokens.revokeRefreshToken(refreshToken);
    }
    this.clearAuthCookies(res);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get the current user',
    description: 'Returns the profile of the authenticated user.',
  })
  @ApiOkResponse({ description: 'Current user profile.' })
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password',
    description:
      'Changes the password of the authenticated user and revokes all ' +
      'existing sessions (refresh tokens).',
  })
  @ApiBody({ schema: schemaRef('ChangePasswordDto') })
  @ApiOkResponse({ description: 'Password changed; other sessions revoked.' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset',
    description:
      'Sends a password reset link to the given email when the account ' +
      'exists. Always returns a generic response to prevent account ' +
      'enumeration. Emails are only sent when SMTP is configured; otherwise ' +
      'the token is logged server-side for development.',
  })
  @ApiBody({ schema: schemaRef('ForgotPasswordDto') })
  @ApiOkResponse({ description: 'Generic response, regardless of existence.' })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('password-reset-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit a password reset request',
    description:
      'Creates a PENDING password reset request that a super admin reviews. ' +
      'No email is sent to the customer and the password is not changed ' +
      'automatically. Always returns a generic response to prevent account ' +
      'enumeration.',
  })
  @ApiBody({ schema: schemaRef('CreatePasswordResetRequestDto') })
  @ApiOkResponse({
    description: 'Generic response, regardless of whether the account exists.',
  })
  async createPasswordResetRequest(
    @Body(new ZodValidationPipe(createPasswordResetRequestSchema))
    dto: CreatePasswordResetRequestDto,
  ) {
    return this.authService.createPasswordResetRequest(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with a token',
    description:
      'Consumes a single-use password reset token and sets a new password. ' +
      'All existing sessions are revoked.',
  })
  @ApiBody({ schema: schemaRef('ResetPasswordDto') })
  @ApiOkResponse({ description: 'Password reset; all sessions revoked.' })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(dto);
  }

  private context(req: Request): TokenContext {
    return {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
  }

  private setAuthCookies(res: Response, tokens: AuthTokens): void {
    const cookieOptions = this.authCookieOptions();
    const accessTtlMs = ttlToMs(this.config.get('JWT_ACCESS_TTL') ?? '15m');
    const refreshTtlDays =
      this.config.get<number>('JWT_REFRESH_TTL_DAYS') ?? 30;
    const refreshTtlMs = refreshTtlDays * 24 * 60 * 60 * 1000;

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...cookieOptions,
      maxAge: accessTtlMs,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: refreshTtlMs,
    });
    res.cookie(CSRF_COOKIE, generateCsrfToken(), {
      ...cookieOptions,
      httpOnly: false,
      maxAge: refreshTtlMs,
    });
  }

  private authCookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
  } {
    const secure =
      this.config.get('COOKIE_SECURE') === 'true' ||
      this.config.get('NODE_ENV') === 'production';
    const sameSite =
      this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE') ?? 'lax';
    return { httpOnly: true, secure, sameSite, path: '/' };
  }

  private clearAuthCookies(res: Response): void {
    const { secure, sameSite, path } = this.authCookieOptions();
    res.clearCookie(ACCESS_TOKEN_COOKIE, { secure, sameSite, path });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { secure, sameSite, path });
    res.clearCookie(CSRF_COOKIE, { secure, sameSite, path });
  }
}
