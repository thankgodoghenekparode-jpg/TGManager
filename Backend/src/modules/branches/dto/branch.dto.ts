import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Branch name is required')
    .max(200)
    .describe('Branch name'),
  address: z
    .string()
    .trim()
    .min(2, 'Address is required')
    .max(500)
    .describe('Branch street address'),
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .describe('Branch latitude in decimal degrees (-90 to 90)'),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .describe('Branch longitude in decimal degrees (-180 to 180)'),
  radiusMeters: z
    .number()
    .positive()
    .max(100000)
    .optional()
    .nullable()
    .describe('Geofence radius in meters (max 100000)'),
  phoneNumber: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable()
    .describe('Branch phone number'),
  openingTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format')
    .optional()
    .nullable()
    .describe('Opening time in HH:mm format'),
  closingTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format')
    .optional()
    .nullable()
    .describe('Closing time in HH:mm format'),
  workingDays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .optional()
    .describe('Working days as day-of-week indices (0=Sunday .. 6=Saturday)'),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('IANA timezone for the branch'),
});

export type CreateBranchDto = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial();
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;
