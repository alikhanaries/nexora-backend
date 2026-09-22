import { lookup } from 'node:dns/promises';
import { describe, expect, it, vi } from 'vitest';
import { validateOutboundWebhookUrl } from '../../../src/shared/security/ssrf-validator.js';

vi.mock('node:dns/promises', () => ({
    lookup: vi.fn(),
}));

describe('validateOutboundWebhookUrl', () => {
    it('rejects non-HTTPS URLs', async () => {
        await expect(validateOutboundWebhookUrl('http://example.com/hook')).rejects.toThrow(/HTTPS/i);
    });

    it('rejects localhost hostnames', async () => {
        await expect(validateOutboundWebhookUrl('https://localhost/hook')).rejects.toThrow(/not allowed/i);
    });

    it('rejects IPv4 loopback literals', async () => {
        await expect(validateOutboundWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow(/restricted/i);
    });

    it('rejects IPv6 loopback literals', async () => {
        await expect(validateOutboundWebhookUrl('https://[::1]/hook')).rejects.toThrow(/restricted/i);
    });

    it('rejects private IPv4 literals', async () => {
        await expect(validateOutboundWebhookUrl('https://10.0.0.5/hook')).rejects.toThrow(/restricted/i);
        await expect(validateOutboundWebhookUrl('https://192.168.1.10/hook')).rejects.toThrow(/restricted/i);
    });

    it('rejects link-local/metadata IPv4 literals', async () => {
        await expect(validateOutboundWebhookUrl('https://169.254.169.254/latest/meta-data')).rejects.toThrow(/restricted/i);
    });

    it('rejects hostnames that resolve to private addresses', async () => {
        lookup.mockResolvedValue([{ address: '10.0.0.8', family: 4 }]);
        await expect(validateOutboundWebhookUrl('https://hooks.example.com/path')).rejects.toThrow(/restricted/i);
    });

    it('accepts hostnames that resolve to public addresses', async () => {
        lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
        const url = await validateOutboundWebhookUrl('https://hooks.example.com/path');
        expect(url.hostname).toBe('hooks.example.com');
    });
});
