import { ValidationError } from '../errors/index.js';

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface CursorPaginationInput {
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function clampCursorLimit(limit: number | undefined): number {
  const requested = limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new ValidationError('Limit must be a positive integer');
  }
  return Math.min(requested, MAX_LIMIT);
}

/** Encodes a cursor from sort key components (opaque to clients). */
export function encodeCursor(parts: readonly string[]): string {
  return Buffer.from(JSON.stringify(parts), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'string')) {
      throw new ValidationError('Invalid cursor');
    }
    return parsed;
  } catch {
    throw new ValidationError('Invalid cursor');
  }
}
