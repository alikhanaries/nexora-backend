/**
 * Public query port for external integer ID mapping.
 *
 * @typedef {object} ExternalIntegerIdMappingQueryService
 * @property {(tenantId: string, provider: string, resourceType: string, externalId: number, tx?: object) => Promise<string|null>} findResourceIdByExternalId
 * @property {(tenantId: string, provider: string, resourceType: string, resourceId: string, tx?: object) => Promise<number|null>} findExternalIdByResourceId
 * @property {(tenantId: string, provider: string, resourceType: string, resourceIds: readonly string[], tx?: object) => Promise<Map<string, number>>} findExternalIdsByResourceIds
 */

export { DefaultExternalIntegerIdMappingQueryService } from '../application/external-integer-id-mapping-query-service.js';
