import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/index.js';
import { createOfferEntity } from '../models/offer.js';
import { toOfferDto } from './offer-dto.js';
import { offerCreatedEvent } from './offer-events.js';
import { requireOffersCreate } from './offer-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateOffer(deps) {
    async function execute(input) {
        requireOffersCreate(deps.authorization, input.actorPermissions);
        const product = await deps.productQueryService.getProductById(input.tenantId, input.productId);
        if (product === null) {
            throw new NotFoundError('Product was not found', {
                tenantId: input.tenantId,
                productId: input.productId,
            });
        }
        await deps.commerceIntegrationQueryService.verifyChannelBelongsToTenant(input.tenantId, input.channelId);
        const externalReference = input.externalReference === undefined || input.externalReference === null
            ? null
            : input.externalReference.trim() || null;
        const now = new Date();
        const offer = createOfferEntity({
            id: randomUUID(),
            tenantId: input.tenantId,
            productId: input.productId,
            channelId: input.channelId,
            externalReference,
            ...(input.priceReference === undefined ? {} : { priceReference: input.priceReference }),
            createdAt: now,
        });
        const saved = await deps.database.execute(async (tx) => {
            const existing = await deps.offers.findByProductAndChannel(tx, input.tenantId, input.productId, input.channelId);
            if (existing !== null) {
                throw new ConflictError('An offer already exists for this product and channel', {
                    productId: input.productId,
                    channelId: input.channelId,
                });
            }
            await deps.offers.insert(tx, offer);
            const dto = toOfferDto(offer);
            await deps.eventRecorder.record(tx, offerCreatedEvent(dto));
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'OFFER_CREATED',
                resourceType: 'offer',
                resourceId: offer.id,
                metadata: {
                    productId: offer.productId,
                    channelId: offer.channelId,
                },
                ...auditRequestFields(),
            });
            return dto;
        }, { tenantId: input.tenantId });
        return { offer: saved };
    }
    return { execute };
}
