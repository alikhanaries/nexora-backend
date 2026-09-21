import { BusinessRuleError } from '../../../shared/errors/index.js';
import { createMoney } from '../../../shared/money/index.js';
import { PriceStatus } from './price-status.js';
export class Price {
    id;
    tenantId;
    productId;
    channelId;
    currency;
    amountMinor;
    validFrom;
    validTo;
    status;
    createdAt;
    updatedAt;
    constructor(props) {
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
    static create(props) {
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
    static reconstitute(props) {
        return new Price(props);
    }
    isEffectiveAt(at) {
        if (this.status !== PriceStatus.ACTIVE)
            return false;
        if (this.validFrom > at)
            return false;
        if (this.validTo !== null && at >= this.validTo)
            return false;
        return true;
    }
    update(fields, at) {
        if (this.status === PriceStatus.INACTIVE) {
            throw new BusinessRuleError('Inactive prices cannot be updated');
        }
        const currency = this.currency;
        const amountMinor = fields.amountMinor === undefined
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
    deactivate(at) {
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
