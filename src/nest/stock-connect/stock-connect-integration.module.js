import { Module } from '@nestjs/common';
import { StockConnectController } from './stock-connect.controller.js';

export @Module({
  controllers: [StockConnectController],
})
class StockConnectIntegrationModule {}
