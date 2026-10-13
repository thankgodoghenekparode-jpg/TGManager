import { platformSettingsSchema } from './platform-settings.dto';

describe('platformSettingsSchema', () => {
  it('accepts an empty payload (nothing changed)', () => {
    expect(platformSettingsSchema.safeParse({}).success).toBe(true);
    expect(platformSettingsSchema.safeParse({ featureFlags: {} }).success).toBe(
      true,
    );
  });

  it('treats blank optional strings as an explicit clear (null)', () => {
    const result = platformSettingsSchema.safeParse({
      supportEmail: '',
      platformUrl: '',
      logoUrl: '',
      smtpFromEmail: '',
      maintenanceMessage: '',
      smtpHost: '   ',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      supportEmail: null,
      platformUrl: null,
      logoUrl: null,
      smtpFromEmail: null,
      maintenanceMessage: null,
      smtpHost: null,
    });
  });

  it('treats a cleared numeric port as an explicit clear (null)', () => {
    for (const value of ['', null, undefined]) {
      const result = platformSettingsSchema.safeParse({ smtpPort: value });
      expect(result.success).toBe(true);
      if (result.success && value !== undefined) {
        expect(result.data.smtpPort).toBeNull();
      }
    }
  });

  it('coerces and keeps valid values', () => {
    const result = platformSettingsSchema.safeParse({
      platformName: '  TGManager  ',
      supportEmail: 'support@tgmanager.com',
      platformUrl: 'https://tgmanager.com',
      smtpPort: '587',
      defaultMaxStaff: 25,
      maintenanceMode: true,
      featureFlags: { chat: true },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      platformName: 'TGManager',
      supportEmail: 'support@tgmanager.com',
      platformUrl: 'https://tgmanager.com',
      smtpPort: 587,
      defaultMaxStaff: 25,
      maintenanceMode: true,
      featureFlags: { chat: true },
    });
  });

  it('accepts a display-name from address', () => {
    const result = platformSettingsSchema.safeParse({
      smtpFromEmail: 'TGManager <no-reply@tgmanager.com>',
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed emails, URLs and ports', () => {
    const result = platformSettingsSchema.safeParse({
      supportEmail: 'not-an-email',
      platformUrl: 'not a url',
      smtpPort: 70000,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(result.error.flatten().fieldErrors).sort()).toEqual([
      'platformUrl',
      'smtpPort',
      'supportEmail',
    ]);
  });
});
