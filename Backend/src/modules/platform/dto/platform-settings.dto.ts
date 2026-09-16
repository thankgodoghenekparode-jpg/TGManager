import { z } from 'zod';

const urlField = (label: string) =>
  z.string().url(`${label} must be a valid URL`).max(500).optional();

const portField = (label: string) =>
  z.coerce.number().int().min(1).max(65535).optional().describe(label);

export const platformSettingsSchema = z.object({
  // ── Platform Identity ──
  platformName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Platform display name'),
  supportEmail: z
    .string()
    .email('Must be a valid email')
    .max(200)
    .optional()
    .describe('Support contact email'),
  platformUrl: urlField('Platform URL').describe('Public platform URL'),
  logoUrl: urlField('Logo URL').describe('Platform logo image URL'),

  // ── System ──
  maintenanceMode: z
    .boolean()
    .optional()
    .describe('Global maintenance mode toggle'),
  maintenanceMessage: z
    .string()
    .trim()
    .max(500)
    .optional()
    .describe('Message shown during maintenance'),

  // ── Default Plan Limits ──
  defaultMaxBranches: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Default max branches for new plans'),
  defaultMaxStaff: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Default max staff for new plans'),
  defaultMaxDocuments: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Default max documents for new plans'),
  defaultMaxStorageBytes: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Default max storage (bytes) for new plans'),
  defaultMaxChatMessages: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Default max chat messages for new plans'),

  // ── SMTP Defaults ──
  smtpHost: z.string().trim().max(200).optional().describe('SMTP server host'),
  smtpPort: portField('SMTP server port'),
  smtpUser: z.string().trim().max(200).optional().describe('SMTP username'),
  smtpPassword: z.string().max(200).optional().describe('SMTP password'),
  smtpFromEmail: z
    .string()
    .email('Must be a valid email')
    .max(200)
    .optional()
    .describe('SMTP from address'),
  smtpFromName: z
    .string()
    .trim()
    .max(100)
    .optional()
    .describe('SMTP from name'),

  // ── S3 Defaults ──
  s3Endpoint: urlField('S3 endpoint').describe('S3-compatible endpoint URL'),
  s3Bucket: z.string().trim().max(200).optional().describe('S3 bucket name'),
  s3Region: z.string().trim().max(100).optional().describe('S3 region'),
  s3AccessKey: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe('S3 access key ID'),
  s3SecretKey: z.string().max(200).optional().describe('S3 secret access key'),

  // ── Feature Flags ──
  featureFlags: z
    .record(z.string(), z.boolean())
    .optional()
    .describe('Platform-wide feature flags'),
});

export type PlatformSettingsDto = z.infer<typeof platformSettingsSchema>;

export interface PlatformSettingsShape {
  platformName?: string;
  supportEmail?: string;
  platformUrl?: string;
  logoUrl?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  defaultMaxBranches?: number | null;
  defaultMaxStaff?: number | null;
  defaultMaxDocuments?: number | null;
  defaultMaxStorageBytes?: number | null;
  defaultMaxChatMessages?: number | null;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  s3Endpoint?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  featureFlags?: Record<string, boolean>;
}

const KNOWN_KEYS: (keyof PlatformSettingsShape)[] = [
  'platformName',
  'supportEmail',
  'platformUrl',
  'logoUrl',
  'maintenanceMode',
  'maintenanceMessage',
  'defaultMaxBranches',
  'defaultMaxStaff',
  'defaultMaxDocuments',
  'defaultMaxStorageBytes',
  'defaultMaxChatMessages',
  'smtpHost',
  'smtpPort',
  'smtpUser',
  'smtpPassword',
  'smtpFromEmail',
  'smtpFromName',
  's3Endpoint',
  's3Bucket',
  's3Region',
  's3AccessKey',
  's3SecretKey',
  'featureFlags',
];

export function parsePlatformSettings(raw: unknown): PlatformSettingsShape {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const shape: PlatformSettingsShape = {};
  for (const key of KNOWN_KEYS) {
    if (key in record) {
      (shape as Record<string, unknown>)[key] = record[key];
    }
  }
  return shape;
}
