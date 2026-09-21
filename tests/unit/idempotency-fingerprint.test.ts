import { describe, expect, it } from 'vitest';
import { fingerprintRequest } from '../../src/shared/idempotency/index.js';

describe('idempotency fingerprint', () => {
  it('is stable regardless of property order', () => {
    const left = fingerprintRequest({ a: 1, b: 2 });
    const right = fingerprintRequest({ b: 2, a: 1 });
    expect(left).toBe(right);
  });
});
