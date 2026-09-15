import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationsService } from './integrations.service';

@Injectable()
export class IntegrationsDeliveryService {
  private readonly logger = new Logger(IntegrationsDeliveryService.name);

  constructor(private readonly integrations: IntegrationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPending() {
    try {
      await this.integrations.processPendingDeliveries();
    } catch (error) {
      this.logger.error(
        `Webhook delivery processing failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
