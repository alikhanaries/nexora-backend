import { ValidationError } from '../../../shared/errors/index.js';

const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

export interface ProductContentProps {
  readonly id: string;
  readonly productId: string;
  readonly tenantId: string;
  readonly locale: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly brand: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertProductContentProps {
  readonly id: string;
  readonly productId: string;
  readonly tenantId: string;
  readonly locale: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly brand: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly now: Date;
  readonly existingCreatedAt?: Date | undefined;
}

export class ProductContent {
  readonly id: string;
  readonly productId: string;
  readonly tenantId: string;
  readonly locale: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly brand: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ProductContentProps) {
    this.id = props.id;
    this.productId = props.productId;
    this.tenantId = props.tenantId;
    this.locale = props.locale;
    this.title = props.title;
    this.description = props.description;
    this.brand = props.brand;
    this.attributes = props.attributes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static reconstitute(props: ProductContentProps): ProductContent {
    return new ProductContent(props);
  }

  static upsert(props: UpsertProductContentProps): ProductContent {
    validateLocale(props.locale);

    return new ProductContent({
      id: props.id,
      productId: props.productId,
      tenantId: props.tenantId,
      locale: props.locale,
      title: props.title,
      description: props.description,
      brand: props.brand,
      attributes: props.attributes,
      createdAt: props.existingCreatedAt ?? props.now,
      updatedAt: props.now,
    });
  }
}

export function validateLocale(locale: string): void {
  if (!LOCALE_PATTERN.test(locale)) {
    throw new ValidationError('Locale must match BCP-47 format (e.g. en or en-US)');
  }
}
