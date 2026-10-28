/**
 * Nest adapter for StockConnect metadata endpoints.
 * Route `/api/v2/stock-connect/ping`; delegates to StockConnectIntegrationService (CORE_SERVICES-backed commands).
 */
import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

/** Stock Connect integration metadata (authenticated ping). */
@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectMetaController {
  /** @param {StockConnectIntegrationService} stockConnectIntegrationService */
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  /** Authenticated liveness probe for the Stock Connect integration API. */
  @Get('/api/v2/stock-connect/ping')
  ping() {
    return this.stockConnectIntegrationService.ping();
  }
}
export { StockConnectMetaController };
