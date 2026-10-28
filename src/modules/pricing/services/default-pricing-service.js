import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../../shared/errors/index.js';
import { parseCurrency } from '../../../shared/money/index.js';
import { clampCursorLimit, decodeCursor, encodeCursor, } from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { createPriceEntity, deactivatePriceEntity, updatePriceEntity } from '../models/price.js';
import { toPriceDto } from './price-dto.js';
import { priceChangedEvent, priceCreatedEvent, priceUpdatedEvent } from './price-events.js';

/**
 * @param {object} deps
 */
export function createDefaultPricingService(deps) {
/** Resolves the active price for a product/channel at a point in time within the tenant. */
    async function getEffectivePrice(tenantId, productId, channelId, currency, at = new Date(), tx) {
        const queryable = tx ?? deps.queryable;
        const normalizedCurrency = parseCurrency(currency);
        const price = await deps.prices.findEffective(queryable, tenantId, productId, channelId, normalizedCurrency, at);
        return price === null ? null : toPriceDto(price);
    }

/**
     * Creates a price row after product (and optional channel) tenant checks; emits price events.
     * @param {object} input Tenant, product, channel, currency, amount, validity window.
     * @param {object|undefined} tx Optional transaction.
     */
    async function createPrice(input, tx) {
        const belongs = await deps.productQueryService.verifyProductBelongsToTenant(input.tenantId, input.productId, tx);
        if (!belongs) {
            throw new NotFoundError('Product was not found', {
                tenantId: input.tenantId,
                productId: input.productId,
            });
        }
        if (input.channelId !== undefined && input.channelId !== null) {
            await deps.commerceIntegrationQueryService.verifyChannelBelongsToTenant(input.tenantId, input.channelId, tx);
        }
        const now = new Date();
        const price = createPriceEntity({
            id: randomUUID(),
            tenantId: input.tenantId,
            productId: input.productId,
            currency: input.currency,
            amountMinor: input.amountMinor,
            validFrom: input.validFrom ?? now,
            ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            createdAt: now,
        });
/**
     * Transaction step: insert price and record created/changed integration events.
     * @param {object} transaction Active SQL transaction.
     */
        const save = async (transaction) => {
            await deps.prices.insert(transaction, price);
            const dto = toPriceDto(price);
            await deps.eventRecorder.record(transaction, priceCreatedEvent(dto));
            await deps.eventRecorder.record(transaction, priceChangedEvent(dto, 'created'));
            return dto;
        };
        if (tx !== undefined) {
            return save(tx);
        }
        return deps.transactionManager.execute(save, { tenantId: input.tenantId });
    }

/**
     * Patches an existing price; records update events when amount or validity changes.
     * @param {object} input Tenant, priceId, optional patch fields.
     * @param {object|undefined} tx Optional transaction.
     */
    async function updatePrice(input, tx) {
/**
     * Inner transactional update/deactivate body (shared pattern for update and deactivate).
     * @param {object} transaction Active SQL transaction.
     */
        const mutate = async (transaction) => {
            const existing = await deps.prices.findById(transaction, input.tenantId, input.priceId);
            if (existing === null) {
                throw new NotFoundError('Price was not found', {
                    tenantId: input.tenantId,
                    priceId: input.priceId,
                });
            }
            if (input.channelId !== undefined && input.channelId !== null) {
                await deps.commerceIntegrationQueryService.verifyChannelBelongsToTenant(input.tenantId, input.channelId, transaction);
            }
            const now = new Date();
            const updated = updatePriceEntity(existing, {
                ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
                ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
                ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
                ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            }, now);
            await deps.prices.update(transaction, updated);
            const dto = toPriceDto(updated);
            const changes = {};
            if (input.amountMinor !== undefined && input.amountMinor !== existing.amountMinor) {
                changes['amountMinor'] = { from: existing.amountMinor, to: input.amountMinor };
            }
            if (input.validFrom !== undefined &&
                input.validFrom.getTime() !== existing.validFrom.getTime()) {
                changes['validFrom'] = {
                    from: existing.validFrom.toISOString(),
                    to: input.validFrom.toISOString(),
                };
            }
            if (input.validTo !== undefined) {
                const previous = existing.validTo?.toISOString() ?? null;
                const next = input.validTo?.toISOString() ?? null;
                if (previous !== next) {
                    changes['validTo'] = { from: previous, to: next };
                }
            }
            if (input.channelId !== undefined && input.channelId !== existing.channelId) {
                changes['channelId'] = { from: existing.channelId, to: input.channelId };
            }
            if (Object.keys(changes).length > 0) {
                await deps.eventRecorder.record(transaction, priceUpdatedEvent(dto, changes));
                await deps.eventRecorder.record(transaction, priceChangedEvent(dto, 'updated'));
            }
            return dto;
        };
        if (tx !== undefined) {
            return mutate(tx);
        }
        return deps.transactionManager.execute(mutate, { tenantId: input.tenantId });
    }

/**
     * Marks a price inactive and emits deactivated/changed events.
     * @param {object} input Tenant and priceId.
     * @param {object|undefined} tx Optional transaction.
     */
    async function deactivatePrice(input, tx) {
/**
     * Transaction step: load price, apply deactivation, emit status/changed events.
     * @param {object} transaction Active SQL transaction.
     */
        const mutate = async (transaction) => {
            const existing = await deps.prices.findById(transaction, input.tenantId, input.priceId);
            if (existing === null) {
                throw new NotFoundError('Price was not found', {
                    tenantId: input.tenantId,
                    priceId: input.priceId,
                });
            }
            const updated = deactivatePriceEntity(existing, new Date());
            await deps.prices.update(transaction, updated);
            const dto = toPriceDto(updated);
            await deps.eventRecorder.record(transaction, priceUpdatedEvent(dto, { status: { from: existing.status, to: updated.status } }));
            await deps.eventRecorder.record(transaction, priceChangedEvent(dto, 'deactivated'));
            return dto;
        };
        if (tx !== undefined) {
            return mutate(tx);
        }
        return deps.transactionManager.execute(mutate, { tenantId: input.tenantId });
    }

/**
     * Cursor-paginated price list filtered by product/channel/currency/status within the tenant.
     * @param {object} input Tenant, filters, optional cursor/limit.
     */
    async function listPrices(input, tx) {
        if (tx === undefined) {
            return deps.transactionManager.execute(
                (innerTx) => listPrices(input, innerTx),
                { tenantId: input.tenantId },
            );
        }
        const queryable = tx;
        const limit = clampCursorLimit(input.limit);
        const fetchLimit = limit + 1;
        let cursorCreatedAt = null;
        let cursorId = null;
        if (input.cursor !== undefined) {
            const parts = decodeCursor(input.cursor);
            if (parts.length !== 2) {
                throw new ValidationError('Invalid cursor');
            }
            cursorCreatedAt = new Date(parts[0] ?? '');
            cursorId = parts[1] ?? null;
        }
        const page = await deps.prices.listPage(queryable, input.tenantId, {
            ...(input.productId === undefined ? {} : { productId: input.productId }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            ...(input.currency === undefined ? {} : { currency: parseCurrency(input.currency) }),
            ...(input.status === undefined ? {} : { status: input.status }),
        }, fetchLimit, cursorCreatedAt, cursorId);
        const hasMore = page.items.length > limit;
        const items = hasMore ? page.items.slice(0, limit) : page.items;
        const last = items.at(-1);
        return {
            items: items.map(toPriceDto),
            hasMore,
            nextCursor: hasMore && last !== undefined
                ? encodeCursor([last.createdAt.toISOString(), last.id])
                : null,
        };
    }

    return {
        getEffectivePrice,
        createPrice,
        updatePrice,
        deactivatePrice,
        listPrices,
    };
}
