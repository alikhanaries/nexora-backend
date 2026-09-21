import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ListingStatus } from './listing-status.js';
import { OfferStatus } from './offer-status.js';

export interface OfferProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId: string;
  readonly status: OfferStatus;
  readonly externalReference: string | null;
  readonly priceReference: string | null;
  readonly listingStatus: ListingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewOfferProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId: string;
  readonly externalReference?: string | null | undefined;
  readonly priceReference?: string | null | undefined;
  readonly createdAt: Date;
}

export interface OfferUpdateProps {
  readonly externalReference?: string | null | undefined;
  readonly priceReference?: string | null | undefined;
  readonly listingStatus?: ListingStatus | undefined;
}

export class Offer {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId: string;
  readonly status: OfferStatus;
  readonly externalReference: string | null;
  readonly priceReference: string | null;
  readonly listingStatus: ListingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: OfferProps) {
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

  static create(props: NewOfferProps): Offer {
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

  static reconstitute(props: OfferProps): Offer {
    return new Offer(props);
  }

  isUsable(): boolean {
    return this.status === OfferStatus.ACTIVE;
  }

  update(fields: OfferUpdateProps, at: Date): Offer {
    if (this.status === OfferStatus.INACTIVE) {
      throw new BusinessRuleError('Inactive offers cannot be updated');
    }

    return new Offer({
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      channelId: this.channelId,
      status: this.status,
      externalReference:
        fields.externalReference === undefined ? this.externalReference : fields.externalReference,
      priceReference:
        fields.priceReference === undefined ? this.priceReference : fields.priceReference,
      listingStatus: fields.listingStatus ?? this.listingStatus,
      createdAt: this.createdAt,
      updatedAt: at,
    });
  }

  activate(at: Date): Offer {
    if (this.status !== OfferStatus.DRAFT && this.status !== OfferStatus.SUSPENDED) {
      throw new BusinessRuleError('Only draft or suspended offers can be activated', {
        currentStatus: this.status,
      });
    }

    return this.withStatus(OfferStatus.ACTIVE, at);
  }

  suspend(at: Date): Offer {
    if (this.status !== OfferStatus.ACTIVE) {
      throw new BusinessRuleError('Only active offers can be suspended', {
        currentStatus: this.status,
      });
    }

    return this.withStatus(OfferStatus.SUSPENDED, at);
  }

  deactivate(at: Date): Offer {
    if (this.status === OfferStatus.INACTIVE) {
      throw new BusinessRuleError('Offer is already inactive');
    }

    return this.withStatus(OfferStatus.INACTIVE, at);
  }

  private withStatus(status: OfferStatus, updatedAt: Date): Offer {
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
