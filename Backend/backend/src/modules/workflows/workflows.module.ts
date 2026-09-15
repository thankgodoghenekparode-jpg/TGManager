import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { EscalationService } from './escalation.service';

@Module({
  imports: [NotificationsModule, AuditModule, ScheduleModule.forRoot()],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, EscalationService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
