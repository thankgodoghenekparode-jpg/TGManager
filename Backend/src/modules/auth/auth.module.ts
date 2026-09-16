import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantsModule } from '../tenants/tenants.module';
import { AccountRequestsModule } from '../account-requests/account-requests.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtTokenService } from './jwt-token.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    TenantsModule,
    AccountRequestsModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtTokenService, PasswordResetService],
  exports: [JwtTokenService, PasswordResetService],
})
export class AuthModule {}
