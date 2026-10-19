import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';

/**
 * Minimal StockConnect integration surface for Nest boot verification.
 * Product/order/inventory StockConnect features are out of scope here.
 */
export @Controller()
class StockConnectController {
  @Public()
  @Get('/api/v2/stock-connect/ping')
  ping() {
    return {
      success: true,
      integration: 'stock-connect',
      data: { message: 'pong' },
    };
  }
}
