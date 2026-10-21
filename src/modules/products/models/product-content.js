import { ValidationError } from '../../../shared/errors/index.js';

const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

/**
 * @typedef {{
 *   id: string,
 *   productId: string,
 *   tenantId: string,
 *   locale: string,
 *   title: string | null,
 *   description: string | null,
 *   brand: string | null,
 *   attributes: Record<string, unknown>,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} ProductContent
 */

/**
 * @param {ProductContent} props
 * @returns {ProductContent}
 */
export function reconstituteProductContent(props) {
    return {
        id: props.id,
        productId: props.productId,
        tenantId: props.tenantId,
        locale: props.locale,
        title: props.title,
        description: props.description,
        brand: props.brand,
        attributes: props.attributes,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {{
 *   id: string,
 *   productId: string,
 *   tenantId: string,
 *   locale: string,
 *   title: string | null,
 *   description: string | null,
 *   brand: string | null,
 *   attributes: Record<string, unknown>,
 *   now: Date,
 *   existingCreatedAt?: Date,
 * }} props
 * @returns {ProductContent}
 */
export function upsertProductContentEntity(props) {
    validateLocale(props.locale);
    return {
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
    };
}

/** Validates BCP-47 locale strings for product content upserts. */
export function validateLocale(locale) {
    if (!LOCALE_PATTERN.test(locale)) {
        throw new ValidationError('Locale must match BCP-47 format (e.g. en or en-US)');
    }
}
