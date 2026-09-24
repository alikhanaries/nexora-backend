import { describe, expect, it } from 'vitest';
import {
    AwsSigV4RequestSigner,
    buildCanonicalHeaders,
    canonicalQueryString,
    canonicalUri,
    formatAmzDate,
    getSignatureKey,
    sha256Hex,
} from '../../../src/modules/marketplaces/infrastructure/http/aws-sigv4-request-signer.js';

describe('AwsSigV4RequestSigner', () => {
    it('formats x-amz-date without punctuation', () => {
        expect(formatAmzDate(new Date('2020-08-30T12:36:41.000Z'))).toBe('20200830T123641Z');
    });

    it('builds canonical URI with encoded segments', () => {
        expect(canonicalUri('/listings/2021-08-01/items/A/B')).toBe('/listings/2021-08-01/items/A/B');
    });

    it('sorts canonical query string', () => {
        const params = new URLSearchParams('b=2&a=1');
        expect(canonicalQueryString(params)).toBe('a=1&b=2');
    });

    it('hashes payload deterministically', () => {
        expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('derives signing key deterministically', () => {
        const key = getSignatureKey('SECRET', '20200830', 'us-east-1', 'execute-api');
        expect(key).toHaveLength(32);
        const keyAgain = getSignatureKey('SECRET', '20200830', 'us-east-1', 'execute-api');
        expect(Buffer.compare(key, keyAgain)).toBe(0);
    });

    it('signs GET request with stable authorization header', async () => {
        const signer = new AwsSigV4RequestSigner({
            region: 'us-east-1',
            service: 'execute-api',
            now: () => new Date('2020-08-30T12:36:41.000Z'),
        });
        const signed = await signer.sign({
            url: 'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations',
            method: 'GET',
            headers: { 'x-amz-access-token': 'Atza|token' },
        }, {
            accessKeyId: 'AKIAEXAMPLE',
            secretAccessKey: 'secret',
        });
        expect(signed.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20200830\/us-east-1\/execute-api\/aws4_request/);
        expect(signed.headers['x-amz-date']).toBe('20200830T123641Z');
        expect(signed.headers['x-amz-access-token']).toBe('Atza|token');
        expect(buildCanonicalHeaders({ host: 'sellingpartnerapi-na.amazon.com', 'x-amz-date': '20200830T123641Z' }))
            .toContain('host:sellingpartnerapi-na.amazon.com');
    });

    it('includes session token when provided', async () => {
        const signer = new AwsSigV4RequestSigner({
            region: 'us-east-1',
            now: () => new Date('2020-08-30T12:36:41.000Z'),
        });
        const signed = await signer.sign({
            url: 'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations',
            method: 'GET',
        }, {
            accessKeyId: 'AKIAEXAMPLE',
            secretAccessKey: 'secret',
            sessionToken: 'session-token',
        });
        expect(signed.headers['x-amz-security-token']).toBe('session-token');
    });
});
