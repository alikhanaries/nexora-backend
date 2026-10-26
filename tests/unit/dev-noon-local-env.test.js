import { describe, expect, it } from 'vitest';

/** Mirrors `readPrivateKeyPem()` in scripts/dev-noon-connection-bootstrap.mjs */
function normalizeNoonPrivateKeyPemFromEnv(raw) {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return null;
  }
  return trimmed.replace(/\\n/g, '\n');
}

describe('Noon local env private key PEM formatting', () => {
  it('expands escaped newlines for dotenv single-line PEM', () => {
    const synthetic = '-----BEGIN PRIVATE KEY-----\\nLINE\\n-----END PRIVATE KEY-----';
    const normalized = normalizeNoonPrivateKeyPemFromEnv(synthetic);
    expect(normalized).toContain('\n');
    expect(normalized).not.toContain('\\n');
    expect(normalized?.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
  });

  it('returns null for empty PEM', () => {
    expect(normalizeNoonPrivateKeyPemFromEnv('')).toBeNull();
    expect(normalizeNoonPrivateKeyPemFromEnv(undefined)).toBeNull();
  });
});
