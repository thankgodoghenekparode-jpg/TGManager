import { z } from 'zod';
import { isValidTimeZone } from '../../../common/utils/time.util';

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format')
  .describe('Time in HH:MM (24h) format');

export const workingDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .describe('Working days as day-of-week indices (0=Sunday .. 6=Saturday)');

export const saveSettingsSchema = z
  .object({
    defaultLatitude: z.coerce
      .number()
      .min(-90)
      .max(90)
      .optional()
      .describe('Default clock-in latitude when a branch has no location'),
    defaultLongitude: z.coerce
      .number()
      .min(-180)
      .max(180)
      .optional()
      .describe('Default clock-in longitude when a branch has no location'),
    defaultRadiusMeters: z.coerce
      .number()
      .int()
      .positive()
      .max(100000)
      .optional()
      .describe('Default geofence radius in meters'),
    defaultResumptionTime: timeSchema
      .optional()
      .describe('Company-wide default daily resumption time'),
    defaultClosingTime: timeSchema
      .optional()
      .describe('Company-wide default daily closing time'),
    defaultLatePeriodMinutes: z.coerce
      .number()
      .int()
      .min(1)
      .max(1440)
      .optional()
      .describe('Default grace period in minutes before clock-in is late'),
    defaultWorkingDays: workingDaysSchema
      .optional()
      .describe('Company-wide default working days'),
    timezone: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('IANA timezone for the organization'),
    frontendUrl: z
      .string()
      .url('Frontend URL must be a valid URL')
      .max(500)
      .optional()
      .describe('Base URL of the web app, used in links'),
    apiUrl: z
      .string()
      .url('API URL must be a valid URL')
      .max(500)
      .optional()
      .describe('Base URL of this API, used in links'),
  })
  .superRefine((d, ctx) => {
    if (
      d.defaultClosingTime &&
      d.defaultResumptionTime &&
      d.defaultClosingTime <= d.defaultResumptionTime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'defaultClosingTime must be later than defaultResumptionTime',
        path: ['defaultClosingTime'],
      });
    }
    if (d.timezone !== undefined && !isValidTimeZone(d.timezone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid timezone',
        path: ['timezone'],
      });
    }
  });

export type SaveSettingsDto = z.infer<typeof saveSettingsSchema>;

export interface TenantSettingsShape {
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultRadiusMeters?: number;
  defaultResumptionTime?: string;
  defaultClosingTime?: string;
  defaultLatePeriodMinutes?: number;
  defaultWorkingDays?: number[];
  timezone?: string;
  frontendUrl?: string;
  apiUrl?: string;
}
