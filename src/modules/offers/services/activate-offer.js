import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { activateOfferEntity } from '../models/offer.js';
import { toOfferDto } from './offer-dto.js';
import { offerStatusChangedEvent } from './offer-events.js';
import { requireOffersUpdate } from './offer-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createActivateOffer(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        requireOffersUpdate(deps.authorization, input.actorPermissions);
        const offer = await deps.database.execute(async (tx) => {
            const existing = await deps.offers.findById(tx, input.tenantId, input.offerId);
            if (existing === null) {
                throw new NotFoundError('Offer was not found', {
                    tenantId: input.tenantId,
                    offerId: input.offerId,
                });
            }
            const product = await deps.productQueryService.getProductById(input.tenantId, existing.productId, tx);
            if (product === null) {
                throw new NotFoundError('Product was not found', {
                    tenantId: input.tenantId,
                    productId: existing.productId,
                });
            }
            if (product.status !== 'ACTIVE') {
                throw new BusinessRuleError('Product must be active to activate an offer', {
                    productId: product.id,
                    status: product.status,
                });
            }
            await deps.commerceIntegrationQueryService.verifyChannelUsable(input.tenantId, existing.channelId, tx);
            if (input.resolvePricing === true) {
                if (input.currency === undefined) {
                    throw new BusinessRuleError('currency is required when resolvePricing is true');
                }
                const effective = await deps.pricingService.getEffectivePrice(input.tenantId, existing.productId, existing.channelId, input.currency, new Date(), tx);
                if (effective === null) {
                    throw new BusinessRuleError('No effective price found for this offer', {
                        productId: existing.productId,
                        channelId: existing.channelId,
                        currency: input.currency,
                    });
                }
            }
            const previousStatus = existing.status;
            const updated = activateOfferEntity(existing, new Date());
            await deps.offers.update(tx, updated);
            const dto = toOfferDto(updated);
            if (previousStatus !== updated.status) {
                await deps.eventRecorder.record(tx, offerStatusChangedEvent(dto, previousStatus));
                await deps.auditRecorder?.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'OFFER_STATUS_CHANGED',
                    resourceType: 'offer',
                    resourceId: updated.id,
                    metadata: {
                        previousStatus,
                        newStatus: updated.status,
                        productId: updated.productId,
                        channelId: updated.channelId,
                    },
                    ...auditRequestFields(),
                });
            }
            return dto;
        }, { tenantId: input.tenantId });
        return { offer };
    }
    return { execute };
}
