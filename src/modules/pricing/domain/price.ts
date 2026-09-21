import { BusinessRuleError } from '../../../shared/errors/index.js';
import { createMoney } from '../../../shared/money/index.js';
import { PriceStatus } from './price-status.js';

export interface PriceProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId: string | null;
  readonly currency: string;
  readonly amountMinor: number;
  readonly validFrom: Date;
  readonly validTo: Date | null;
  readonly status: PriceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewPriceProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId?: string | null | undefined;
  readonly currency: string;
  readonly amountMinor: number;
  readonly validFrom: Date;
  readonly validTo?: Date | null | undefined;
  readonly createdAt: Date;
}

export interface PriceUpdateProps {
  readonly amountMinor?: number | undefined;
  readonly validFrom?: Date | undefined;
  readonly validTo?: Date | null | undefined;
  readonly channelId?: string | null | undefined;
}

export class Price {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId: string | null;
  readonly currency: string;
  readonly amountMinor: number;
  readonly validFrom: Date;
  readonly validTo: Date | null;
  readonly status: PriceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: PriceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.channelId = props.channelId;
    this.currency = props.currency;
    this.amountMinor = props.amountMinor;
    this.validFrom = props.validFrom;
    this.validTo = props.validTo;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: NewPriceProps): Price {
    const money = createMoney(props.currency, props.amountMinor);
    const validTo = props.validTo ?? null;
    if (validTo !== null && validTo <= props.validFrom) {
      throw new BusinessRuleError('validTo must be after validFrom');
    }

    return new Price({
      id: props.id,
      tenantId: props.tenantId,
      productId: props.productId,
      channelId: props.channelId ?? null,
      currency: money.currency,
      amountMinor: money.amountMinor,
      validFrom: props.validFrom,
      validTo,
      status: PriceStatus.ACTIVE,
      createdAt: props.createdAt,
      updatedAt: props.createdAt,
    });
  }

  static reconstitute(props: PriceProps): Price {
    return new Price(props);
  }

  isEffectiveAt(at: Date): boolean {
    if (this.status !== PriceStatus.ACTIVE) return false;
    if (this.validFrom > at) return false;
    if (this.validTo !== null && at >= this.validTo) return false;
    return true;
  }

  update(fields: PriceUpdateProps, at: Date): Price {
    if (this.status === PriceStatus.INACTIVE) {
      throw new BusinessRuleError('Inactive prices cannot be updated');
    }

    const currency = this.currency;
    const amountMinor =
      fields.amountMinor === undefined
        ? this.amountMinor
        : createMoney(currency, fields.amountMinor).amountMinor;
    const validFrom = fields.validFrom ?? this.validFrom;
    const validTo = fields.validTo === undefined ? this.validTo : fields.validTo;
    const channelId = fields.channelId === undefined ? this.channelId : fields.channelId;

    if (validTo !== null && validTo <= validFrom) {
      throw new BusinessRuleError('validTo must be after validFrom');
    }

    return new Price({
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      channelId: channelId ?? null,
      currency,
      amountMinor,
      validFrom,
      validTo,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: at,
    });
  }

  deactivate(at: Date): Price {
    if (this.status === PriceStatus.INACTIVE) {
      throw new BusinessRuleError('Price is already inactive');
    }

    return new Price({
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      channelId: this.channelId,
      currency: this.currency,
      amountMinor: this.amountMinor,
      validFrom: this.validFrom,
      validTo: this.validTo,
      status: PriceStatus.INACTIVE,
      createdAt: this.createdAt,
      updatedAt: at,
    });
  }
}
