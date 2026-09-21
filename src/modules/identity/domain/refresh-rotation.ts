import type { RefreshSession } from './refresh-session.js';

export type RefreshValidationOutcome =
  | { readonly kind: 'valid'; readonly session: RefreshSession }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'family_reuse'; readonly session: RefreshSession };

/**
 * Determines whether a presented refresh token may be rotated.
 *
 * A REPLACED or REVOKED token presented again indicates theft/replay within
 * the family and triggers full family revocation.
 */
export function evaluateRefreshSession(
  session: RefreshSession | null,
  now: Date = new Date(),
): RefreshValidationOutcome {
  if (session === null) {
    return { kind: 'invalid' };
  }

  if (session.indicatesFamilyReuse()) {
    return { kind: 'family_reuse', session };
  }

  if (!session.isUsable(now)) {
    return { kind: 'invalid' };
  }

  return { kind: 'valid', session };
}
