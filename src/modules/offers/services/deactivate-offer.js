import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { toOfferDto } from './offer-dto.js';
import { offerStatusChangedEvent } from './offer-events.js';
import { requireOffersUpdate } from './offer-permissions.js';
export class DeactivateOffer {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireOffersUpdate(this.deps.authorization, input.actorPermissions);
        const offer = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.offers.findById(tx, input.tenantId, input.offerId);
            if (existing === null) {
                throw new NotFoundError('Offer was not found', {
                    tenantId: input.tenantId,
                    offerId: input.offerId,
                });
            }
            const previousStatus = existing.status;
            const updated = existing.deactivate(new Date());
            await this.deps.offers.update(tx, updated);
            const dto = toOfferDto(updated);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, offerStatusChangedEvent(dto, previousStatus));
                await this.deps.auditRecorder?.record(tx, {
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
}
