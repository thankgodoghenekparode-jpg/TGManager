import { ttlToMs } from './ttl.util';

describe('ttlToMs', () => {
  it('parses seconds', () => {
    expect(ttlToMs('30s')).toBe(30000);
  });

  it('parses minutes', () => {
    expect(ttlToMs('15m')).toBe(15 * 60 * 1000);
  });

  it('parses hours', () => {
    expect(ttlToMs('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('parses days', () => {
    expect(ttlToMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('falls back to 15 minutes for unknown formats', () => {
    expect(ttlToMs('bogus')).toBe(15 * 60 * 1000);
    expect(ttlToMs('')).toBe(15 * 60 * 1000);
  });
});
