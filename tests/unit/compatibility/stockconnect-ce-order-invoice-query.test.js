import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import { StockConnectCeOrderInvoiceQuery } from '../../../src/modules/compatibility/application/stockconnect-ce-order-invoice-query.js';

describe('StockConnectCeOrderInvoiceQuery', () => {
    it('returns PDF for an order in the tenant', async () => {
        const tenantId = randomUUID();
        const query = new StockConnectCeOrderInvoiceQuery({
            orderQueryService: {
                listOrders: vi.fn(async () => ({
                    items: [{
                        orderNumber: 'ORD-1',
                        externalOrderReference: 'EXT-1',
                        createdAt: new Date('2026-01-01T00:00:00.000Z'),
                        lines: [],
                    }],
                    totalCount: 1,
                    page: 1,
                    pageSize: 1,
                })),
            },
        });
        const result = await query.getOrderInvoice({
            tenantId,
            actorPermissions: ['orders.read'],
            merchantOrderNo: 'ORD-1',
        });
        expect(result.contentType).toBe('application/pdf');
        expect(result.body.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });

    it('throws NotFoundError when merchant order is missing', async () => {
        const query = new StockConnectCeOrderInvoiceQuery({
            orderQueryService: {
                listOrders: vi.fn(async () => ({
                    items: [],
                    totalCount: 0,
                    page: 1,
                    pageSize: 1,
                })),
            },
        });
        await expect(query.getOrderInvoice({
            tenantId: randomUUID(),
            actorPermissions: ['orders.read'],
            merchantOrderNo: 'missing',
        })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('scopes lookup to tenant via order query service', async () => {
        const tenantId = randomUUID();
        const listOrders = vi.fn(async () => ({
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 1,
        }));
        const query = new StockConnectCeOrderInvoiceQuery({
            orderQueryService: { listOrders },
        });
        await expect(query.getOrderInvoice({
            tenantId,
            actorPermissions: ['orders.read'],
            merchantOrderNo: 'ORD-X',
        })).rejects.toBeInstanceOf(NotFoundError);
        expect(listOrders).toHaveBeenCalledWith(expect.objectContaining({
            tenantId,
            orderNumber: 'ORD-X',
        }));
    });
});
