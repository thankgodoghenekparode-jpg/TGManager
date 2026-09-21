import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DistributedLockModule } from '../../common/locks/distributed-lock.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationApiKeyGuard } from './guards/integration-api-key.guard';
import { IntegrationsDeliveryService } from './integrations-delivery.service';

@Module({
  imports: [
    AuditModule,
    NotificationsModule,
    ConfigModule,
    DistributedLockModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationApiKeyGuard,
    IntegrationsDeliveryService,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
