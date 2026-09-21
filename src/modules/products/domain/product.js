import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ProductStatus } from './product-status.js';
export class Product {
    id;
    tenantId;
    merchantSku;
    externalReference;
    productType;
    status;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.merchantSku = props.merchantSku;
        this.externalReference = props.externalReference;
        this.productType = props.productType;
        this.status = props.status;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new Product({
            id: props.id,
            tenantId: props.tenantId,
            merchantSku: props.merchantSku,
            externalReference: props.externalReference,
            productType: props.productType,
            status: ProductStatus.ACTIVE,
            createdAt: props.createdAt,
            updatedAt: props.createdAt,
        });
    }
    static reconstitute(props) {
        return new Product(props);
    }
    update(fields, at) {
        this.assertMutable();
        return new Product({
            id: this.id,
            tenantId: this.tenantId,
            merchantSku: this.merchantSku,
            externalReference: fields.externalReference === undefined ? this.externalReference : fields.externalReference,
            productType: fields.productType ?? this.productType,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: at,
        });
    }
    deactivate(at) {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new BusinessRuleError('Cannot deactivate an archived product');
        }
        if (this.status === ProductStatus.INACTIVE) {
            throw new BusinessRuleError('Product is already inactive');
        }
        return this.withStatus(ProductStatus.INACTIVE, at);
    }
    archive(at) {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new BusinessRuleError('Product is already archived');
        }
        return this.withStatus(ProductStatus.ARCHIVED, at);
    }
    assertMutable() {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new BusinessRuleError('Archived products cannot be modified');
        }
    }
    withStatus(status, updatedAt) {
        return new Product({
            id: this.id,
            tenantId: this.tenantId,
            merchantSku: this.merchantSku,
            externalReference: this.externalReference,
            productType: this.productType,
            status,
            createdAt: this.createdAt,
            updatedAt,
        });
    }
}
