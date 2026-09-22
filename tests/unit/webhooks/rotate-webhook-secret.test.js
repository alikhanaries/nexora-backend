import { describe, expect, it, vi } from 'vitest';
import { DefaultAuthorizationService } from '../../../src/modules/authorization/public/index.js';
import { RotateWebhookSecret } from '../../../src/modules/webhooks/application/rotate-webhook-secret.js';
import { WebhookSubscription } from '../../../src/modules/webhooks/domain/webhook-subscription.js';
import { AuthorizationError, ValidationError } from '../../../src/shared/errors/index.js';

const WEBHOOK_PERMISSIONS = ['webhooks.read', 'webhooks.manage'];

function buildSubscription() {
    return WebhookSubscription.reconstitute({
        id: '11111111-1111-4111-8111-111111111111',
        tenantId: '22222222-2222-4222-8222-222222222222',
        url: 'https://example.com/hook',
        description: null,
        secretCiphertext: 'old-ciphertext',
        eventTypes: ['order.created'],
        status: 'ACTIVE',
        createdBy: '33333333-3333-4333-8333-333333333333',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
}

describe('RotateWebhookSecret', () => {
    it('requires step-up authentication', async () => {
        const useCase = new RotateWebhookSecret({
            authorization: new DefaultAuthorizationService(),
            rateLimiter: { consume: vi.fn(async () => ({ allowed: true })) },
            stepUpVerifier: { hasValidStepUp: vi.fn(async () => false) },
            secretEncryptor: { encrypt: vi.fn(() => 'new-ciphertext') },
            database: { execute: vi.fn() },
            subscriptions: { findById: vi.fn(), updateSecret: vi.fn() },
        });
        await expect(useCase.execute({
            tenantId: '22222222-2222-4222-8222-222222222222',
            actorId: '33333333-3333-4333-8333-333333333333',
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            subscriptionId: '11111111-1111-4111-8111-111111111111',
        })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects callers without recent step-up proof', async () => {
        const useCase = new RotateWebhookSecret({
            authorization: new DefaultAuthorizationService(),
            rateLimiter: { consume: vi.fn(async () => ({ allowed: true })) },
            stepUpVerifier: { hasValidStepUp: vi.fn(async () => false) },
            secretEncryptor: { encrypt: vi.fn(() => 'new-ciphertext') },
            database: { execute: vi.fn() },
            subscriptions: { findById: vi.fn(), updateSecret: vi.fn() },
        });
        await expect(useCase.execute({
            tenantId: '22222222-2222-4222-8222-222222222222',
            actorId: '33333333-3333-4333-8333-333333333333',
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            sessionId: 'session-1',
            subscriptionId: '11111111-1111-4111-8111-111111111111',
        })).rejects.toBeInstanceOf(AuthorizationError);
    });

    it('returns a new secret without exposing the old secret', async () => {
        const subscription = buildSubscription();
        const updateSecret = vi.fn(async () => undefined);
        const useCase = new RotateWebhookSecret({
            authorization: new DefaultAuthorizationService(),
            rateLimiter: { consume: vi.fn(async () => ({ allowed: true })) },
            stepUpVerifier: { hasValidStepUp: vi.fn(async () => true) },
            secretEncryptor: { encrypt: vi.fn(() => 'new-ciphertext') },
            auditRecorder: { record: vi.fn(async () => undefined) },
            database: {
                execute: vi.fn(async (callback) => callback({
                    query: vi.fn(),
                })),
            },
            subscriptions: {
                findById: vi.fn(async () => subscription),
                updateSecret,
            },
        });
        const result = await useCase.execute({
            tenantId: subscription.tenantId,
            actorId: '33333333-3333-4333-8333-333333333333',
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            sessionId: 'session-1',
            subscriptionId: subscription.id,
        });
        expect(result.secret).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(result.subscription).not.toHaveProperty('secret');
        expect(result.subscription).not.toHaveProperty('secretCiphertext');
        expect(updateSecret).toHaveBeenCalledTimes(1);
    });
});
