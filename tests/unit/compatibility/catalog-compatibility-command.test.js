import { describe, expect, it, vi } from 'vitest';
import { CatalogCompatibilityCommand } from '../../../src/modules/compatibility/application/catalog-compatibility-command.js';

function buildCommand(overrides = {}) {
    const authorization = {
        requirePermission: vi.fn(),
    };
    const idempotency = {
        execute: vi.fn(async (_key, _fp, op) => ({ kind: 'fresh', value: await op() })),
    };
    const productQueryService = {
        getProductBySku: vi.fn(async () => null),
    };
    const createProduct = {
        execute: vi.fn(async () => ({ product: { id: 'p1', merchantSku: 'NEW-SKU', status: 'ACTIVE' } })),
    };
    const upsertProductContent = { execute: vi.fn(async () => ({})) };
    const deps = {
        authorization,
        idempotency,
        productQueryService,
        channelQueryService: {},
        inventoryService: {},
        pricingService: {},
        offerQueryService: {},
        createProduct,
        deactivateProduct: { execute: vi.fn() },
        upsertProductContent,
        getProductContent: { execute: vi.fn() },
        createPrice: { execute: vi.fn() },
        updatePrice: { execute: vi.fn() },
        createOffer: { execute: vi.fn() },
        activateOffer: { execute: vi.fn() },
        suspendOffer: { execute: vi.fn() },
        adjustInventory: { execute: vi.fn() },
        ...overrides,
    };
    return { command: new CatalogCompatibilityCommand(deps), deps };
}

describe('CatalogCompatibilityCommand', () => {
    it('creates products in batch with partial success', async () => {
        const { command, deps } = buildCommand();
        const result = await command.upsertProducts({
            tenantId: 't1',
            actorId: 'a1',
            actorKind: 'user',
            actorPermissions: ['products.create'],
            body: [
                { MerchantProductNo: 'OK-1', Name: 'One' },
                { MerchantProductNo: '', Name: 'Bad' },
            ],
            idempotencyKey: 'key-1',
            principalFingerprint: 'fp',
        });
        expect(deps.createProduct.execute).toHaveBeenCalledTimes(1);
        expect(result.Success).toBe(false);
        expect(result.Content).toHaveLength(2);
    });

    it('replays idempotent product upsert', async () => {
        const { command, deps } = buildCommand({
            idempotency: {
                execute: vi.fn(async () => ({
                    kind: 'replayed',
                    value: { Success: true, Content: [] },
                })),
            },
        });
        const result = await command.upsertProducts({
            tenantId: 't1',
            actorId: 'a1',
            actorKind: 'user',
            actorPermissions: ['products.create'],
            body: { MerchantProductNo: 'SKU-1' },
            idempotencyKey: 'key-dup',
            principalFingerprint: 'fp',
        });
        expect(deps.createProduct.execute).not.toHaveBeenCalled();
        expect(result.Success).toBe(true);
    });
});
