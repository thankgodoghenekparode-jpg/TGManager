import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { StripeWebhookGuard } from './stripe-webhook.guard';

@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeService, StripeWebhookGuard],
  exports: [BillingService, StripeService],
})
export class BillingModule {}
