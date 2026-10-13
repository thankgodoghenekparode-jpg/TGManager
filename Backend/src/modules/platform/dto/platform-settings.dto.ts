import { z } from 'zod';

/**
 * Normalises the values a browser form sends for an optional field — an empty
 * string from a cleared text/number input, or `null` from an emptied numeric
 * field — into a single `null`. Clearing a field therefore never trips
 * validation, and is stored as an explicit clear. Whitespace-only strings are
 * treated as blank too.
 */
const blankToNull = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const isUrl = (value: string): boolean => {
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Accepts a bare address or the RFC "Display Name <addr>" form. */
const isEmail = (value: string): boolean => {
  const angle = value.match(/<([^>]+)>\s*$/);
  return EMAIL_RE.test((angle ? angle[1] : value).trim());
};

/** Optional free-text field; a blank value clears it (stored as null). */
const textField = (label: string, max = 200) =>
  z
    .preprocess(blankToNull, z.string().trim().max(max).nullable())
    .optional()
    .describe(label);

/** Optional email field; a blank value clears it. */
const emailField = (label: string, max = 200) =>
  z
    .preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .max(max)
        .refine(isEmail, { message: `${label} must be a valid email` })
        .nullable(),
    )
    .optional()
    .describe(label);

/** Optional URL field; a blank value clears it. */
const urlField = (label: string, max = 500) =>
  z
    .preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .max(max)
        .refine(isUrl, { message: `${label} must be a valid URL` })
        .nullable(),
    )
    .optional()
    .describe(label);

/** Optional positive integer field; a blank value clears it. */
const numberField = (label: string, min = 1, max = 2_147_483_647) =>
  z
    .preprocess(
      blankToNull,
      z.coerce.number().int().min(min).max(max).nullable(),
    )
    .optional()
    .describe(label);

/** Optional secret field; not trimmed (secrets may contain meaningful spaces). */
const secretField = (label: string, max = 200) =>
  z
    .preprocess(blankToNull, z.string().max(max).nullable())
    .optional()
    .describe(label);

export const platformSettingsSchema = z.object({
  // ── Platform Identity ──
  platformName: textField('Platform display name', 100),
  supportEmail: emailField('Support email'),
  platformUrl: urlField('Platform URL'),
  logoUrl: urlField('Logo URL'),

  // ── System ──
  maintenanceMode: z
    .boolean()
    .optional()
    .describe('Global maintenance mode toggle'),
  maintenanceMessage: textField('Maintenance message', 500),

  // ── Default Plan Limits ──
  defaultMaxBranches: numberField('Default max branches for new plans'),
  defaultMaxStaff: numberField('Default max staff for new plans'),
  defaultMaxDocuments: numberField('Default max documents for new plans'),
  defaultMaxStorageBytes: numberField(
    'Default max storage (bytes) for new plans',
  ),
  defaultMaxChatMessages: numberField(
    'Default max chat messages for new plans',
  ),

  // ── SMTP Defaults ──
  smtpHost: textField('SMTP server host'),
  smtpPort: numberField('SMTP server port', 1, 65535),
  smtpUser: textField('SMTP username'),
  smtpPassword: secretField('SMTP password'),
  smtpFromEmail: emailField('SMTP from address'),
  smtpFromName: textField('SMTP from name', 100),

  // ── S3 Defaults ──
  s3Endpoint: urlField('S3-compatible endpoint URL'),
  s3Bucket: textField('S3 bucket name'),
  s3Region: textField('S3 region', 100),
  s3AccessKey: textField('S3 access key ID'),
  s3SecretKey: secretField('S3 secret access key'),

  // ── Feature Flags ──
  featureFlags: z
    .record(z.string(), z.boolean())
    .optional()
    .describe('Platform-wide feature flags'),
});

export type PlatformSettingsDto = z.infer<typeof platformSettingsSchema>;

export interface PlatformSettingsShape {
  platformName?: string | null;
  supportEmail?: string | null;
  platformUrl?: string | null;
  logoUrl?: string | null;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  defaultMaxBranches?: number | null;
  defaultMaxStaff?: number | null;
  defaultMaxDocuments?: number | null;
  defaultMaxStorageBytes?: number | null;
  defaultMaxChatMessages?: number | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  s3Endpoint?: string | null;
  s3Bucket?: string | null;
  s3Region?: string | null;
  s3AccessKey?: string | null;
  s3SecretKey?: string | null;
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
