import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountRequestsService } from './account-requests.service';
import { AccountController } from './account.controller';
import { AdminAccountRequestsController } from './admin-account-requests.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AccountController, AdminAccountRequestsController],
  providers: [AccountRequestsService],
  exports: [AccountRequestsService],
})
export class AccountRequestsModule {}
