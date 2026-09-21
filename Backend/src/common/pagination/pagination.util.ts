import { BadRequestException } from '@nestjs/common';

export interface PagedData<T> {
  items: T[];
  nextCursor: string | null;
}

/** Encode a record id as an opaque, URL-safe cursor. */
export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

/** Decode an opaque cursor back to a record id (null when absent). */
export function decodeCursor(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  // Buffer is lenient about invalid base64 characters, so only accept
  // cursors that survive a strict round-trip back to the original cipher.
  if (!decoded || encodeCursor(decoded) !== cursor) {
    throw new BadRequestException('Invalid cursor');
  }
  return decoded;
}

/**
 * Builds a page from rows fetched with a `limit + 1` over-fetch, so
 * `nextCursor` is only emitted when another page actually exists.
 */
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
): PagedData<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const hasMore = rows.length > limit;
  return { items, nextCursor: hasMore && last ? encodeCursor(last.id) : null };
}
