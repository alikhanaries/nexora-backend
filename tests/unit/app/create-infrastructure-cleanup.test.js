import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseClose = vi.fn(async () => undefined);
const redisClose = vi.fn(async () => undefined);
const redisConnect = vi.fn(async () => {
    throw new Error('redis unavailable');
});
const tracingShutdown = vi.fn(async () => undefined);
const runMigrations = vi.fn(async () => undefined);

vi.mock('../../../src/infrastructure/observability/pino-logger.js', () => ({
    createPinoLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(function child() {
            return this;
        }),
        flush: vi.fn(async () => undefined),
    }),
}));

vi.mock('../../../src/infrastructure/observability/tracing.js', () => ({
    startTracing: () => ({ shutdown: tracingShutdown }),
}));

vi.mock('../../../src/infrastructure/postgres/postgres-database.js', () => ({
    PostgresDatabase: vi.fn(function PostgresDatabase() {
        this.runMigrations = runMigrations;
        this.close = databaseClose;
        this.reportPoolMetrics = vi.fn();
    }),
}));

vi.mock('../../../src/infrastructure/redis/redis-client.js', () => ({
    RedisConnection: vi.fn(function RedisConnection() {
        this.connect = redisConnect;
        this.close = redisClose;
    }),
}));

vi.mock('../../../src/shared/metrics/index.js', () => ({
    noopMetricsRecorder: {},
}));

describe('createInfrastructure partial-failure cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        redisConnect.mockRejectedValueOnce(new Error('redis unavailable'));
    });

    it('closes database and tracing when Redis connect fails after migrations', async () => {
        const { createInfrastructure } = await import('../../../src/app/create-infrastructure.js');
        const config = {
            observability: {
                metricsEnabled: false,
                serviceName: 'wasl-api',
                tracingEnabled: false,
            },
            workerObservability: { otelServiceName: 'wasl-worker' },
            database: {
                url: 'postgres://example',
                migrationUrl: 'postgres://example',
            },
            redis: { keyPrefix: 'wasl' },
            instanceNamespace: 'test',
        };

        await expect(createInfrastructure(config)).rejects.toThrow('redis unavailable');
        expect(runMigrations).toHaveBeenCalledOnce();
        expect(databaseClose).toHaveBeenCalledOnce();
        expect(redisClose).toHaveBeenCalledOnce();
        expect(tracingShutdown).toHaveBeenCalledOnce();
    });
});
