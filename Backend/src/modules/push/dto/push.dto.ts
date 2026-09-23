import { z } from 'zod';

/** Expo push tokens look like `ExponentPushToken[…`, web push endpoints are HTTPS URLs. */
export const isExpoToken = (endpoint: string): boolean =>
  endpoint.startsWith('ExponentPushToken[');

export const subscriptionSchema = z
  .object({
    subscription: z.object({
      endpoint: z.string().min(1),
      keys: z
        .object({
          p256dh: z.string().min(1),
          auth: z.string().min(1),
        })
        .optional(),
    }),
  })
  .superRefine((value, ctx) => {
    const { endpoint, keys } = value.subscription;
    if (isExpoToken(endpoint)) return;
    if (!endpoint.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subscription', 'endpoint'],
        message: 'endpoint must be an HTTPS URL or an Expo push token',
      });
    }
    if (!keys) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subscription', 'keys'],
        message: 'keys are required for web push subscriptions',
      });
    }
  });

export type SubscriptionDto = z.infer<typeof subscriptionSchema>;

export const endpointSchema = z.object({
  endpoint: z.string().min(1),
});

export type EndpointDto = z.infer<typeof endpointSchema>;
