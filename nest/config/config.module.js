import { Global, Module } from '@nestjs/common';
import { loadConfigFromEnvironment } from '../../src/app/config/index.js';

export const NEXORA_CONFIG = Symbol('NEXORA_CONFIG');

export @Global()
@Module({
  providers: [
    {
      provide: NEXORA_CONFIG,
      useFactory: () => loadConfigFromEnvironment(),
    },
  ],
  exports: [NEXORA_CONFIG],
})
class NexoraConfigModule {}
