import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller.js';

export @Module({
  controllers: [TenantsController],
  providers: [],
})
class TenantsModule {}
