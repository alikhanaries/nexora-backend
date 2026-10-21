import { BusinessRuleError } from '../../../shared/errors/index.js';
import { StockLocationStatus as Status } from './stock-location-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   name: string,
 *   externalReference: string | null,
 *   status: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} StockLocation
 */

/**
 * @param {object} props
 * @returns {StockLocation}
 */
export function createStockLocationEntity(props) {
    const name = props.name.trim();
    if (name.length === 0) {
        throw new BusinessRuleError('Stock location name is required');
    }
    return {
        id: props.id,
        tenantId: props.tenantId,
        name,
        externalReference: props.externalReference?.trim() ?? null,
        status: Status.ACTIVE,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
    };
}

/**
 * @param {StockLocation} props
 * @returns {StockLocation}
 */
export function reconstituteStockLocation(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        name: props.name,
        externalReference: props.externalReference,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {StockLocation} location
 */
export function assertStockLocationUsable(location) {
    if (location.status !== Status.ACTIVE) {
        throw new BusinessRuleError('Stock location is not active', {
            stockLocationId: location.id,
            status: location.status,
        });
    }
}
