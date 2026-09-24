import { describe, expect, it } from 'vitest';
import { assertSafeOutboundHttpsUrl } from '../../../src/shared/security/validate-outbound-https-url.js';

describe('assertSafeOutboundHttpsUrl', () => {
    it('accepts public HTTPS URLs', () => {
        const url = assertSafeOutboundHttpsUrl('https://noon-api-gateway.noon.partners');
        expect(url.hostname).toBe('noon-api-gateway.noon.partners');
    });

    it('rejects non-HTTPS schemes', () => {
        expect(() => assertSafeOutboundHttpsUrl('http://noon-api-gateway.noon.partners'))
            .toThrow(/HTTPS/);
    });

    it('rejects localhost', () => {
        expect(() => assertSafeOutboundHttpsUrl('https://localhost/v1'))
            .toThrow(/not allowed/);
    });

    it('rejects private IPv4 literals', () => {
        expect(() => assertSafeOutboundHttpsUrl('https://192.168.1.1/'))
            .toThrow(/restricted/);
    });
});
