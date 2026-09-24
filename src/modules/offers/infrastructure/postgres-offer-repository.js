import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Offer } from '../domain/offer.js';
import { ListingStatus } from '../domain/listing-status.js';
import { OfferStatus } from '../domain/offer-status.js';
const offerRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    product_id: z.string().uuid(),
    channel_id: z.string().uuid(),
    status: z.enum([
        OfferStatus.DRAFT,
        OfferStatus.ACTIVE,
        OfferStatus.INACTIVE,
        OfferStatus.SUSPENDED,
    ]),
    external_reference: z.string().nullable(),
    price_reference: z.string().uuid().nullable(),
    listing_status: z.enum([ListingStatus.UNLISTED, ListingStatus.LISTED, ListingStatus.DELISTED]),
    created_at: z.date(),
    updated_at: z.date(),
});
function toOffer(row) {
    return Offer.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        productId: row.product_id,
        channelId: row.channel_id,
        status: row.status,
        externalReference: row.external_reference,
        priceReference: row.price_reference,
        listingStatus: row.listing_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
const offerSelectColumns = `id, tenant_id, product_id, channel_id, status, external_reference,
  price_reference, listing_status, created_at, updated_at`;
export class PostgresOfferRepository {
    async findById(queryable, tenantId, offerId) {
        const result = await queryable.query(`SELECT ${offerSelectColumns}
       FROM offers
       WHERE tenant_id = $1 AND id = $2`, [tenantId, offerId], { operation: 'offers.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOffer(parseOrThrow(offerRowSchema, row, 'offers row'));
    }
    async findByProductAndChannel(queryable, tenantId, productId, channelId) {
        const result = await queryable.query(`SELECT ${offerSelectColumns}
       FROM offers
       WHERE tenant_id = $1 AND product_id = $2 AND channel_id = $3`, [tenantId, productId, channelId], { operation: 'offers.find_by_product_and_channel' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOffer(parseOrThrow(offerRowSchema, row, 'offers row'));
    }
    async findByExternalReference(queryable, tenantId, channelId, externalReference) {
        const result = await queryable.query(`SELECT ${offerSelectColumns}
       FROM offers
       WHERE tenant_id = $1 AND channel_id = $2 AND external_reference = $3
       ORDER BY created_at ASC
       LIMIT 1`, [tenantId, channelId, externalReference], { operation: 'offers.find_by_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOffer(parseOrThrow(offerRowSchema, row, 'offers row'));
    }
    async listByChannel(queryable, tenantId, channelId, filters = {}) {
        const conditions = ['tenant_id = $1', 'channel_id = $2'];
        const parameters = [tenantId, channelId];
        if (filters.status !== undefined) {
            parameters.push(filters.status);
            conditions.push(`status = $${parameters.length}`);
        }
        const result = await queryable.query(`SELECT ${offerSelectColumns}
       FROM offers
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`, parameters, { operation: 'offers.list_by_channel' });
        return result.rows.map((row) => toOffer(parseOrThrow(offerRowSchema, row, 'offers row')));
    }
    async listByProduct(queryable, tenantId, productId, filters = {}) {
        const conditions = ['tenant_id = $1', 'product_id = $2'];
        const parameters = [tenantId, productId];
        if (filters.channelId !== undefined) {
            parameters.push(filters.channelId);
            conditions.push(`channel_id = $${parameters.length}`);
        }
        if (filters.status !== undefined) {
            parameters.push(filters.status);
            conditions.push(`status = $${parameters.length}`);
        }
        const result = await queryable.query(`SELECT ${offerSelectColumns}
       FROM offers
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`, parameters, { operation: 'offers.list_by_product' });
        return result.rows.map((row) => toOffer(parseOrThrow(offerRowSchema, row, 'offers row')));
    }
    async listPage(queryable, tenantId, filters, limit, cursorCreatedAt, cursorId) {
        const conditions = ['tenant_id = $1'];
        const parameters = [tenantId];
        if (filters.productId !== undefined) {
            parameters.push(filters.productId);
            conditions.push(`product_id = $${parameters.length}`);
        }
        if (filters.channelId !== undefined) {
            parameters.push(filters.channelId);
            conditions.push(`channel_id = $${parameters.length}`);
        }
        if (filters.status !== undefined) {
            parameters.push(filters.status);
            conditions.push(`status = $${parameters.length}`);
        }
        if (cursorCreatedAt !== null && cursorId !== null) {
            parameters.push(cursorCreatedAt, cursorId);
            conditions.push(`(created_at, id) < ($${parameters.length - 1}, $${parameters.length})`);
        }
        parameters.push(limit);
        const result = await queryable.query(`SELECT ${offerSelectColumns}
       FROM offers
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${parameters.length}`, parameters, { operation: 'offers.list_page' });
        return {
            items: result.rows.map((row) => toOffer(parseOrThrow(offerRowSchema, row, 'offers row'))),
        };
    }
    async insert(transaction, offer) {
        await transaction.query(`INSERT INTO offers (
         id, tenant_id, product_id, channel_id, status, external_reference,
         price_reference, listing_status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
            offer.id,
            offer.tenantId,
            offer.productId,
            offer.channelId,
            offer.status,
            offer.externalReference,
            offer.priceReference,
            offer.listingStatus,
            offer.createdAt,
            offer.updatedAt,
        ], { operation: 'offers.insert' });
    }
    async update(transaction, offer) {
        await transaction.query(`UPDATE offers
       SET status = $3,
           external_reference = $4,
           price_reference = $5,
           listing_status = $6,
           updated_at = $7
       WHERE tenant_id = $1 AND id = $2`, [
            offer.tenantId,
            offer.id,
            offer.status,
            offer.externalReference,
            offer.priceReference,
            offer.listingStatus,
            offer.updatedAt,
        ], { operation: 'offers.update' });
    }
}
