import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from './api-keys/api-keys.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { MfaModule } from './mfa/mfa.module.js';
import { ProductsModule } from './products/products.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { OffersModule } from './offers/offers.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { MarketplacesModule } from './marketplaces/marketplaces.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { WebhookSubscriptionsModule } from './webhook-subscriptions/webhook-subscriptions.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { CancellationsModule } from './cancellations/cancellations.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { LegacyOrdersModule } from './legacy-orders/legacy-orders.module.js';
import { LegacyCompatibilityModule } from './legacy-compatibility/legacy-compatibility.module.js';
import { NexoraConfigModule } from './config/config.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { CoreDomainModule } from './domain/core-domain.module.js';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { StockConnectIntegrationModule } from './stock-connect/stock-connect-integration.module.js';

/**
 * @param {{ logger: object, metrics: object, database: object | null }} infra
 * @param {object | null} [coreDomain]
 */
export function buildAppModule(infra, coreDomain = null) {
  const imports = [
    NexoraConfigModule,
    DatabaseModule.register(infra),
    HealthModule,
    StockConnectIntegrationModule,
  ];
  const providers = [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ];

  if (coreDomain !== null) {
    imports.push(
      CoreDomainModule.register(coreDomain),
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
      ChannelsModule,
      MarketplacesModule,
      WebhooksModule,
      WebhookSubscriptionsModule,
      OrdersModule,
      CancellationsModule,
      ShipmentsModule,
      ReturnsModule,
      LegacyOrdersModule,
      LegacyCompatibilityModule,
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
