import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodType } from 'zod';

/**
 * Validates and transforms a request payload against a Zod schema.
 * Usage: @Body(new ZodValidationPipe(registerSchema))
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.flatten();
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errors.fieldErrors,
      });
    }
    return result.data;
  }
}
