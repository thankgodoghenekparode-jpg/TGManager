import { z } from 'zod';

export const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

export type SubscriptionDto = z.infer<typeof subscriptionSchema>;

export const endpointSchema = z.object({
  endpoint: z.string().url(),
});

export type EndpointDto = z.infer<typeof endpointSchema>;
