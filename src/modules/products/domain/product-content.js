import { ValidationError } from '../../../shared/errors/index.js';
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
export class ProductContent {
    id;
    productId;
    tenantId;
    locale;
    title;
    description;
    brand;
    attributes;
    createdAt;
    updatedAt;
    constructor(props) {
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
    static reconstitute(props) {
        return new ProductContent(props);
    }
    static upsert(props) {
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
export function validateLocale(locale) {
    if (!LOCALE_PATTERN.test(locale)) {
        throw new ValidationError('Locale must match BCP-47 format (e.g. en or en-US)');
    }
}
