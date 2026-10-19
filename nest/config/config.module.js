import { Global, Module } from '@nestjs/common';
import { loadConfigFromEnvironment } from '../../src/app/config/index.js';

/** DI token for validated application configuration (root `nest/` stub only). */
export const WASL_CONFIG = Symbol('WASL_CONFIG');

export @Global()
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

