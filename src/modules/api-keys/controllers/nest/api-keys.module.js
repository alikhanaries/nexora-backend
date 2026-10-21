/**
 * Nest module for tenant API key management.
 * Registers ApiKeysController bound to CORE_SERVICES.apiKeys use cases.
 */
import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller.js';

@Module({
  controllers: [ApiKeysController],
  providers: [],
})
class ApiKeysModule {}
export { ApiKeysModule };
