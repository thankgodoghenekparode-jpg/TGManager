import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { BillingService } from './billing.service';
import { StripeWebhookGuard } from './stripe-webhook.guard';
import type { StripeWebhookRequest } from './stripe-webhook.guard';
import { checkoutSchema } from './dto/billing.dto';
import type { CheckoutDto } from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @UseGuards(AccessGuard)
  @Permissions(PERMISSIONS.TENANT_VIEW)
  getBillingStatus(@Req() req: PermissionRequest) {
    return this.billing.getStatus(req.tenant.id);
  }

  @Post('checkout')
  @UseGuards(AccessGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @HttpCode(200)
  async startCheckout(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(checkoutSchema)) dto: CheckoutDto,
  ) {
    return this.billing.startCheckout(req.tenant.id, dto.planCode);
  }

  @Post('webhook')
  @Public()
  @UseGuards(StripeWebhookGuard)
  @HttpCode(200)
  async handleWebhook(@Req() req: StripeWebhookRequest) {
    const event = req.stripeEvent!;
    switch (event.type) {
      case 'checkout.session.completed':
        await this.billing.handleCheckoutCompleted(event.data.object as never);
        break;
      case 'customer.subscription.updated':
        await this.billing.handleSubscriptionUpdated(
          event.data.object as never,
        );
        break;
      case 'customer.subscription.deleted':
        await this.billing.handleSubscriptionDeleted(
          event.data.object as never,
        );
        break;
      default:
        break;
    }
    return { received: true };
  }
}
