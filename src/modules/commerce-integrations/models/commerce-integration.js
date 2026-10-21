import { BusinessRuleError } from '../../../shared/errors/index.js';
import { IntegrationStatus } from './integration-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   marketplaceId: string,
 *   name: string,
 *   externalReference: string | null,
 *   status: string,
 *   configurationReference: string | null,
 *   defaultStockLocationId: string | null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} CommerceIntegration
 */

/**
 * @param {{
 *   id: string,
 *   tenantId: string,
 *   marketplaceId: string,
 *   name: string,
 *   externalReference?: string | null,
 *   configurationReference?: string | null,
 *   defaultStockLocationId?: string | null,
 *   createdAt: Date,
 * }} props
 * @returns {CommerceIntegration}
 */
export function createCommerceIntegrationEntity(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        marketplaceId: props.marketplaceId,
        name: props.name,
        externalReference: props.externalReference ?? null,
        status: IntegrationStatus.ACTIVE,
        configurationReference: props.configurationReference ?? null,
        defaultStockLocationId: props.defaultStockLocationId ?? null,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
    };
}

/**
 * @param {CommerceIntegration} props
 * @returns {CommerceIntegration}
 */
export function reconstituteCommerceIntegration(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        marketplaceId: props.marketplaceId,
        name: props.name,
        externalReference: props.externalReference,
        status: props.status,
        configurationReference: props.configurationReference,
        defaultStockLocationId: props.defaultStockLocationId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {CommerceIntegration} channel
 */
export function isCommerceIntegrationUsable(channel) {
    return channel.status === IntegrationStatus.ACTIVE;
}

/**
 * @param {CommerceIntegration} channel
 * @param {object} input
 * @param {Date} at
 * @returns {CommerceIntegration}
 */
export function updateCommerceIntegrationDetails(channel, input, at) {
    return {
        id: channel.id,
        tenantId: channel.tenantId,
        marketplaceId: channel.marketplaceId,
        name: input.name ?? channel.name,
        externalReference: input.externalReference === undefined ? channel.externalReference : input.externalReference,
        status: channel.status,
        configurationReference: input.configurationReference === undefined
            ? channel.configurationReference
            : input.configurationReference,
        defaultStockLocationId: input.defaultStockLocationId === undefined
            ? channel.defaultStockLocationId
            : input.defaultStockLocationId,
        createdAt: channel.createdAt,
        updatedAt: at,
    };
}

/**
 * @param {CommerceIntegration} channel
 * @param {string} status
 * @param {Date} updatedAt
 * @returns {CommerceIntegration}
 */
function withCommerceIntegrationStatus(channel, status, updatedAt) {
    return {
        id: channel.id,
        tenantId: channel.tenantId,
        marketplaceId: channel.marketplaceId,
        name: channel.name,
        externalReference: channel.externalReference,
        status,
        configurationReference: channel.configurationReference,
        defaultStockLocationId: channel.defaultStockLocationId,
        createdAt: channel.createdAt,
        updatedAt,
    };
}

/**
 * @param {CommerceIntegration} channel
 * @param {Date} at
 * @returns {CommerceIntegration}
 */
export function activateCommerceIntegration(channel, at) {
    if (channel.status === IntegrationStatus.ACTIVE) {
        throw new BusinessRuleError('Channel is already active');
    }
    return withCommerceIntegrationStatus(channel, IntegrationStatus.ACTIVE, at);
}

/**
 * @param {CommerceIntegration} channel
 * @param {Date} at
 * @returns {CommerceIntegration}
 */
export function deactivateCommerceIntegration(channel, at) {
    if (channel.status === IntegrationStatus.INACTIVE) {
        throw new BusinessRuleError('Channel is already inactive');
    }
    return withCommerceIntegrationStatus(channel, IntegrationStatus.INACTIVE, at);
}

/**
 * @param {CommerceIntegration} channel
 * @param {Date} at
 * @returns {CommerceIntegration}
 */
export function suspendCommerceIntegration(channel, at) {
    if (channel.status === IntegrationStatus.SUSPENDED) {
        throw new BusinessRuleError('Channel is already suspended');
    }
    return withCommerceIntegrationStatus(channel, IntegrationStatus.SUSPENDED, at);
}
