import { Module } from '@nestjs/common';
import { StockConnectController } from './stock-connect.controller.js';
import { StockConnectService } from './stock-connect.service.js';

export @Module({
  controllers: [StockConnectController],
  providers: [StockConnectService],
})
class StockConnectIntegrationModule {}
