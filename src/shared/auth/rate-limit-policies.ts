import type { RateLimitPolicy } from '../rate-limit/index.js';

export const AUTH_RATE_LIMIT_POLICIES = {
  login: { name: 'auth.login', limit: 10, windowSeconds: 900 } satisfies RateLimitPolicy,
  refresh: { name: 'auth.refresh', limit: 30, windowSeconds: 900 } satisfies RateLimitPolicy,
  passwordResetRequest: {
    name: 'auth.password-reset',
    limit: 5,
    windowSeconds: 3600,
  } satisfies RateLimitPolicy,
  passwordResetConfirm: {
    name: 'auth.password-reset-confirm',
    limit: 10,
    windowSeconds: 3600,
  } satisfies RateLimitPolicy,
  mfaVerify: { name: 'auth.mfa', limit: 10, windowSeconds: 900 } satisfies RateLimitPolicy,
  apiKeyCreate: {
    name: 'api-key.create',
    limit: 10,
    windowSeconds: 3600,
  } satisfies RateLimitPolicy,
  apiKeyRotate: {
    name: 'api-key.rotate',
    limit: 10,
    windowSeconds: 3600,
  } satisfies RateLimitPolicy,
} as const;
