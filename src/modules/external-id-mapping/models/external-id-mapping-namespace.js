import { ValidationError } from '../../../shared/errors/index.js';

/**
 * Provider namespaces for external integer ID mappings.
 * Values are provider-neutral — compatibility adapters map these to concrete contracts.
 */
export const ExternalIdMappingProvider = {
    /** Initial namespace for verified `/api/v2` Merchant + Channel contracts. */
    COMPAT_V2: 'compat_v2',
};

/** Resource types that may receive tenant-scoped external integer IDs. */
export const ExternalIdMappingResourceType = {
    ORDER: 'order',
    ORDER_LINE: 'order_line',
    RETURN: 'return',
    SHIPMENT: 'shipment',
    CANCELLATION: 'cancellation',
};

/** @type {readonly string[]} */
export const EXTERNAL_ID_MAPPING_PROVIDERS = Object.freeze(Object.values(ExternalIdMappingProvider));

/** @type {readonly string[]} */
export const EXTERNAL_ID_MAPPING_RESOURCE_TYPES = Object.freeze(Object.values(ExternalIdMappingResourceType));

/**
 * @param {string} provider
 */
export function assertExternalIdMappingProvider(provider) {
    if (!EXTERNAL_ID_MAPPING_PROVIDERS.includes(provider)) {
        throw new ValidationError(`Unknown external ID mapping provider: ${provider}`);
    }
}

/**
 * @param {string} resourceType
 */
export function assertExternalIdMappingResourceType(resourceType) {
    if (!EXTERNAL_ID_MAPPING_RESOURCE_TYPES.includes(resourceType)) {
        throw new ValidationError(`Unknown external ID mapping resource type: ${resourceType}`);
    }
}
