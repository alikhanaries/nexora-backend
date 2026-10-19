/**
 * Compatibility mappers translate external API representations ↔ platform domain representations.
 *
 * Mappers live in this folder and must not be imported by core business modules.
 */

export { mapEmptyOrderPageToExternalCollection, mapExternalStatusesToPlatformStatuses, mapNewOrderStatusFilter, mapOrderPageToExternalCollection, UNMAPPED_EXTERNAL_ORDER_STATUSES, } from './compatibility-order.mapper.js';
