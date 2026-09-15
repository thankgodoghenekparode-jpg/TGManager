import { z } from 'zod';

type AnyZodSchema = z.ZodTypeAny;

/**
 * Structural subset of the OpenAPI SchemaObject produced by the converter.
 * Kept local because @nestjs/swagger does not re-export SchemaObject from its
 * package entry point (only `.` and `./plugin` are in its exports map).
 */
export interface OpenApiSchema {
  type?: string;
  format?: string;
  description?: string;
  nullable?: boolean;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  additionalProperties?: OpenApiSchema | boolean;
  oneOf?: OpenApiSchema[];
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
}

interface ZodDef {
  type: string;
  [key: string]: unknown;
}

interface ZodCheck {
  _zod?: { def?: ZodCheckDef };
  def?: ZodCheckDef;
}

interface ZodCheckDef {
  check?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  value?: number;
  inclusive?: boolean;
}

function def(schema: AnyZodSchema): ZodDef {
  return (schema as unknown as { _def: ZodDef })._def;
}

function checkDef(check: unknown): ZodCheckDef | undefined {
  const c = check as ZodCheck;
  return c?._zod?.def ?? c?.def;
}

/**
 * Converts a Zod schema into an OpenAPI schema object so request bodies can be
 * documented in Swagger without rewriting the DTOs as classes.
 *
 * Field-level `description`s come from `.describe('...')` calls on the schema.
 */
export function zodToOpenApiSchema(schema: AnyZodSchema): OpenApiSchema {
  return convert(schema);
}

/**
 * Returns an OpenAPI `$ref` to a named schema that must be registered in
 * `components.schemas` (see src/main.ts and ./dto-schemas).
 */
export function schemaRef(name: string): { $ref: string } {
  return { $ref: `#/components/schemas/${name}` };
}

function convert(schema: AnyZodSchema): Record<string, unknown> {
  if (!schema) return {};

  const d = def(schema);
  const result: Record<string, unknown> = {};

  const description = (schema as unknown as { description?: string })
    .description;
  if (description) result.description = description;

  switch (d.type) {
    case 'string': {
      result.type = 'string';
      const checks = Array.isArray(d.checks) ? (d.checks as unknown[]) : [];
      for (const check of checks) {
        const cd = checkDef(check);
        if (!cd?.check) continue;
        switch (cd.check) {
          case 'min_length':
            result.minLength = cd.minimum;
            break;
          case 'max_length':
            result.maxLength = cd.maximum;
            break;
          case 'string_format':
            if (cd.format) result.format = cd.format;
            break;
          default:
            break;
        }
      }
      break;
    }
    case 'number': {
      let isInteger = false;
      const checks = Array.isArray(d.checks) ? (d.checks as unknown[]) : [];
      for (const check of checks) {
        const cd = checkDef(check);
        if (!cd?.check) continue;
        switch (cd.check) {
          case 'number_format':
            if (cd.format === 'safeint') isInteger = true;
            break;
          case 'greater_than':
            result.minimum = cd.value;
            if (cd.inclusive === false) result.exclusiveMinimum = true;
            break;
          case 'less_than':
            result.maximum = cd.value;
            if (cd.inclusive === false) result.exclusiveMaximum = true;
            break;
          default:
            break;
        }
      }
      result.type = isInteger ? 'integer' : 'number';
      break;
    }
    case 'boolean': {
      result.type = 'boolean';
      break;
    }
    case 'date': {
      result.type = 'string';
      result.format = 'date-time';
      break;
    }
    case 'enum': {
      const entries = d.entries as Record<string, string>;
      const values = Object.values(entries ?? {});
      result.type = 'string';
      result.enum = values;
      break;
    }
    case 'literal': {
      const values = (d.values as unknown[]) ?? [];
      const first = values[0];
      if (typeof first === 'number') result.type = 'number';
      else if (typeof first === 'boolean') result.type = 'boolean';
      else result.type = 'string';
      result.enum = values;
      break;
    }
    case 'array': {
      result.type = 'array';
      result.items = convert(d.element as AnyZodSchema);
      const checks = Array.isArray(d.checks) ? (d.checks as unknown[]) : [];
      for (const check of checks) {
        const cd = checkDef(check);
        if (!cd?.check) continue;
        if (cd.check === 'min_length') result.minItems = cd.minimum;
        if (cd.check === 'max_length') result.maxItems = cd.maximum;
      }
      break;
    }
    case 'record': {
      result.type = 'object';
      result.additionalProperties = convert(d.valueType as AnyZodSchema);
      break;
    }
    case 'nullable': {
      Object.assign(result, convert(d.innerType as AnyZodSchema));
      addNull(result);
      break;
    }
    case 'optional':
    case 'default': {
      return convert(d.innerType as AnyZodSchema);
    }
    case 'union': {
      const options = (d.options as AnyZodSchema[]) ?? [];
      const hasNull = options.some((o) => def(o).type === 'null');
      const nonNull = options.filter((o) => def(o).type !== 'null');
      if (hasNull) {
        const base = convert(nonNull[0]);
        addNull(base);
        return base;
      }
      const types = new Set(nonNull.map((o) => def(o).type));
      if (types.size === 1) {
        const merged = convert(nonNull[0]);
        const enums = nonNull
          .map((o) =>
            def(o).type === 'literal'
              ? (def(o).values as unknown[])[0]
              : undefined,
          )
          .filter((v) => v !== undefined);
        if (enums.length === nonNull.length && enums.length > 1) {
          return { ...merged, enum: enums };
        }
        return merged;
      }
      result.oneOf = nonNull.map((o) => convert(o));
      break;
    }
    case 'null': {
      result.type = 'null';
      break;
    }
    case 'object': {
      const shape = d.shape as Record<string, AnyZodSchema>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (!isOptional(value)) required.push(key);
      }
      result.type = 'object';
      result.properties = properties;
      if (required.length > 0) result.required = required;
      if (d.catchall)
        result.additionalProperties = convert(d.catchall as AnyZodSchema);
      break;
    }
    case 'effects':
    case 'pipeline':
    case 'transform': {
      const inner = (d.in ?? d.innerType ?? d.out) as AnyZodSchema | undefined;
      if (inner) {
        return convert(inner);
      }
      break;
    }
    default: {
      break;
    }
  }

  return result;
}

function isOptional(schema: AnyZodSchema): boolean {
  const t = def(schema).type;
  return t === 'optional' || t === 'default';
}

function addNull(result: Record<string, unknown>): void {
  if (typeof result.type === 'string') {
    result.type = [result.type, 'null'];
  } else if (Array.isArray(result.type) && !result.type.includes('null')) {
    result.type.push('null');
  }
}
