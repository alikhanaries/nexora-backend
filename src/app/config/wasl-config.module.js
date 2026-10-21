import { Global, Module } from '@nestjs/common';
import { loadConfigFromEnvironment } from './index.js';

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
