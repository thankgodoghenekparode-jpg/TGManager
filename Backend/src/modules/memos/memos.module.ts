import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MemosController } from './memos.controller';
import { MemosService } from './memos.service';

@Module({
  imports: [NotificationsModule, AuditModule],
  controllers: [MemosController],
  providers: [MemosService],
  exports: [MemosService],
})
export class MemosModule {}
