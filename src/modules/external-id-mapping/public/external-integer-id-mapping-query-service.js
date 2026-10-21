/**
 * @typedef {object} ExternalIntegerIdMappingQueryService
 * @property {(tenantId: string, provider: string, resourceType: string, externalId: number, tx?: object) => Promise<string|null>} findResourceIdByExternalId
 * @property {(tenantId: string, provider: string, resourceType: string, resourceId: string, tx?: object) => Promise<number|null>} findExternalIdByResourceId
 * @property {(tenantId: string, provider: string, resourceType: string, resourceIds: readonly string[], tx?: object) => Promise<Map<string, number>>} findExternalIdsByResourceIds
 */
export { createDefaultExternalIntegerIdMappingQueryService } from '../services/external-integer-id-mapping-query-service.js';
