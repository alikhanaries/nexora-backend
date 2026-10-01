import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

export @Module({
  controllers: [TenantsController],
  providers: [TenantsService],
})
class TenantsModule {}
