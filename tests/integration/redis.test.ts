import { afterAll, describe, expect, it } from 'vitest';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('Redis integration', () => {
  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('supports cache operations', async () => {
    const infra = await getTestInfrastructure();
    await infra.cache.set('test', 'key', { value: 1 }, 30);
    const value = await infra.cache.get<{ value: number }>('test', 'key');
    expect(value?.value).toBe(1);
    await infra.cache.delete('test', 'key');
  });

  it('enforces distributed lock ownership', async () => {
    const infra = await getTestInfrastructure();
    const handle = await infra.lock.acquire('resource-1', 5);
    expect(handle).toBeDefined();
    const second = await infra.lock.acquire('resource-1', 5);
    expect(second).toBeUndefined();
    if (handle !== undefined) {
      await infra.lock.release(handle);
    }
  });

  it('shares rate limit state across consumers', async () => {
    const infra = await getTestInfrastructure();
    const policy = { name: 'test-policy', limit: 2, windowSeconds: 60 };
    const subject = `subject-${Date.now()}`;

    const first = await infra.rateLimiter.consume({ policy, subject });
    const second = await infra.rateLimiter.consume({ policy, subject });
    const third = await infra.rateLimiter.consume({ policy, subject });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
});
