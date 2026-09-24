import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createNamshiLoginJwt } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-jwt.js';

describe('createNamshiLoginJwt', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    it('builds a three-part RS256 JWT with key id as subject', () => {
        const jwt = createNamshiLoginJwt('namshi-key-id', privateKey.export({ type: 'pkcs8', format: 'pem' }));
        const parts = jwt.split('.');
        expect(parts).toHaveLength(3);
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        expect(payload.sub).toBe('namshi-key-id');
    });
});
