import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { suspendOfferEntity } from '../models/offer.js';
import { toOfferDto } from './offer-dto.js';
import { offerStatusChangedEvent } from './offer-events.js';
import { requireOffersUpdate } from './offer-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createSuspendOffer(deps) {
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
            const previousStatus = existing.status;
            const updated = suspendOfferEntity(existing, new Date());
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
