/**
 * Zod transform helpers for env strings (booleans, integers, URLs, lists).
 * Shared by {@link configSchema} so mis-set variables fail with clear messages.
 */
import { z } from 'zod';
const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off']);
/** True for undefined or whitespace-only env strings. */
function isBlank(value) {
    return value === undefined || value.trim() === '';
}
/** Zod transform: optional env string → boolean, using TRUTHY/FALSY sets or `defaultValue`. */
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
/** Zod transform: optional env string → integer with optional min/max bounds and default. */
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
/** Zod transform: trim required string or use default; fails validation when unset and no default. */
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
/** Zod transform: blank/missing → undefined; otherwise trimmed string. */
export function envOptionalString() {
    return z
        .string()
        .optional()
        .transform((value) => (isBlank(value) ? undefined : value.trim()));
}
/** Like {@link envString} with an additional URL.canParse check. */
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
