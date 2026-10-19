import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ListingStatus } from './listing-status.js';
import { OfferStatus } from './offer-status.js';
export class Offer {
    id;
    tenantId;
    productId;
    channelId;
    status;
    externalReference;
    priceReference;
    listingStatus;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.productId = props.productId;
        this.channelId = props.channelId;
        this.status = props.status;
        this.externalReference = props.externalReference;
        this.priceReference = props.priceReference;
        this.listingStatus = props.listingStatus;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new Offer({
            id: props.id,
            tenantId: props.tenantId,
            productId: props.productId,
            channelId: props.channelId,
            status: OfferStatus.DRAFT,
            externalReference: props.externalReference ?? null,
            priceReference: props.priceReference ?? null,
            listingStatus: ListingStatus.UNLISTED,
            createdAt: props.createdAt,
            updatedAt: props.createdAt,
        });
    }
    static reconstitute(props) {
        return new Offer(props);
    }
    isUsable() {
        return this.status === OfferStatus.ACTIVE;
    }
    update(fields, at) {
        if (this.status === OfferStatus.INACTIVE) {
            throw new BusinessRuleError('Inactive offers cannot be updated');
        }
        return new Offer({
            id: this.id,
            tenantId: this.tenantId,
            productId: this.productId,
            channelId: this.channelId,
            status: this.status,
            externalReference: fields.externalReference === undefined ? this.externalReference : fields.externalReference,
            priceReference: fields.priceReference === undefined ? this.priceReference : fields.priceReference,
            listingStatus: fields.listingStatus ?? this.listingStatus,
            createdAt: this.createdAt,
            updatedAt: at,
        });
    }
    activate(at) {
        if (this.status !== OfferStatus.DRAFT && this.status !== OfferStatus.SUSPENDED) {
            throw new BusinessRuleError('Only draft or suspended offers can be activated', {
                currentStatus: this.status,
            });
        }
        return this.withStatus(OfferStatus.ACTIVE, at);
    }
    suspend(at) {
        if (this.status !== OfferStatus.ACTIVE) {
            throw new BusinessRuleError('Only active offers can be suspended', {
                currentStatus: this.status,
            });
        }
        return this.withStatus(OfferStatus.SUSPENDED, at);
    }
    deactivate(at) {
        if (this.status === OfferStatus.INACTIVE) {
            throw new BusinessRuleError('Offer is already inactive');
        }
        return this.withStatus(OfferStatus.INACTIVE, at);
    }
    withStatus(status, updatedAt) {
        return new Offer({
            id: this.id,
            tenantId: this.tenantId,
            productId: this.productId,
            channelId: this.channelId,
            status,
            externalReference: this.externalReference,
            priceReference: this.priceReference,
            listingStatus: this.listingStatus,
            createdAt: this.createdAt,
            updatedAt,
        });
    }
}
