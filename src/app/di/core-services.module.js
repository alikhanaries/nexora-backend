/**
 * Registers the composition-root `coreServices` bag for Nest controllers and guards.
 */
import { CORE_SERVICES } from './core-services.tokens.js';

/** Dynamic module that exposes domain use cases created in {@link createApplication}. */
export class CoreServicesModule {
  /** Exposes the composition-root use-case bag as injectable `CORE_SERVICES`. */
  static register(coreServices) {
    return {
      module: CoreServicesModule,
      global: true,
      providers: [{ provide: CORE_SERVICES, useValue: coreServices }],
      exports: [CORE_SERVICES],
    };
  }
}
