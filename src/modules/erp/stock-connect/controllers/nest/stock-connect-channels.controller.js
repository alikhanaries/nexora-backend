import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

/** StockConnect Integration — marketplace channels */
@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectCommerceIntegrationsController {
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  @Get('/api/v2/stock-connect/channels')
  async list() {
    return this.stockConnectIntegrationService.listCommerceIntegrations();
  }
}
export { StockConnectCommerceIntegrationsController };
