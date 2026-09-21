import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Request IDs appear in logs, metrics exemplars and error responses, so an
 * attacker-controlled value must not be able to inject control characters,
 * forge another request's identity or blow up log size.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;

export function generateRequestId(): string {
  return randomUUID();
}

export function isValidRequestId(value: string): boolean {
  return SAFE_REQUEST_ID.test(value);
}

/**
 * Resolves the request ID for an incoming request.
 *
 * Inbound IDs are honoured only when `trustIncoming` is enabled, which is the
 * documented policy for deployments sitting behind a proxy that overwrites the
 * header. Anything untrusted or malformed is replaced by a fresh UUID.
 */
export function resolveRequestId(
  incoming: string | string[] | undefined,
  trustIncoming: boolean,
): string {
  if (!trustIncoming) return generateRequestId();

  // A repeated header is ambiguous and therefore not trusted.
  const candidate = Array.isArray(incoming) ? undefined : incoming?.trim();
  if (candidate !== undefined && isValidRequestId(candidate)) {
    return candidate;
  }
  return generateRequestId();
}
