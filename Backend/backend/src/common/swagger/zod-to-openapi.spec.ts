import { z } from 'zod';
import { zodToOpenApiSchema } from './zod-to-openapi';

describe('zodToOpenApiSchema', () => {
  it('converts a string with length constraints and description', () => {
    const schema = z.object({
      name: z.string().min(2).max(50).describe('Full name'),
    });
    const openApi = zodToOpenApiSchema(schema);
    expect(openApi).toEqual({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 2,
          maxLength: 50,
          description: 'Full name',
        },
      },
      required: ['name'],
    });
  });

  it('marks format for email/uuid strings', () => {
    const schema = z.object({
      email: z.string().email(),
      id: z.string().uuid(),
    });
    const openApi = zodToOpenApiSchema(schema);
    expect(openApi.properties).toMatchObject({
      email: { type: 'string', format: 'email' },
      id: { type: 'string', format: 'uuid' },
    });
  });

  it('converts numbers with ranges and int detection', () => {
    const schema = z.object({
      qty: z.number().int().min(1).max(10),
      price: z.number().min(0),
    });
    const openApi = zodToOpenApiSchema(schema);
    expect(openApi.properties).toMatchObject({
      qty: { type: 'integer', minimum: 1, maximum: 10 },
      price: { type: 'number', minimum: 0 },
    });
  });

  it('converts enums, booleans, arrays and dates', () => {
    const schema = z.object({
      role: z.enum(['admin', 'user']),
      active: z.boolean(),
      tags: z.array(z.string()).min(1).max(5),
      createdAt: z.date(),
    });
    const openApi = zodToOpenApiSchema(schema);
    expect(openApi.properties).toMatchObject({
      role: { type: 'string', enum: ['admin', 'user'] },
      active: { type: 'boolean' },
      tags: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: { type: 'string' },
      },
      createdAt: { type: 'string', format: 'date-time' },
    });
  });

  it('handles optional, nullable and default fields', () => {
    const schema = z.object({
      maybe: z.string().nullable(),
      opt: z.string().optional(),
      withDefault: z.string().default('x'),
    });
    const openApi = zodToOpenApiSchema(schema);
    expect(openApi.properties).toMatchObject({
      maybe: { type: ['string', 'null'] },
      opt: { type: 'string' },
      withDefault: { type: 'string' },
    });
    expect(openApi.required).toEqual(['maybe']);
  });

  it('converts records and unions', () => {
    const schema = z.object({
      meta: z.record(z.string(), z.string()),
      val: z.union([z.string(), z.number()]),
    });
    const openApi = zodToOpenApiSchema(schema);
    expect(openApi.properties).toMatchObject({
      meta: { type: 'object', additionalProperties: { type: 'string' } },
      val: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    });
  });
});
