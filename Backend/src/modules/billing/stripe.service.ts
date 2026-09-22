import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { STRIPE_DEFAULT_CURRENCY } from './billing.constants';

export interface CreateCheckoutParams {
  customerId: string;
  planName: string;
  priceCents: number;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface StripeCustomer {
  id: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customer?: string;
  subscription?: string;
  metadata: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  metadata: Record<string, string>;
}

export interface StripeEvent {
  type: string;
  id: string;
  data: { object: Record<string, unknown> };
}

/** Minimal typed subset of the Stripe API surface (no SDK dependency). */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly baseUrl = 'https://api.stripe.com';
  private readonly secretKey?: string;
  private readonly webhookSecret?: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  get isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  get configuredWebhook(): boolean {
    return Boolean(this.webhookSecret);
  }

  createCustomer(email: string): Promise<StripeCustomer> {
    const body = this.formEncode({ email, description: 'TGManager tenant' });
    return this.post<StripeCustomer>('/v1/customers', body);
  }

  createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<StripeCheckoutSession> {
    const {
      customerId,
      planName,
      priceCents,
      successUrl,
      cancelUrl,
      metadata,
    } = params;
    const body = this.formEncode({
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price_data][currency]': STRIPE_DEFAULT_CURRENCY,
      'line_items[0][price_data][unit_amount]': String(priceCents),
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][product_data][name]': planName,
      'line_items[0][quantity]': '1',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: 'true',
      'metadata[tenantId]': metadata.tenantId,
      'metadata[planCode]': metadata.planCode,
    });
    return this.post<StripeCheckoutSession>('/v1/checkout/sessions', body);
  }

  /**
   * Verifies a Stripe webhook signature over the raw request body and
   * returns the parsed event. Throws when the secret is unset or the
   * signature/timestamp fails validation.
   */
  verifyWebhookSignature(payload: Buffer, signature: string): StripeEvent {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('Webhook not configured');
    }
    if (!signature) {
      throw new UnauthorizedException('Missing Stripe-Signature header');
    }

    const parts = new Map<string, string>();
    for (const chunk of signature.split(',')) {
      const [key, value] = chunk.split('=', 2);
      if (key) parts.set(key, value ?? '');
    }
    const timestamp = parts.get('t');
    const expected = parts.get('v1');
    if (!timestamp || !expected) {
      throw new UnauthorizedException('Malformed Stripe signature');
    }

    const t = Number(timestamp);
    if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) {
      throw new UnauthorizedException(
        'Stripe signature timestamp out of range',
      );
    }

    const signedPayload = `${timestamp}.${payload.toString('utf8')}`;
    const digest = createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const digestBuffer = Buffer.from(digest, 'hex');
    if (
      expectedBuffer.length !== digestBuffer.length ||
      !timingSafeEqual(expectedBuffer, digestBuffer)
    ) {
      throw new UnauthorizedException('Stripe signature mismatch');
    }

    return JSON.parse(payload.toString('utf8')) as StripeEvent;
  }

  private async post<T>(path: string, formBody: string): Promise<T> {
    if (!this.secretKey) {
      throw new ServiceUnavailableException(
        'Billing is not configured (missing STRIPE_SECRET_KEY)',
      );
    }
    const authorization = `Basic ${Buffer.from(
      `${this.secretKey}:`,
      'utf8',
    ).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const json = (await response.json()) as Record<string, unknown> & {
      error?: { message?: string };
    };
    if (!response.ok) {
      this.logger.error(
        `Stripe ${path} failed (${response.status}): ${json.error?.message ?? 'unknown error'}`,
      );
      throw new ServiceUnavailableException('Stripe request failed');
    }
    return json as T;
  }

  private formEncode(params: Record<string, string>): string {
    return new URLSearchParams(params).toString();
  }
}
