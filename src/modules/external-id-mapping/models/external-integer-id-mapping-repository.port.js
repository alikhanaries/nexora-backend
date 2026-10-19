/**
 * @typedef {object} ExternalIntegerIdMapping
 * @property {string} id
 * @property {string} tenantId
 * @property {string} provider
 * @property {string} resourceType
 * @property {string} resourceId
 * @property {number} externalId
 * @property {Date} createdAt
 */

/**
 * @typedef {object} AssignExternalIntegerIdMappingInput
 * @property {string} tenantId
 * @property {string} provider
 * @property {string} resourceType
 * @property {string} resourceId
 */

/**
 * Persistence port for compatibility external integer ID mappings.
 *
 * @typedef {object} ExternalIntegerIdMappingRepository
 * @property {(transaction: object, input: AssignExternalIntegerIdMappingInput) => Promise<ExternalIntegerIdMapping>} assignMapping
 * @property {(queryable: object, tenantId: string, provider: string, resourceType: string, externalId: number) => Promise<string|null>} findResourceIdByExternalId
 * @property {(queryable: object, tenantId: string, provider: string, resourceType: string, resourceId: string) => Promise<number|null>} findExternalIdByResourceId
 * @property {(queryable: object, tenantId: string, provider: string, resourceType: string, resourceIds: readonly string[]) => Promise<Map<string, number>>} findExternalIdsByResourceIds
 */

export {};
