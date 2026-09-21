import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../../shared/errors/index.js';
import { parseCurrency } from '../../../shared/money/index.js';
import { clampCursorLimit, decodeCursor, encodeCursor, } from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { Price } from '../domain/price.js';
import { toPriceDto } from './price-dto.js';
import { priceChangedEvent, priceCreatedEvent, priceUpdatedEvent } from './price-events.js';
export class DefaultPricingService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getEffectivePrice(tenantId, productId, channelId, currency, at = new Date(), tx) {
        const queryable = tx ?? this.deps.queryable;
        const normalizedCurrency = parseCurrency(currency);
        const price = await this.deps.prices.findEffective(queryable, tenantId, productId, channelId, normalizedCurrency, at);
        return price === null ? null : toPriceDto(price);
    }
    async createPrice(input, tx) {
        const belongs = await this.deps.productQueryService.verifyProductBelongsToTenant(input.tenantId, input.productId, tx);
        if (!belongs) {
            throw new NotFoundError('Product was not found', {
                tenantId: input.tenantId,
                productId: input.productId,
            });
        }
        if (input.channelId !== undefined && input.channelId !== null) {
            await this.deps.channelQueryService.verifyChannelBelongsToTenant(input.tenantId, input.channelId, tx);
        }
        const now = new Date();
        const price = Price.create({
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
        const save = async (transaction) => {
            await this.deps.prices.insert(transaction, price);
            const dto = toPriceDto(price);
            await this.deps.eventRecorder.record(transaction, priceCreatedEvent(dto));
            await this.deps.eventRecorder.record(transaction, priceChangedEvent(dto, 'created'));
            return dto;
        };
        if (tx !== undefined) {
            return save(tx);
        }
        return this.deps.transactionManager.execute(save, { tenantId: input.tenantId });
    }
    async updatePrice(input, tx) {
        const mutate = async (transaction) => {
            const existing = await this.deps.prices.findById(transaction, input.tenantId, input.priceId);
            if (existing === null) {
                throw new NotFoundError('Price was not found', {
                    tenantId: input.tenantId,
                    priceId: input.priceId,
                });
            }
            if (input.channelId !== undefined && input.channelId !== null) {
                await this.deps.channelQueryService.verifyChannelBelongsToTenant(input.tenantId, input.channelId, transaction);
            }
            const now = new Date();
            const updated = existing.update({
                ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
                ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
                ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
                ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            }, now);
            await this.deps.prices.update(transaction, updated);
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
                await this.deps.eventRecorder.record(transaction, priceUpdatedEvent(dto, changes));
                await this.deps.eventRecorder.record(transaction, priceChangedEvent(dto, 'updated'));
            }
            return dto;
        };
        if (tx !== undefined) {
            return mutate(tx);
        }
        return this.deps.transactionManager.execute(mutate, { tenantId: input.tenantId });
    }
    async deactivatePrice(input, tx) {
        const mutate = async (transaction) => {
            const existing = await this.deps.prices.findById(transaction, input.tenantId, input.priceId);
            if (existing === null) {
                throw new NotFoundError('Price was not found', {
                    tenantId: input.tenantId,
                    priceId: input.priceId,
                });
            }
            const updated = existing.deactivate(new Date());
            await this.deps.prices.update(transaction, updated);
            const dto = toPriceDto(updated);
            await this.deps.eventRecorder.record(transaction, priceUpdatedEvent(dto, { status: { from: existing.status, to: updated.status } }));
            await this.deps.eventRecorder.record(transaction, priceChangedEvent(dto, 'deactivated'));
            return dto;
        };
        if (tx !== undefined) {
            return mutate(tx);
        }
        return this.deps.transactionManager.execute(mutate, { tenantId: input.tenantId });
    }
    async listPrices(input, tx) {
        const queryable = tx ?? this.deps.queryable;
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
        const page = await this.deps.prices.listPage(queryable, input.tenantId, {
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
}
