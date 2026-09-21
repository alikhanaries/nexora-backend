import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ProductStatus } from './product-status.js';
import type { ProductType } from './product-type.js';

export interface ProductProps {
  readonly id: string;
  readonly tenantId: string;
  readonly merchantSku: string;
  readonly externalReference: string | null;
  readonly productType: ProductType;
  readonly status: ProductStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewProductProps {
  readonly id: string;
  readonly tenantId: string;
  readonly merchantSku: string;
  readonly externalReference: string | null;
  readonly productType: ProductType;
  readonly createdAt: Date;
}

export interface ProductUpdateProps {
  readonly externalReference?: string | null | undefined;
  readonly productType?: ProductType | undefined;
}

export class Product {
  readonly id: string;
  readonly tenantId: string;
  readonly merchantSku: string;
  readonly externalReference: string | null;
  readonly productType: ProductType;
  readonly status: ProductStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ProductProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.merchantSku = props.merchantSku;
    this.externalReference = props.externalReference;
    this.productType = props.productType;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: NewProductProps): Product {
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

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  update(fields: ProductUpdateProps, at: Date): Product {
    this.assertMutable();

    return new Product({
      id: this.id,
      tenantId: this.tenantId,
      merchantSku: this.merchantSku,
      externalReference:
        fields.externalReference === undefined ? this.externalReference : fields.externalReference,
      productType: fields.productType ?? this.productType,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: at,
    });
  }

  deactivate(at: Date): Product {
    if (this.status === ProductStatus.ARCHIVED) {
      throw new BusinessRuleError('Cannot deactivate an archived product');
    }
    if (this.status === ProductStatus.INACTIVE) {
      throw new BusinessRuleError('Product is already inactive');
    }
    return this.withStatus(ProductStatus.INACTIVE, at);
  }

  archive(at: Date): Product {
    if (this.status === ProductStatus.ARCHIVED) {
      throw new BusinessRuleError('Product is already archived');
    }
    return this.withStatus(ProductStatus.ARCHIVED, at);
  }

  private assertMutable(): void {
    if (this.status === ProductStatus.ARCHIVED) {
      throw new BusinessRuleError('Archived products cannot be modified');
    }
  }

  private withStatus(status: ProductStatus, updatedAt: Date): Product {
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
