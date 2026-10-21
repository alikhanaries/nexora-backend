/**
 * Nest adapter for StockConnect metadata endpoints.
 * Route `/api/v2/stock-connect/ping`; delegates to StockConnectIntegrationService (CORE_SERVICES-backed commands).
 */
import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { Public } from '../../../../../app/common/decorators/public.decorator.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

/** Public ping for StockConnect integration health. */
@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectMetaController {
  /** @param {StockConnectIntegrationService} stockConnectIntegrationService */
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  /** Public liveness probe for the Stock Connect integration API. */
  @Public()
  @Get('/api/v2/stock-connect/ping')
  ping() {
    return this.stockConnectIntegrationService.ping();
  }
}
export { StockConnectMetaController };
