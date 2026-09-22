import { describe, expect, it } from 'vitest';
import { buildWebhookEventEnvelope } from '../../../src/modules/webhooks/application/build-webhook-event-envelope.js';
import { signWebhookRequestBody, verifyWebhookRequestBody } from '../../../src/modules/webhooks/application/webhook-request-signer.js';

describe('webhook request signer', () => {
    it('produces deterministic HMAC signatures for known secret and body', () => {
        const body = '{"hello":"world"}';
        const first = signWebhookRequestBody('test-secret', body);
        const second = signWebhookRequestBody('test-secret', body);
        expect(first).toBe(second);
        expect(verifyWebhookRequestBody('test-secret', body, first)).toBe(true);
    });

    it('signs the exact envelope bytes that are sent', () => {
        const event = {
            id: '11111111-1111-4111-8111-111111111111',
            type: 'order.created',
            version: 1,
            aggregateType: 'order',
            aggregateId: '22222222-2222-4222-8222-222222222222',
            tenantId: '33333333-3333-4333-8333-333333333333',
            payload: { orderNumber: 'ORD-1' },
            occurredAt: new Date('2026-01-01T00:00:00.000Z'),
            correlationId: 'corr-1',
        };
        const body = buildWebhookEventEnvelope(event);
        const signature = signWebhookRequestBody('signing-secret', body);
        expect(verifyWebhookRequestBody('signing-secret', body, signature)).toBe(true);
        expect(verifyWebhookRequestBody('signing-secret', `${body} `, signature)).toBe(false);
    });

    it('changes the signature when the body changes', () => {
        const first = signWebhookRequestBody('secret', '{"a":1}');
        const second = signWebhookRequestBody('secret', '{"a":2}');
        expect(first).not.toBe(second);
    });

    it('does not embed the secret in the signature header', () => {
        const signature = signWebhookRequestBody('super-secret-value', '{"ok":true}');
        expect(signature).not.toContain('super-secret-value');
        expect(signature.startsWith('v1=')).toBe(true);
    });
});
