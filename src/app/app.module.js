/**
 * Nest root module factory.
 *
 * Always registers config, database, health, and the global exception filter.
 * When `coreServices` is provided (full API boot), also registers every feature
 * Nest module and the global `AuthGuard`. When null (infra-only / tests), only
 * the minimal shell is built so health can still run.
 */
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from '../modules/api-keys/controllers/nest/api-keys.module.js';
import { AuditModule } from '../modules/audit/controllers/nest/audit.module.js';
import { AuthModule } from '../modules/identity/controllers/nest/auth.module.js';
import { AuthorizationModule } from '../modules/authorization/controllers/nest/authorization.module.js';
import { MfaModule } from '../modules/mfa/controllers/nest/mfa.module.js';
import { ProductsModule } from '../modules/products/controllers/nest/products.module.js';
import { PricingModule } from '../modules/pricing/controllers/nest/pricing.module.js';
import { OffersModule } from '../modules/offers/controllers/nest/offers.module.js';
import { InventoryModule } from '../modules/inventory/controllers/nest/inventory.module.js';
import { CommerceIntegrationsModule } from '../modules/commerce-integrations/controllers/nest/commerce-integrations.module.js';
import { MarketplacesModule } from '../modules/marketplaces/controllers/nest/marketplaces.module.js';
import { WebhooksModule } from '../modules/webhooks/outbound/controllers/nest/webhooks.module.js';
import { WebhookSubscriptionsModule } from '../modules/webhooks/outbound/controllers/nest/webhook-subscriptions.module.js';
import { OrdersModule } from '../modules/orders/controllers/nest/orders.module.js';
import { CancellationsModule } from '../modules/cancellations/public/nest-cancellations-module.js';
import { ShipmentsModule } from '../modules/shipments/public/nest-shipments-module.js';
import { ReturnsModule } from '../modules/returns/public/nest-returns-module.js';
import { CompatibilityOrdersModule } from '../modules/compatibility/controllers/nest/compatibility-orders.module.js';
import { CompatibilityHttpModule } from '../modules/compatibility/controllers/nest/compatibility-http.module.js';
import { StockConnectIntegrationModule } from '../modules/erp/stock-connect/controllers/nest/stock-connect-integration.module.js';
import { WaslConfigModule } from './config/wasl-config.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { CoreServicesModule } from './di/core-services.module.js';
import { HealthModule } from '../modules/health/controllers/nest/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { TenantsModule } from '../modules/tenants/controllers/nest/tenants.module.js';

/**
 * @param {{ logger: object, metrics: object, database: object | null }} infra
 * @param {object | null} [coreServices] Domain bag from `createApplication`; null = shell only
 */
export function buildAppModule(infra, coreServices = null) {
  const imports = [WaslConfigModule, DatabaseModule.register(infra), HealthModule];
  const providers = [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ];

  if (coreServices !== null) {
    imports.push(
      CoreServicesModule.register(coreServices),
      AuthModule,
      TenantsModule,
      AuthorizationModule,
      AuditModule,
      ApiKeysModule,
      MfaModule,
      ProductsModule,
      PricingModule,
      OffersModule,
      InventoryModule,
      CommerceIntegrationsModule,
      MarketplacesModule,
      WebhooksModule,
      WebhookSubscriptionsModule,
      OrdersModule,
      CancellationsModule,
      ShipmentsModule,
      ReturnsModule,
      CompatibilityOrdersModule,
      CompatibilityHttpModule,
      StockConnectIntegrationModule,
    );
    providers.push({
      provide: APP_GUARD,
      useClass: AuthGuard,
    });
  }

  @Module({
    imports,
    providers,
  })
  class AppModule {}

  return AppModule;
}
