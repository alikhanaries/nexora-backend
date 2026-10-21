/**
 * Nest adapter for StockConnect channel listing.
 * Route `/api/v2/stock-connect/channels`; handlers call StockConnectIntegrationService only.
 */
import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectCommerceIntegrationsController {
  /** @param {StockConnectIntegrationService} stockConnectIntegrationService */
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  /** Lists commerce integrations exposed as Stock Connect channels. */
  @Get('/api/v2/stock-connect/channels')
  async list() {
    return this.stockConnectIntegrationService.listCommerceIntegrations();
  }
}
export { StockConnectCommerceIntegrationsController };
