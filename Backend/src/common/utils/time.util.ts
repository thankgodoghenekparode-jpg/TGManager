const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * Returns the wall-clock date of `date` in `timeZone` as a `YYYY-MM-DD` key.
 */
export function localDateKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Returns the wall-clock time of `date` in `timeZone` as an `HH:MM` string.
 */
export function localTimeKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/**
 * UTC offset (in minutes) of `timeZone` at the given instant.
 */
function utcOffsetMinutes(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/**
 * Returns the UTC instant that corresponds to the given wall-clock
 * `HH:MM` on the given `YYYY-MM-DD` date in `timeZone`.
 */
export function zonedDateTime(
  dateKey: string,
  time: string,
  timeZone: string,
): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offset = utcOffsetMinutes(naive, timeZone);
  return new Date(naive.getTime() - offset * 60_000);
}

/**
 * JS weekday (0=Sunday .. 6=Saturday) for a `YYYY-MM-DD` date key.
 */
export function weekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Formats a `Date` as an ISO `YYYY-MM-DD` date key (UTC).
 */
export function dateToDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Great-circle distance between two coordinates in meters.
 */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (x: number): number => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
