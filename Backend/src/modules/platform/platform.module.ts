import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DistributedLockModule } from '../../common/locks/distributed-lock.module';
import { AuditModule } from '../audit/audit.module';
import { PlansModule } from '../plans/plans.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [
    PrismaModule,
    PlansModule,
    AuditModule,
    TenantsModule,
    AuthModule,
    DistributedLockModule,
  ],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
