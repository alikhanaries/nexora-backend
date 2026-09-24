import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';
import { planCatalogSyncJobsFromEvent } from '../../../src/modules/channel-catalog-sync/application/plan-catalog-sync-jobs.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const channelA = '22222222-2222-4222-8222-222222222222';
const channelB = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
const offerId = '55555555-5555-4555-8555-555555555555';
const priceId = '66666666-6666-4666-8666-666666666666';
const stockLocationId = '77777777-7777-4777-8777-777777777777';
const eventId = '88888888-8888-4888-8888-888888888888';

function baseEvent(type, payload) {
    return {
        id: eventId,
        type,
        version: 1,
        aggregateType: 'test',
        aggregateId: productId,
        tenantId,
        payload,
        occurredAt: new Date(),
        correlationId: 'corr-1',
    };
}

describe('planCatalogSyncJobsFromEvent', () => {
    it('plans product events for each offer channel', async () => {
        const offerQueryService = {
            getOffersByProduct: vi.fn().mockResolvedValue([
                { channelId: channelA },
                { channelId: channelB },
            ]),
        };
        const channelQueryService = { listChannels: vi.fn() };
        const jobs = await planCatalogSyncJobsFromEvent(
            baseEvent('product.updated', { productId }),
            { offerQueryService, channelQueryService },
        );
        expect(jobs).toHaveLength(2);
        expect(jobs.every((job) => job.target === CatalogSyncTarget.PRODUCT && job.entityId === productId)).toBe(true);
    });

    it('plans offer events for the payload channel', async () => {
        const jobs = await planCatalogSyncJobsFromEvent(
            baseEvent('offer.created', { id: offerId, channelId: channelA, productId }),
            {
                offerQueryService: { getOffersByProduct: vi.fn() },
                channelQueryService: { listChannels: vi.fn() },
            },
        );
        expect(jobs).toEqual([expect.objectContaining({
            channelId: channelA,
            target: CatalogSyncTarget.OFFER,
            entityId: offerId,
        })]);
    });

    it('plans inventory events for channels using legacy configurationReference stock location', async () => {
        const legacyLocationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const channelQueryService = {
            listChannels: vi.fn().mockResolvedValue([
                {
                    id: channelA,
                    defaultStockLocationId: null,
                    configurationReference: legacyLocationId,
                },
            ]),
        };
        const jobs = await planCatalogSyncJobsFromEvent(
            baseEvent('inventory.inventory_changed', { productId, stockLocationId: legacyLocationId }),
            {
                offerQueryService: { getOffersByProduct: vi.fn() },
                channelQueryService,
            },
        );
        expect(jobs).toHaveLength(1);
        expect(jobs[0].channelId).toBe(channelA);
    });

    it('plans inventory events only for channels at the stock location', async () => {
        const channelQueryService = {
            listChannels: vi.fn().mockResolvedValue([
                { id: channelA, defaultStockLocationId: stockLocationId },
                { id: channelB, defaultStockLocationId: '00000000-0000-4000-8000-000000009999' },
            ]),
        };
        const jobs = await planCatalogSyncJobsFromEvent(
            baseEvent('inventory.inventory_changed', { productId, stockLocationId }),
            {
                offerQueryService: { getOffersByProduct: vi.fn() },
                channelQueryService,
            },
        );
        expect(jobs).toHaveLength(1);
        expect(jobs[0].channelId).toBe(channelA);
        expect(jobs[0].target).toBe(CatalogSyncTarget.INVENTORY);
        expect(jobs[0].stockLocationId).toBe(stockLocationId);
    });

    it('plans price events when channelId is present', async () => {
        const jobs = await planCatalogSyncJobsFromEvent(
            baseEvent('price.changed', { id: priceId, channelId: channelA, productId, currency: 'USD' }),
            {
                offerQueryService: { getOffersByProduct: vi.fn() },
                channelQueryService: { listChannels: vi.fn() },
            },
        );
        expect(jobs[0].target).toBe(CatalogSyncTarget.PRICE);
        expect(jobs[0].entityId).toBe(productId);
        expect(jobs[0].currency).toBe('USD');
    });

    it('plans price sync jobs when an offer becomes active', async () => {
        const pricingService = {
            listPrices: vi.fn().mockResolvedValue({
                items: [
                    { currency: 'USD' },
                    { currency: 'EUR' },
                ],
            }),
        };
        const jobs = await planCatalogSyncJobsFromEvent(
            baseEvent('offer.status_changed', {
                id: offerId,
                channelId: channelA,
                productId,
                status: 'ACTIVE',
            }),
            {
                offerQueryService: { getOffersByProduct: vi.fn() },
                channelQueryService: { listChannels: vi.fn() },
                pricingService,
            },
        );
        expect(jobs).toHaveLength(2);
        expect(jobs.every((job) => job.target === CatalogSyncTarget.PRICE)).toBe(true);
    });

    it('ignores unrelated integration events', async () => {
        const jobs = await planCatalogSyncJobsFromEvent(
            baseEvent('order.created', { orderId: '99999999-9999-4999-8999-999999999999' }),
            {
                offerQueryService: { getOffersByProduct: vi.fn() },
                channelQueryService: { listChannels: vi.fn() },
            },
        );
        expect(jobs).toEqual([]);
    });
});
