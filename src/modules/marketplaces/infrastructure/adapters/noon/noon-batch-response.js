import {
    MarketplaceNotFoundError,
    MarketplaceTransientError,
    MarketplaceValidationError,
} from '../../../domain/marketplace-errors.js';

/**
 * Validates per-item statuses on Noon batch APIs (stock, pricing).
 *
 * @param {unknown} json
 * @param {string} operationLabel
 */
export function assertNoonBatchItemsSucceeded(json, operationLabel) {
    const items = json?.items;
    if (!Array.isArray(items) || items.length === 0) {
        throw new MarketplaceTransientError(`Noon ${operationLabel} response did not include item results`);
    }
    for (const item of items) {
        const status = item?.status;
        const statusCode = typeof status?.status_code === 'string'
            ? status.status_code
            : typeof status?.statusCode === 'string'
                ? status.statusCode
                : null;
        const statusId = status?.status_id ?? status?.statusId;
        if (statusCode === 'OK' || statusId === 0) {
            continue;
        }
        const message = sanitizeNoonStatusMessage(status?.message, operationLabel);
        if (statusCode === 'NOT_FOUND' || /not found/i.test(message)) {
            throw new MarketplaceNotFoundError(message);
        }
        throw new MarketplaceValidationError(message);
    }
}

/**
 * @param {unknown} message
 * @param {string} operationLabel
 */
function sanitizeNoonStatusMessage(message, operationLabel) {
    if (typeof message === 'string' && message.trim().length > 0) {
        return message.trim();
    }
    return `Noon ${operationLabel} rejected one or more items`;
}
