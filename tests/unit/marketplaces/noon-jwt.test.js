import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createNoonLoginJwt } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-jwt.js';

describe('createNoonLoginJwt', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    it('builds a three-part RS256 JWT with key id as subject', () => {
        const jwt = createNoonLoginJwt('test-key-id', privateKey.export({ type: 'pkcs8', format: 'pem' }));
        const parts = jwt.split('.');
        expect(parts).toHaveLength(3);
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        expect(payload.sub).toBe('test-key-id');
        expect(typeof payload.iat).toBe('number');
        expect(typeof payload.jti).toBe('string');
    });

    it('does not embed the private key in the token', () => {
        const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
        const jwt = createNoonLoginJwt('test-key-id', pem);
        expect(jwt).not.toContain('PRIVATE KEY');
        expect(jwt).not.toContain(pem);
    });
});
