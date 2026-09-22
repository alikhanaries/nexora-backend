import { describe, expect, it, vi } from 'vitest';
import { DefaultOrderCommandService } from '../../../src/modules/orders/public/order-command-service.js';
import { AuthorizationError } from '../../../src/shared/errors/index.js';

const baseCommand = {
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    actorKind: 'user',
    actorPermissions: ['orders.create'],
    channelId: 'channel-1',
    currency: 'USD',
    lines: [{
        productId: 'product-1',
        stockLocationId: 'location-1',
        quantity: 2,
    }],
};

const orderDetail = {
    id: 'order-1',
    tenantId: 'tenant-1',
    channelId: 'channel-1',
    externalOrderReference: null,
    orderNumber: 'ORD-001',
    status: 'CONFIRMED',
    currency: 'USD',
    subtotalMinor: 5000,
    discountMinor: 0,
    taxMinor: 0,
    shippingMinor: 0,
    totalMinor: 5000,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    confirmedAt: new Date('2026-01-01T00:00:00.000Z'),
    cancelledAt: null,
    shippedAt: null,
    deliveredAt: null,
    lines: [],
    customer: { id: 'customer-1', tenantId: 'tenant-1', orderId: 'order-1' },
};

describe('DefaultOrderCommandService', () => {
    it('delegates createOrder to the CreateOrder use case', async () => {
        const createOrder = {
            execute: vi.fn().mockResolvedValue({ order: orderDetail }),
        };
        const service = new DefaultOrderCommandService({
            createOrder,
            createChannelOrder: { execute: vi.fn() },
            acknowledgeOrder: { execute: vi.fn() },
        });

        const result = await service.createOrder(baseCommand);

        expect(createOrder.execute).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['orders.create'],
            channelId: 'channel-1',
            currency: 'USD',
            lines: [{
                productId: 'product-1',
                stockLocationId: 'location-1',
                quantity: 2,
            }],
        }));
        expect(result).toEqual({ order: orderDetail });
    });

    it('preserves authorization failures from the underlying use case', async () => {
        const createOrder = {
            execute: vi.fn().mockRejectedValue(new AuthorizationError('Missing required permission: orders.create')),
        };
        const service = new DefaultOrderCommandService({
            createOrder,
            createChannelOrder: { execute: vi.fn() },
            acknowledgeOrder: { execute: vi.fn() },
        });

        await expect(service.createOrder({
            ...baseCommand,
            actorPermissions: [],
        })).rejects.toBeInstanceOf(AuthorizationError);
    });

    it('wraps createOrder in idempotency when an idempotency key is provided', async () => {
        const createOrder = {
            execute: vi.fn().mockImplementation(async ({ transaction }) => ({
                order: { ...orderDetail, transactionProvided: transaction !== undefined },
            })),
        };
        const idempotency = {
            execute: vi.fn().mockImplementation(async (_key, _fingerprint, operation) => {
                const value = await operation({ tx: true });
                return { kind: 'executed', value };
            }),
        };
        const service = new DefaultOrderCommandService({
            createOrder,
            createChannelOrder: { execute: vi.fn() },
            idempotency,
        });

        const result = await service.createOrder({
            ...baseCommand,
            idempotencyKey: 'idem-1',
            principalFingerprint: 'principal-1',
            requestFingerprint: 'body-1',
        });

        expect(idempotency.execute).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            principalFingerprint: 'principal-1',
            routeId: 'orders.create',
            idempotencyKey: 'idem-1',
        }, 'body-1', expect.any(Function), expect.any(Function), { useTransaction: true });
        expect(createOrder.execute).toHaveBeenCalledWith(expect.objectContaining({
            transaction: { tx: true },
        }));
        expect(result.order).toMatchObject({ id: 'order-1', transactionProvided: true });
    });

    it('returns application DTOs without repository or SQL details', async () => {
        const createOrder = {
            execute: vi.fn().mockResolvedValue({ order: orderDetail }),
        };
        const service = new DefaultOrderCommandService({
            createOrder,
            createChannelOrder: { execute: vi.fn() },
            acknowledgeOrder: { execute: vi.fn() },
        });

        const result = await service.createOrder(baseCommand);

        expect(result.order).not.toHaveProperty('rows');
        expect(result.order).not.toHaveProperty('repository');
        expect(result.order).toMatchObject({
            id: 'order-1',
            orderNumber: 'ORD-001',
            tenantId: 'tenant-1',
        });
    });

    it('delegates acknowledgeOrder to AcknowledgeOrder use case', async () => {
        const acknowledgeOrder = {
            execute: vi.fn().mockResolvedValue({ order: { ...orderDetail, status: 'CONFIRMED' } }),
        };
        const service = new DefaultOrderCommandService({
            createOrder: { execute: vi.fn() },
            createChannelOrder: { execute: vi.fn() },
            acknowledgeOrder,
        });

        const result = await service.acknowledgeOrder({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['orders.update'],
            orderNumber: 'ORD-001',
        });

        expect(acknowledgeOrder.execute).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            orderNumber: 'ORD-001',
        }));
        expect(result.order.status).toBe('CONFIRMED');
    });

    it('delegates createChannelOrder to the CreateChannelOrder use case', async () => {
        const createChannelOrder = {
            execute: vi.fn().mockResolvedValue({ order: { ...orderDetail, status: 'NEW', confirmedAt: null } }),
        };
        const service = new DefaultOrderCommandService({
            createOrder: { execute: vi.fn() },
            createChannelOrder,
            acknowledgeOrder: { execute: vi.fn() },
        });

        const result = await service.createChannelOrder({
            ...baseCommand,
            externalOrderReference: 'EXT-001',
            lines: [{
                stockLocationId: 'location-1',
                quantity: 2,
                merchantSku: 'SKU-001',
            }],
        });

        expect(createChannelOrder.execute).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            channelId: 'channel-1',
            externalOrderReference: 'EXT-001',
            lines: [{
                stockLocationId: 'location-1',
                quantity: 2,
                merchantSku: 'SKU-001',
            }],
        }));
        expect(result.order.status).toBe('NEW');
    });

    it('wraps createChannelOrder in idempotency when an idempotency key is provided', async () => {
        const createChannelOrder = {
            execute: vi.fn().mockImplementation(async ({ transaction }) => ({
                order: { ...orderDetail, status: 'NEW', transactionProvided: transaction !== undefined },
            })),
        };
        const idempotency = {
            execute: vi.fn().mockImplementation(async (_key, _fingerprint, operation) => {
                const value = await operation({ tx: true });
                return { kind: 'executed', value };
            }),
        };
        const service = new DefaultOrderCommandService({
            createOrder: { execute: vi.fn() },
            createChannelOrder,
            idempotency,
        });

        const result = await service.createChannelOrder({
            ...baseCommand,
            externalOrderReference: 'EXT-001',
            lines: [{
                stockLocationId: 'location-1',
                quantity: 2,
                merchantSku: 'SKU-001',
            }],
            idempotencyKey: 'idem-channel-1',
            principalFingerprint: 'principal-1',
            requestFingerprint: 'body-1',
        });

        expect(idempotency.execute).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            principalFingerprint: 'principal-1',
            routeId: 'orders.create_channel',
            idempotencyKey: 'idem-channel-1',
        }, 'body-1', expect.any(Function), expect.any(Function), { useTransaction: true });
        expect(result.order).toMatchObject({ transactionProvided: true, status: 'NEW' });
    });

    it('wraps acknowledgeOrder in idempotency when an idempotency key is provided', async () => {
        const acknowledgeOrder = {
            execute: vi.fn().mockImplementation(async ({ transaction }) => ({
                order: { ...orderDetail, transactionProvided: transaction !== undefined },
            })),
        };
        const idempotency = {
            execute: vi.fn().mockImplementation(async (_key, _fingerprint, operation) => {
                const value = await operation({ tx: true });
                return { kind: 'executed', value };
            }),
        };
        const service = new DefaultOrderCommandService({
            createOrder: { execute: vi.fn() },
            acknowledgeOrder,
            idempotency,
        });

        const result = await service.acknowledgeOrder({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['orders.update'],
            orderNumber: 'ORD-001',
            idempotencyKey: 'idem-ack-1',
            principalFingerprint: 'principal-1',
            requestFingerprint: 'body-1',
        });

        expect(idempotency.execute).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            principalFingerprint: 'principal-1',
            routeId: 'orders.acknowledge',
            idempotencyKey: 'idem-ack-1',
        }, 'body-1', expect.any(Function), expect.any(Function), { useTransaction: true });
        expect(result.order).toMatchObject({ transactionProvided: true });
    });
});
