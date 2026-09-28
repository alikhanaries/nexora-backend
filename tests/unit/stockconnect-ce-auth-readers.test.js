import { describe, expect, it } from 'vitest';
import {
    readMerchantCompatCeKeyHeader,
    readMerchantCompatQueryApiKey,
} from '../../src/shared/auth/read-merchant-compat-query-api-key.js';

describe('merchant compat API key readers', () => {
    it('reads apiKey and apikey query params', () => {
        expect(readMerchantCompatQueryApiKey({ apiKey: ' a ' })).toBe('a');
        expect(readMerchantCompatQueryApiKey({ apikey: 'b' })).toBe('b');
        expect(readMerchantCompatQueryApiKey({})).toBeNull();
    });

    it('reads X-CE-KEY header', () => {
        expect(readMerchantCompatCeKeyHeader({ 'x-ce-key': ' secret ' })).toBe('secret');
        expect(readMerchantCompatCeKeyHeader({ 'x-ce-key': ['first'] })).toBe('first');
        expect(readMerchantCompatCeKeyHeader({})).toBeNull();
    });
});
