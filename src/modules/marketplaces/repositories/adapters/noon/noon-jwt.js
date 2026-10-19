import { createSign, randomUUID } from 'node:crypto';

/**
 * Builds the RS256 JWT used by Noon service-account login
 * (`POST /identity/public/v1/api/login`).
 *
 * @param {string} keyId
 * @param {string} privateKeyPem
 */
export function createNoonLoginJwt(keyId, privateKeyPem) {
    const issuedAt = Math.floor(Date.now() / 1_000);
    const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
    const payload = base64UrlJson({
        sub: keyId,
        iat: issuedAt,
        jti: randomUUID(),
    });
    const signingInput = `${header}.${payload}`;
    const sign = createSign('RSA-SHA256');
    sign.update(signingInput);
    sign.end();
    const signature = sign.sign(privateKeyPem, 'base64url');
    return `${signingInput}.${signature}`;
}

/**
 * @param {Record<string, unknown>} value
 */
function base64UrlJson(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
