import { CORE_SERVICES } from './core-services.tokens.js';

export class CoreServicesModule {
  static register(coreServices) {
    return {
      module: CoreServicesModule,
      global: true,
      providers: [{ provide: CORE_SERVICES, useValue: coreServices }],
      exports: [CORE_SERVICES],
    };
  }
}
