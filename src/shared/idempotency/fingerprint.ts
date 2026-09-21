import { createHash } from 'node:crypto';
import type { RequestFingerprint } from './idempotency-service.js';

/**
 * Canonical JSON: object keys sorted recursively so two logically identical
 * payloads always hash the same, regardless of property order.
 */
function canonicalise(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalise);

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  return Object.fromEntries(entries.map(([key, entry]) => [key, canonicalise(entry)]));
}

/**
 * Hashes a request so replays can be distinguished from key reuse.
 *
 * SHA-256 of canonical JSON: only equality matters here, and the digest is
 * never used as a secret.
 */
export function fingerprintRequest(value: unknown): RequestFingerprint {
  const canonical = JSON.stringify(canonicalise(value) ?? null);
  return createHash('sha256').update(canonical).digest('hex');
}
