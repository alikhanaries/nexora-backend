/**
 * @typedef {object} ChannelQueryService
 * @property {(tenantId: string, channelId: string, tx?: object) => Promise<object>} getChannelById
 * Throws {@link NotFoundError} when missing.
 * @property {(tenantId: string, filters: object, tx?: object) => Promise<object[]>} listChannels
 * @property {(tenantId: string, channelId: string, tx?: object) => Promise<object>} verifyChannelBelongsToTenant
 * @property {(tenantId: string, channelId: string, tx?: object) => Promise<object>} verifyChannelUsable
 * Throws {@link BusinessRuleError} when channel is not active/usable.
 * @property {(tenantId: string, externalReference: string, tx?: object) => Promise<object>} getChannelByExternalReference
 * Throws {@link NotFoundError} when missing.
 */
export { DefaultChannelQueryService } from '../application/channel-query-service.js';
