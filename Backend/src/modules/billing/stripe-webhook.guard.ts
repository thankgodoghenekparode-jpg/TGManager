import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { StripeEvent, StripeService } from './stripe.service';

export interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
  stripeEvent?: StripeEvent;
}

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  constructor(private readonly stripe: StripeService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StripeWebhookRequest>();
    const signature = request.headers['stripe-signature'] as string | undefined;
    request.stripeEvent = this.stripe.verifyWebhookSignature(
      request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
      signature ?? '',
    );
    return true;
  }
}
