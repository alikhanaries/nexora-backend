import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

/** StockConnect Integration — metadata */
export @Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectMetaController {
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  @Get('/api/v2/stock-connect/ping')
  ping() {
    return this.stockConnectIntegrationService.ping();
  }
}
