import { Module } from '@nestjs/common';
import { StockConnectCommerceIntegrationsController } from './stock-connect-channels.controller.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';
import { StockConnectInventoryController } from './stock-connect-inventory.controller.js';
import { StockConnectMetaController } from './stock-connect-meta.controller.js';
import { StockConnectOrdersController } from './stock-connect-orders.controller.js';
import { StockConnectProductsController } from './stock-connect-products.controller.js';
import { StockConnectShipmentsController } from './stock-connect-shipments.controller.js';

/** Live StockConnect HTTP surface — split controllers; ping owned by MetaController. */
@Module({
  controllers: [
    StockConnectMetaController,
    StockConnectProductsController,
    StockConnectOrdersController,
    StockConnectInventoryController,
    StockConnectShipmentsController,
    StockConnectCommerceIntegrationsController,
  ],
  providers: [StockConnectIntegrationService, StockConnectIntegrationGuard],
})
class StockConnectIntegrationModule {}
export { StockConnectIntegrationModule };
