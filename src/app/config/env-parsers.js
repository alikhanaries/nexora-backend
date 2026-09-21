import { z } from 'zod';
/**
 * Environment variables are always strings, so every typed value needs an
 * explicit parser. These helpers keep the parsing rules in one place and make
 * failures readable: the schema reports which variable is wrong and why.
 */
const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off']);
function isBlank(value) {
    return value === undefined || value.trim() === '';
}
export function envBoolean(defaultValue) {
    return z
        .string()
        .optional()
        .transform((value, ctx) => {
        if (isBlank(value))
            return defaultValue;
        const normalised = value.trim().toLowerCase();
        if (TRUTHY.has(normalised))
            return true;
        if (FALSY.has(normalised))
            return false;
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `expected a boolean (true/false), received "${value}"`,
        });
        return z.NEVER;
    });
}
export function envInteger(options) {
    return z
        .string()
        .optional()
        .transform((value, ctx) => {
        if (isBlank(value))
            return options.default;
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
export function envString(defaultValue) {
    return z
        .string()
        .optional()
        .transform((value, ctx) => {
        if (!isBlank(value))
            return value.trim();
        if (defaultValue !== undefined)
            return defaultValue;
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'is required but was not set' });
        return z.NEVER;
    });
}
export function envOptionalString() {
    return z
        .string()
        .optional()
        .transform((value) => (isBlank(value) ? undefined : value.trim()));
}
export function envUrl(defaultValue) {
    return envString(defaultValue).superRefine((value, ctx) => {
        if (!URL.canParse(value)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `is not a valid URL: "${value}"` });
        }
    });
}
/** Comma-separated list; blank means "empty list", not "missing". */
export function envStringList() {
    return z
        .string()
        .optional()
        .transform((value) => {
        if (isBlank(value))
            return [];
        return value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    });
}
