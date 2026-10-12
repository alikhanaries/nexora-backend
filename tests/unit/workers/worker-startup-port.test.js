import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/app/config/config.js';
import { ReadinessService, createWorkerReadinessProbes } from '../../../src/app/observability/readiness.js';
import { noopMetricsRecorder } from '../../../src/shared/metrics/index.js';
import { QueueName } from '../../../src/infrastructure/queue/queue-names.js';
import { registerWorkerHandlers } from '../../../src/workers/handlers/queue-job-handlers.js';
import { startWorkerObservabilityHttp } from '../../../src/workers/observability/start-worker-observability-http.js';

const baseEnv = {
    DATABASE_URL: 'postgresql://nexora:nexora@localhost:5432/nexora',
    REDIS_URL: 'redis://localhost:6379',
    STORAGE_BUCKET: 'nexora-local',
    STORAGE_ACCESS_KEY_ID: 'nexora',
    STORAGE_SECRET_ACCESS_KEY: 'nexora-secret',
    AUTH_JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
};

function createReadiness() {
    const workerRuntime = { hasRegisteredWorkers: () => true };
    return new ReadinessService(createWorkerReadinessProbes({
        database: { healthCheck: async () => undefined },
        redis: { healthCheck: async () => undefined },
        queue: { healthCheck: async () => undefined },
        workerRuntime,
    }));
}

describe('worker startup port separation', () => {
    it('defaults worker observability to port 3002 (distinct from Nest migration default 3001)', () => {
        const config = loadConfig({ ...baseEnv, NODE_ENV: 'test' });
        expect(config.server.port).toBe(3000);
        expect(config.workerObservability.port).toBe(3002);
        expect(config.workerObservability.port).not.toBe(config.server.port);
    });

    it('does not import API HTTP bootstrap from workers/main.js', () => {
        const src = readFileSync(new URL('../../../src/workers/main.js', import.meta.url), 'utf8');
        expect(src).not.toMatch(/app\/main\.js/);
        expect(src).not.toMatch(/createApplication/);
        expect(src).not.toMatch(/create-nest-http-server/);
    });

    it('skips observability listen when WORKER_OBSERVABILITY_HTTP_ENABLED=false', async () => {
        const config = loadConfig({
            ...baseEnv,
            NODE_ENV: 'test',
            WORKER_OBSERVABILITY_HTTP_ENABLED: 'false',
        });
        const server = await startWorkerObservabilityHttp({
            workerObservability: config.workerObservability,
            serverPort: config.server.port,
            readiness: createReadiness(),
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        expect(server).toBeUndefined();
    });

    it('rejects worker observability port equal to NEST_SERVER_PORT', async () => {
        const previous = process.env.NEST_SERVER_PORT;
        process.env.NEST_SERVER_PORT = '3001';
        try {
            const config = loadConfig({
                ...baseEnv,
                NODE_ENV: 'test',
                WORKER_OBSERVABILITY_PORT: '3001',
            });
            await expect(startWorkerObservabilityHttp({
                workerObservability: config.workerObservability,
                serverPort: config.server.port,
                readiness: createReadiness(),
                metrics: noopMetricsRecorder,
                metricsEnabled: true,
            })).rejects.toMatchObject({ name: 'ConfigurationError' });
        }
        finally {
            if (previous === undefined) {
                delete process.env.NEST_SERVER_PORT;
            }
            else {
                process.env.NEST_SERVER_PORT = previous;
            }
        }
    });

    it('rejects worker observability port equal to SERVER_PORT', async () => {
        const config = loadConfig({
            ...baseEnv,
            NODE_ENV: 'test',
            SERVER_PORT: '4005',
            WORKER_OBSERVABILITY_PORT: '4005',
        });
        await expect(startWorkerObservabilityHttp({
            workerObservability: config.workerObservability,
            serverPort: config.server.port,
            readiness: createReadiness(),
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        })).rejects.toMatchObject({ name: 'ConfigurationError' });
    });

    it('starts two worker observability listeners on distinct configured ports', async () => {
        const readiness = createReadiness();
        const configA = loadConfig({
            ...baseEnv,
            NODE_ENV: 'test',
            WORKER_OBSERVABILITY_PORT: '38441',
        });
        const configB = loadConfig({
            ...baseEnv,
            NODE_ENV: 'test',
            WORKER_OBSERVABILITY_PORT: '38442',
        });
        const first = await startWorkerObservabilityHttp({
            workerObservability: configA.workerObservability,
            serverPort: configA.server.port,
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        const second = await startWorkerObservabilityHttp({
            workerObservability: configB.workerObservability,
            serverPort: configB.server.port,
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        expect(first).toBeDefined();
        expect(second).toBeDefined();
        await first?.close();
        await second?.close();
    });

    it('registerWorkerHandlers registers all four worker queues', () => {
        const registered = [];
        const workerRuntime = {
            register: (queueName) => {
                registered.push(queueName);
            },
        };
        registerWorkerHandlers({
            workerRuntime,
            integrationEventRouter: { route: async () => undefined },
            webhookDeliveryService: { deliver: async () => undefined },
            channelCatalogSyncService: { processSyncJob: async () => undefined },
            executeMarketplaceLifecycleJob: { execute: async () => undefined },
            marketplaceLifecycleQueueName: QueueName.MARKETPLACE_ORDER_LIFECYCLE,
        });
        expect(registered).toEqual([
            QueueName.INTEGRATION_EVENTS,
            QueueName.WEBHOOK_DELIVERIES,
            QueueName.CHANNEL_CATALOG_SYNC,
            QueueName.MARKETPLACE_ORDER_LIFECYCLE,
        ]);
    });
});
