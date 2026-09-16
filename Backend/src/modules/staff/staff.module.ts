import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PlansModule } from '../plans/plans.module';
import { AuthModule } from '../auth/auth.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [AuditModule, PlansModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
