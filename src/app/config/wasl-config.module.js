/**
 * Nest global module that exposes validated config as `WASL_CONFIG` for injection.
 */
import { Global, Module } from '@nestjs/common';
import { loadConfigFromEnvironment } from './index.js';

/** Injection token for the loaded {@link loadConfigFromEnvironment} result. */
export const WASL_CONFIG = Symbol('WASL_CONFIG');

@Global()
@Module({
  providers: [
    {
      provide: WASL_CONFIG,
      useFactory: () => loadConfigFromEnvironment(),
    },
  ],
  exports: [WASL_CONFIG],
})
class WaslConfigModule {}
export { WaslConfigModule };
