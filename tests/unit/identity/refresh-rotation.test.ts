import { describe, expect, it } from 'vitest';
import {
  evaluateRefreshSession,
  RefreshSession,
} from '../../../src/modules/identity/domain/index.js';

function session(
  overrides: Partial<{
    status: 'ACTIVE' | 'REVOKED' | 'REPLACED';
    expiresAt: Date;
  }> = {},
): RefreshSession {
  const now = new Date('2026-01-01T00:00:00Z');
  return RefreshSession.create({
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    tenantId: '33333333-3333-4333-8333-333333333333',
    tokenHash: 'abc',
    familyId: '44444444-4444-4444-8444-444444444444',
    status: overrides.status ?? 'ACTIVE',
    expiresAt: overrides.expiresAt ?? new Date(now.getTime() + 60_000),
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
    replacedBy: null,
  });
}

describe('refresh token rotation logic', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('accepts an active unexpired session', () => {
    const outcome = evaluateRefreshSession(session(), now);
    expect(outcome.kind).toBe('valid');
  });

  it('rejects missing session', () => {
    expect(evaluateRefreshSession(null, now).kind).toBe('invalid');
  });

  it('rejects expired active session', () => {
    const outcome = evaluateRefreshSession(
      session({ expiresAt: new Date('2025-12-31T23:59:59Z') }),
      now,
    );
    expect(outcome.kind).toBe('invalid');
  });

  it('detects family reuse when token was replaced', () => {
    const outcome = evaluateRefreshSession(session({ status: 'REPLACED' }), now);
    expect(outcome.kind).toBe('family_reuse');
  });

  it('detects family reuse when token was revoked', () => {
    const outcome = evaluateRefreshSession(session({ status: 'REVOKED' }), now);
    expect(outcome.kind).toBe('family_reuse');
  });
});
