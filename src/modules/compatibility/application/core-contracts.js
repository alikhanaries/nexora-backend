/**
 * Core public contracts injected into the compatibility module at the composition root.
 *
 * Compatibility integrates with Nexora only through these ports — never via repositories,
 * use cases, domain types, or SQL.
 *
 * @typedef {object} CompatibilityCoreContracts
 * @property {import('../../products/public/product-query-service.js').DefaultProductQueryService} productQueryService
 * @property {import('../../channels/public/channel-query-service.js').DefaultChannelQueryService} channelQueryService
 * @property {import('../../inventory/public/inventory-service.js').DefaultInventoryService} inventoryService
 * @property {import('../../pricing/public/pricing-service.js').DefaultPricingService} pricingService
 * @property {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} offerQueryService
 * @property {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} orderQueryService
 * @property {import('../../orders/public/order-fulfillment-service.js').DefaultOrderFulfillmentService} orderFulfillmentService
 * @property {import('../../shipments/public/shipment-query-service.js').DefaultShipmentQueryService} shipmentQueryService
 * @property {import('../../shipments/public/shipment-command-service.js').DefaultShipmentCommandService} shipmentCommandService
 * @property {import('../../cancellations/public/cancellation-query-service.js').DefaultCancellationQueryService} cancellationQueryService
 * @property {import('../../cancellations/public/cancellation-command-service.js').DefaultCancellationCommandService} cancellationCommandService
 * @property {import('../../returns/public/return-query-service.js').DefaultReturnQueryService} returnQueryService
 * @property {import('../../returns/public/return-command-service.js').DefaultReturnCommandService} returnCommandService
 * @property {import('../../orders/public/order-command-service.js').DefaultOrderCommandService} orderCommandService
 *   Command port for order mutations (Merchant acknowledge; Channel ingestion in separate future scope).
 * @property {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} externalIntegerIdMappingQueryService
 */

export {};
