import { Module } from '@nestjs/common';
import { CancellationsModule } from '../../modules/cancellations/public/nest-cancellations-module.js';
import { CommerceIntegrationsModule } from '../commerce-integrations/commerce-integrations.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OffersModule } from '../offers/offers.module.js';
import { OrdersModule } from '../../modules/orders/controllers/nest/orders.module.js';
import { ProductsModule } from '../products/products.module.js';
import { ShipmentsModule } from '../../modules/shipments/public/nest-shipments-module.js';
import { StockConnectCommerceIntegrationsController } from './stock-connect-channels.controller.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';
import { StockConnectInventoryController } from './stock-connect-inventory.controller.js';
import { StockConnectMetaController } from './stock-connect-meta.controller.js';
import { StockConnectOrdersController } from './stock-connect-orders.controller.js';
import { StockConnectProductsController } from './stock-connect-products.controller.js';
import { StockConnectShipmentsController } from './stock-connect-shipments.controller.js';

export @Module({
  imports: [
    ProductsModule,
    OrdersModule,
    InventoryModule,
    ShipmentsModule,
    CommerceIntegrationsModule,
    OffersModule,
    CancellationsModule,
  ],
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
