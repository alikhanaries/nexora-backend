import type { ZodIssue, ZodType } from 'zod';
import { ValidationError } from '../errors/index.js';

export interface FieldIssue {
  readonly path: string;
  readonly message: string;
}

export function toFieldIssues(issues: readonly ZodIssue[]): readonly FieldIssue[] {
  return issues.map((issue) => ({
    path: issue.path.length === 0 ? '(root)' : issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Narrows `unknown` into a validated value or throws a typed ValidationError.
 *
 * This is the standard way to cross a trust boundary - database rows, queue
 * payloads, upstream responses - without reaching for `any`.
 *
 * @throws {ValidationError} with per-field issues in `safeDetails`.
 */
export function parseOrThrow<T>(schema: ZodType<T>, value: unknown, subject: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new ValidationError(`${subject} failed validation`, {
    subject,
    issues: toFieldIssues(result.error.issues),
  });
}
