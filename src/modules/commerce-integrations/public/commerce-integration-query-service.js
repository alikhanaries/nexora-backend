/**
 * @typedef {object} CommerceIntegrationQueryService
 * @property {(tenantId: string, channelId: string, tx?: object) => Promise<object>} getCommerceIntegrationById
 * Throws {@link NotFoundError} when missing.
 * @property {(tenantId: string, filters: object, tx?: object) => Promise<object[]>} listCommerceIntegrations
 * @property {(tenantId: string, channelId: string, tx?: object) => Promise<object>} verifyChannelBelongsToTenant
 * @property {(tenantId: string, channelId: string, tx?: object) => Promise<object>} verifyChannelUsable
 * Throws {@link BusinessRuleError} when channel is not active/usable.
 * @property {(tenantId: string, externalReference: string, tx?: object) => Promise<object>} getCommerceIntegrationByExternalReference
 * Throws {@link NotFoundError} when missing.
 */
export { CommerceIntegrationQueryService } from '../application/commerce-integration-query-service.js';
