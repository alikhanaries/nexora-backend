import { describe, expect, it } from 'vitest';
import { Email } from '../../../src/modules/identity/domain/email.js';
import { normalizeEmail } from '../../../src/shared/security/index.js';

describe('Email normalization', () => {
  it('trims and lowercases via normalizeEmail', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('creates Email value object with normalized form', () => {
    const email = Email.create('  Admin@Corp.io ');
    expect(email.raw).toBe('Admin@Corp.io');
    expect(email.normalized).toBe('admin@corp.io');
  });

  it('rejects invalid email format', () => {
    expect(() => Email.create('not-an-email')).toThrow(/invalid/i);
  });

  it('rejects empty email', () => {
    expect(() => Email.create('   ')).toThrow(/required/i);
  });
});
