import { z } from 'zod';

export const checkoutSchema = z.object({
  planCode: z.string().min(1),
});

export type CheckoutDto = z.infer<typeof checkoutSchema>;
