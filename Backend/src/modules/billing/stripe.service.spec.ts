import { createHmac } from 'crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { StripeService } from './stripe.service';

const SECRET = 'sk_test_123';
const WEBHOOK_SECRET = 'whsec_test_456';

describe('StripeService', () => {
  let service: StripeService;

  const configOf = (overrides: Record<string, string> = {}) =>
    ({
      get: (key: string) =>
        ({
          STRIPE_SECRET_KEY: SECRET,
          STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
          ...overrides,
        })[key],
    }) as unknown as ConfigService;

  const makeService = (config: ConfigService) => {
    const provider = new StripeService(config);
    return provider;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: configOf() },
      ],
    }).compile();
    service = moduleRef.get(StripeService);
  });

  describe('isConfigured', () => {
    it('reflects the presence of STRIPE_SECRET_KEY', () => {
      expect(service.isConfigured).toBe(true);
      expect(
        makeService(configOf({ STRIPE_SECRET_KEY: '' })).isConfigured,
      ).toBe(false);
    });
  });

  describe('createCheckoutSession', () => {
    it('posts a subscription session with the expected form body', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'cs_1',
            url: 'https://checkout.stripe.com/c/pay/cs_1',
          }),
      } as unknown as Response);

      const result = await service.createCheckoutSession({
        customerId: 'cus_1',
        planName: 'Pro',
        priceCents: 4900,
        successUrl: 'https://app.example/settings/billing?checkout=success',
        cancelUrl: 'https://app.example/settings/billing?checkout=cancelled',
        metadata: { tenantId: 't1', planCode: 'pro' },
      });

      expect(result.id).toBe('cs_1');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
      expect(init.method).toBe('POST');
      const authorization = init.headers as Record<string, string>;
      expect(authorization.Authorization).toBe(
        `Basic ${Buffer.from(`${SECRET}:`, 'utf8').toString('base64')}`,
      );
      const body = init.body as string;
      expect(body).toContain('mode=subscription');
      expect(body).toContain(
        'line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd',
      );
      expect(body).toContain('metadata%5BtenantId%5D=t1');
      expect(body).toContain('metadata%5BplanCode%5D=pro');

      fetchMock.mockRestore();
    });

    it('throws when the secret key is missing', async () => {
      const unconfigured = makeService(configOf({ STRIPE_SECRET_KEY: '' }));
      await expect(
        unconfigured.createCheckoutSession({
          customerId: 'cus_1',
          planName: 'Pro',
          priceCents: 4900,
          successUrl: 'https://example.com',
          cancelUrl: 'https://example.com',
          metadata: { tenantId: 't1', planCode: 'pro' },
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('verifyWebhookSignature', () => {
    const payload = Buffer.from(
      JSON.stringify({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {},
      }),
    );
    const now = Math.floor(Date.now() / 1000);

    it('accepts a valid signature and returns the event', () => {
      const v1 = createHmac('sha256', WEBHOOK_SECRET)
        .update(`${now}.${payload.toString('utf8')}`)
        .digest('hex');
      const event = service.verifyWebhookSignature(
        payload,
        `t=${now},v1=${v1}`,
      );
      expect(event.type).toBe('checkout.session.completed');
    });

    it('rejects a signature produced with a different secret', () => {
      const v1 = createHmac('sha256', 'wrong_secret')
        .update(`${now}.${payload.toString('utf8')}`)
        .digest('hex');
      expect(() =>
        service.verifyWebhookSignature(payload, `t=${now},v1=${v1}`),
      ).toThrow(UnauthorizedException);
    });

    it('rejects a missing header', () => {
      expect(() => service.verifyWebhookSignature(payload, '')).toThrow(
        UnauthorizedException,
      );
    });
  });
});
