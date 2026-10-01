import { afterEach, describe, expect, it } from '@jest/globals';
import { loadConfigFromEnvironment } from '../../src/app/config/index.js';
import { createNestInfrastructure } from '../../src/nest/bootstrap/create-nest-infrastructure.js';
import { buildAppModule } from '../../src/nest/app.module.js';
import { NEXORA_CONFIG } from '../../src/nest/config/config.module.js';
import { NEXORA_DATABASE, NEXORA_LOGGER } from '../../src/nest/database/database.module.js';
import { DatabaseService } from '../../src/nest/database/database.service.js';
import { Test } from '@nestjs/testing';
import { createPinoLogger } from '../../src/infrastructure/observability/pino-logger.js';
import { noopMetricsRecorder } from '../../src/shared/metrics/index.js';

describe('Nest Phase 3 infrastructure', () => {
  it('loads configuration from the existing environment loader', () => {
    const config = loadConfigFromEnvironment();
    expect(config.appName).toBeTruthy();
    expect(config.database.url).toMatch(/^postgresql:/);
  });

  it('creates infrastructure without database when connectDatabase is false', async () => {
    const config = loadConfigFromEnvironment();
    const infra = await createNestInfrastructure(config, { connectDatabase: false });
    expect(infra.database).toBeNull();
    expect(infra.logger).toBeTruthy();
  });

  it('registers logger, config, and database providers in the Nest module', async () => {
    const config = loadConfigFromEnvironment();
    const infra = {
      logger: createPinoLogger({ ...config, observability: { ...config.observability, logLevel: 'silent' } }),
      metrics: noopMetricsRecorder,
      database: null,
    };
    const AppModule = buildAppModule(infra);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(NEXORA_CONFIG).appName).toBe(config.appName);
    expect(moduleRef.get(NEXORA_LOGGER)).toBe(infra.logger);
    expect(moduleRef.get(NEXORA_DATABASE)).toBeNull();
    expect(moduleRef.get(DatabaseService).isAvailable()).toBe(false);

    await moduleRef.close();
  });

  it('fails clearly when PostgreSQL is unreachable', async () => {
    const config = loadConfigFromEnvironment();
    const badConfig = {
      ...config,
      database: {
        ...config.database,
        url: 'postgresql://invalid:invalid@127.0.0.1:1/nexora',
        migrationUrl: 'postgresql://invalid:invalid@127.0.0.1:1/nexora',
        pool: { ...config.database.pool, connectionTimeoutMs: 500 },
      },
    };

    await expect(
      createNestInfrastructure(badConfig, { connectDatabase: true, runMigrations: false }),
    ).rejects.toThrow();
  });
});
