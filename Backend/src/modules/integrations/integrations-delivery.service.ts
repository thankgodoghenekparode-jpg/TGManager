import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DistributedLockService } from '../../common/locks/distributed-lock.service';
import { IntegrationsService } from './integrations.service';

@Injectable()
export class IntegrationsDeliveryService {
  private readonly logger = new Logger(IntegrationsDeliveryService.name);

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly locks: DistributedLockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPending() {
    await this.locks.runOnce('integrations-delivery', 3 * 60_000, () =>
      this.processDeliveries(),
    );
  }

  private async processDeliveries() {
    try {
      await this.integrations.processPendingDeliveries();
    } catch (error) {
      this.logger.error(
        `Webhook delivery processing failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
