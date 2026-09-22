/**
 * Compatibility mappers translate external API representations ↔ Nexora representations.
 *
 * Mappers live in this folder and must not be imported by core business modules.
 */

export { mapEmptyOrderPageToExternalCollection, mapExternalStatusesToNexoraStatuses, mapNewOrderStatusFilter, mapOrderPageToExternalCollection, UNMAPPED_EXTERNAL_ORDER_STATUSES, } from './compatibility-order.mapper.js';
