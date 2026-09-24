import { z } from 'zod';
import { CatalogSyncTarget } from '../domain/sync-target.js';
import { CatalogSyncOperation } from '../domain/sync-operation.js';

export const catalogSyncJobPayloadSchema = z.object({
    tenantId: z.string().uuid(),
    channelId: z.string().uuid(),
    target: z.enum([
        CatalogSyncTarget.PRODUCT,
        CatalogSyncTarget.OFFER,
        CatalogSyncTarget.INVENTORY,
        CatalogSyncTarget.PRICE,
        CatalogSyncTarget.CHANNEL_INVENTORY_RESYNC,
    ]),
    entityId: z.string().uuid(),
    operation: z.enum([CatalogSyncOperation.SYNC]),
    sourceEventId: z.string().uuid(),
    correlationId: z.string().nullable(),
    stockLocationId: z.string().uuid().optional(),
});
