import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  });

  it('returns the parsed data for valid input', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ email: 'a@b.com', age: 21 }, {} as never);
    expect(result).toEqual({ email: 'a@b.com', age: 21 });
  });

  it('strips unknown keys', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform(
      { email: 'a@b.com', age: 21, extra: 'x' },
      {} as never,
    );
    expect(result).toEqual({ email: 'a@b.com', age: 21 });
  });

  it('throws BadRequestException with field errors for invalid input', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ email: 'nope', age: 12 }, {} as never);
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as {
        errors: Record<string, string[]>;
      };
      expect(response.errors.email).toBeDefined();
      expect(response.errors.age).toBeDefined();
    }
  });
});
