import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildCompatV2WebhookBody } from '../../../src/modules/compatibility/application/build-compat-v2-webhook-body.js';

describe('buildCompatV2WebhookBody', () => {
    it('maps order.created to CE Content envelope', async () => {
        const tenantId = randomUUID();
        const orderId = randomUUID();
        const channelId = randomUUID();
        const orderQueryService = {
            findOrderById: vi.fn(async () => ({
                id: orderId,
                tenantId,
                channelId,
                orderNumber: 'ORD-100',
                externalOrderReference: 'MP-100',
                status: 'NEW',
                currency: 'SAR',
                subtotalMinor: 10000,
                shippingMinor: 0,
                totalMinor: 10000,
                createdAt: new Date('2026-01-15T10:00:00.000Z'),
                updatedAt: new Date('2026-01-15T10:00:00.000Z'),
            })),
            getOrderLines: vi.fn(async () => [{
                id: randomUUID(),
                orderId,
                merchantSku: 'SKU-1',
                quantity: 2,
                unitPriceMinor: 5000,
                lineTotalMinor: 10000,
                currency: 'SAR',
            }]),
        };
        const commerceIntegrationQueryService = {
            getCommerceIntegrationById: vi.fn(async () => ({
                id: channelId,
                name: 'Noon SA',
                externalReference: '42',
            })),
        };
        const externalIntegerIdMappingQueryService = {
            findExternalIdsByResourceIds: vi.fn(async () => new Map()),
        };
        const body = await buildCompatV2WebhookBody({
            orderQueryService,
            commerceIntegrationQueryService,
            externalIntegerIdMappingQueryService,
        }, {
            id: randomUUID(),
            type: 'order.created',
            version: 1,
            aggregateType: 'order',
            aggregateId: orderId,
            tenantId,
            payload: { orderId },
            occurredAt: new Date(),
            correlationId: null,
        });
        expect(body).not.toBeNull();
        const parsed = JSON.parse(body);
        expect(parsed.Content).toHaveLength(1);
        expect(parsed.Content[0].MerchantOrderNo).toBe('ORD-100');
        expect(parsed.Content[0].ChannelId).toBe(42);
        expect(parsed.Content[0].Lines[0].ExtraData).toEqual([]);
    });

    it('returns null for unsupported event types', async () => {
        const body = await buildCompatV2WebhookBody({
            orderQueryService: { findOrderById: vi.fn(), getOrderLines: vi.fn() },
            commerceIntegrationQueryService: { getCommerceIntegrationById: vi.fn() },
            externalIntegerIdMappingQueryService: { findExternalIdsByResourceIds: vi.fn() },
        }, {
            id: randomUUID(),
            type: 'shipment.created',
            version: 1,
            aggregateType: 'shipment',
            aggregateId: randomUUID(),
            tenantId: randomUUID(),
            payload: {},
            occurredAt: new Date(),
            correlationId: null,
        });
        expect(body).toBeNull();
    });
});
