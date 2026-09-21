import { z } from 'zod';

/**
 * Environment variables are always strings, so every typed value needs an
 * explicit parser. These helpers keep the parsing rules in one place and make
 * failures readable: the schema reports which variable is wrong and why.
 */

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off']);

function isBlank(value: string | undefined): value is undefined | '' {
  return value === undefined || value.trim() === '';
}

export function envBoolean(defaultValue: boolean): z.ZodType<boolean, z.ZodTypeDef, unknown> {
  return z
    .string()
    .optional()
    .transform((value, ctx): boolean => {
      if (isBlank(value)) return defaultValue;
      const normalised = value.trim().toLowerCase();
      if (TRUTHY.has(normalised)) return true;
      if (FALSY.has(normalised)) return false;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `expected a boolean (true/false), received "${value}"`,
      });
      return z.NEVER;
    });
}

export interface IntegerOptions {
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
}

export function envInteger(options: IntegerOptions): z.ZodType<number, z.ZodTypeDef, unknown> {
  return z
    .string()
    .optional()
    .transform((value, ctx): number => {
      if (isBlank(value)) return options.default;
      const parsed = Number(value.trim());
      if (!Number.isInteger(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `expected an integer, received "${value}"`,
        });
        return z.NEVER;
      }
      if (options.min !== undefined && parsed < options.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `expected an integer >= ${options.min}, received ${parsed}`,
        });
        return z.NEVER;
      }
      if (options.max !== undefined && parsed > options.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `expected an integer <= ${options.max}, received ${parsed}`,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

export function envString(defaultValue?: string): z.ZodType<string, z.ZodTypeDef, unknown> {
  return z
    .string()
    .optional()
    .transform((value, ctx): string => {
      if (!isBlank(value)) return value.trim();
      if (defaultValue !== undefined) return defaultValue;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'is required but was not set' });
      return z.NEVER;
    });
}

export function envOptionalString(): z.ZodType<string | undefined, z.ZodTypeDef, unknown> {
  return z
    .string()
    .optional()
    .transform((value): string | undefined => (isBlank(value) ? undefined : value.trim()));
}

export function envUrl(defaultValue?: string): z.ZodType<string, z.ZodTypeDef, unknown> {
  return envString(defaultValue).superRefine((value, ctx) => {
    if (!URL.canParse(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `is not a valid URL: "${value}"` });
    }
  });
}

/** Comma-separated list; blank means "empty list", not "missing". */
export function envStringList(): z.ZodType<readonly string[], z.ZodTypeDef, unknown> {
  return z
    .string()
    .optional()
    .transform((value): readonly string[] => {
      if (isBlank(value)) return [];
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    });
}
