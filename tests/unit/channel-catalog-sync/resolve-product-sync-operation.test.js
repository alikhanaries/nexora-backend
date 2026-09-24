import { describe, expect, it } from 'vitest';
import { CatalogSyncOperation } from '../../../src/modules/channel-catalog-sync/domain/sync-operation.js';
import { resolveProductSyncOperation } from '../../../src/modules/channel-catalog-sync/application/resolve-product-sync-operation.js';

describe('resolveProductSyncOperation', () => {
    it('uses sync for create and update events', () => {
        expect(resolveProductSyncOperation('product.created', {})).toBe(CatalogSyncOperation.SYNC);
        expect(resolveProductSyncOperation('product.updated', {})).toBe(CatalogSyncOperation.SYNC);
    });

    it('uses deactivate when product status is not active', () => {
        expect(resolveProductSyncOperation('product.status_changed', { status: 'ARCHIVED' }))
            .toBe(CatalogSyncOperation.DEACTIVATE);
    });
});
