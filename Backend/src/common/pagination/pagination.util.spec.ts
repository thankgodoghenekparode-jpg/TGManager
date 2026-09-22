import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor, paginate } from './pagination.util';

describe('pagination util', () => {
  it('round-trips a record id through an opaque cursor', () => {
    const id = 'cm5abcdefghijkl';
    expect(decodeCursor(encodeCursor(id))).toBe(id);
  });

  it('returns null for an absent cursor', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });

  it('throws on a malformed cursor', () => {
    expect(() => decodeCursor('not base64!!')).toThrow(BadRequestException);
  });

  it('emits no nextCursor when the page is the last one', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(paginate(rows, 10)).toEqual({
      items: rows,
      nextCursor: null,
    });
  });

  it('emits a nextCursor for the last item when more rows exist', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const page = paginate(rows, 2);
    expect(page.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(decodeCursor(page.nextCursor)).toBe('b');
  });
});
