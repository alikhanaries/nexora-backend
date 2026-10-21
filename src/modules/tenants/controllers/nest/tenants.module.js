/**
 * Nest module for tenant provisioning and lifecycle admin APIs.
 * Registers TenantsController using CORE_SERVICES.tenants use cases.
 */
import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller.js';

@Module({
  controllers: [TenantsController],
  providers: [],
})
class TenantsModule {}
export { TenantsModule };
