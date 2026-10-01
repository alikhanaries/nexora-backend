import { DefaultAuthorizationService } from '../../modules/authorization/public/index.js';
import { createCompatibilityModule } from '../../modules/compatibility/index.js';

/**
 * Same compatibility module wiring as {@link createApplication} (order + CE surfaces use routeDeps).
 */
export function wireCompatibility(deps) {
  const authorization = new DefaultAuthorizationService();
  return createCompatibilityModule({
    rateLimiter: deps.rateLimiter,
    authorization,
    idempotency: deps.idempotency,
    coreContracts: {
      productQueryService: deps.products.productQueryService,
      channelQueryService: deps.channels.channelQueryService,
      inventoryService: deps.inventory.inventoryService,
      pricingService: deps.pricing.pricingService,
      offerQueryService: deps.offers.offerQueryService,
      orderQueryService: deps.orders.orderQueryService,
      orderFulfillmentService: deps.orders.orderFulfillmentService,
      shipmentQueryService: deps.shipments.shipmentQueryService,
      shipmentCommandService: deps.shipments.shipmentCommandService,
      cancellationQueryService: deps.cancellations.cancellationQueryService,
      cancellationCommandService: deps.cancellations.cancellationCommandService,
      returnQueryService: deps.returns.returnQueryService,
      returnCommandService: deps.returns.returnCommandService,
      orderCommandService: deps.orders.orderCommandService,
      externalIntegerIdMappingQueryService:
        deps.externalIdMapping.externalIntegerIdMappingQueryService,
      createProduct: deps.products.useCases.createProduct,
      archiveProduct: deps.products.useCases.archiveProduct,
      deactivateProduct: deps.products.useCases.deactivateProduct,
      upsertProductContent: deps.products.useCases.upsertProductContent,
      getProductContent: deps.products.useCases.getProductContent,
      suspendOffer: deps.offers.useCases.suspendOffer,
      activateOffer: deps.offers.useCases.activateOffer,
      shipShipment: deps.shipments.useCases.shipShipment,
      deliverShipment: deps.shipments.useCases.deliverShipment,
    },
    catalogCommands: {
      createProduct: deps.products.useCases.createProduct,
      deactivateProduct: deps.products.useCases.deactivateProduct,
      upsertProductContent: deps.products.useCases.upsertProductContent,
      getProductContent: deps.products.useCases.getProductContent,
      createPrice: deps.pricing.useCases.createPrice,
      updatePrice: deps.pricing.useCases.updatePrice,
      createOffer: deps.offers.useCases.createOffer,
      activateOffer: deps.offers.useCases.activateOffer,
      suspendOffer: deps.offers.useCases.suspendOffer,
      adjustInventory: deps.inventory.useCases.adjustInventory,
    },
  });
}
