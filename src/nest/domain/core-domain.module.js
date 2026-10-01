import { CORE_DOMAIN } from './core-domain.tokens.js';

export class CoreDomainModule {
  static register(coreDomain) {
    return {
      module: CoreDomainModule,
      global: true,
      providers: [{ provide: CORE_DOMAIN, useValue: coreDomain }],
      exports: [CORE_DOMAIN],
    };
  }
}
