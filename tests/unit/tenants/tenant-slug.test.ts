import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { normalizeTenantSlug, validateTenantSlug } from '../../../src/shared/security/index.js';

describe('tenant slug normalization', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeTenantSlug('  Acme-Corp  ')).toBe('acme-corp');
  });

  it('leaves an already normalised slug unchanged', () => {
    expect(normalizeTenantSlug('acme-corp')).toBe('acme-corp');
  });
});

describe('tenant slug validation', () => {
  it('accepts lowercase alphanumeric slugs with hyphens', () => {
    expect(() => validateTenantSlug('acme-corp-2')).not.toThrow();
  });

  it('accepts single-character slugs', () => {
    expect(() => validateTenantSlug('a')).not.toThrow();
  });

  it('rejects slugs with leading hyphens', () => {
    expect(() => validateTenantSlug('-acme')).toThrow(ValidationError);
  });

  it('rejects slugs with trailing hyphens', () => {
    expect(() => validateTenantSlug('acme-')).toThrow(ValidationError);
  });

  it('normalises before validating so uppercase input is accepted', () => {
    expect(() => validateTenantSlug('ACME')).not.toThrow();
  });

  it('rejects slugs longer than 63 characters', () => {
    const slug = 'a' + 'b'.repeat(63);
    expect(() => validateTenantSlug(slug)).toThrow(ValidationError);
  });

  it('rejects empty slugs', () => {
    expect(() => validateTenantSlug('   ')).toThrow(ValidationError);
  });
});
