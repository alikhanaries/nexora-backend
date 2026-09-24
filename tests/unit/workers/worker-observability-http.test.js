import { describe, expect, it } from 'vitest';
import { ReadinessService, createWorkerReadinessProbes } from '../../../src/app/observability/readiness.js';
import { noopMetricsRecorder } from '../../../src/shared/metrics/index.js';
import { PrometheusMetrics } from '../../../src/infrastructure/observability/prometheus-metrics.js';
import { createWorkerObservabilityHttpServer } from '../../../src/workers/observability/create-worker-observability-http-server.js';
import { isObservabilityProbePath } from '../../../src/infrastructure/observability/tracing.js';
function createDeps(overrides = {}) {
    const workerRuntime = {
        hasRegisteredWorkers: () => overrides.workersRegistered ?? true,
    };
    const database = {
        healthCheck: overrides.postgresHealth ?? (async () => undefined),
    };
    const redis = {
        healthCheck: overrides.redisHealth ?? (async () => undefined),
    };
    const queue = {
        healthCheck: overrides.queueHealth ?? (async () => undefined),
    };
    const readiness = new ReadinessService(createWorkerReadinessProbes({
        database,
        redis,
        queue,
        workerRuntime,
    }));
    return { readiness, workerRuntime, database, redis, queue };
}
describe('worker observability HTTP', () => {
    it('serves liveness ok when accepting traffic', async () => {
        const { readiness } = createDeps();
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        const live = await app.inject({ method: 'GET', url: '/health/live' });
        expect(live.statusCode).toBe(200);
        expect(live.json()).toEqual({ status: 'ok' });
        await app.close();
    });
    it('serves liveness shutting_down after markNotReady', async () => {
        const { readiness } = createDeps();
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        readiness.markNotReady();
        const live = await app.inject({ method: 'GET', url: '/health/live' });
        expect(live.statusCode).toBe(503);
        expect(live.json()).toEqual({ status: 'shutting_down' });
        await app.close();
    });
    it('does not fail liveness when dependencies fail', async () => {
        const { readiness } = createDeps({
            postgresHealth: async () => {
                throw new Error('postgres down');
            },
        });
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        const live = await app.inject({ method: 'GET', url: '/health/live' });
        expect(live.statusCode).toBe(200);
        await app.close();
    });
    it('serves readiness with worker checks and excludes storage', async () => {
        const { readiness } = createDeps();
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        const ready = await app.inject({ method: 'GET', url: '/health/ready' });
        expect(ready.statusCode).toBe(200);
        const body = ready.json();
        expect(body.status).toBe('ready');
        expect(body.checks).toMatchObject({
            postgres: 'ok',
            redis: 'ok',
            queue: 'ok',
            workers_registered: 'ok',
        });
        expect(body.checks.storage).toBeUndefined();
        await app.close();
    });
    it('returns 503 readiness when a dependency fails', async () => {
        const { readiness } = createDeps({
            queueHealth: async () => {
                throw new Error('queue down');
            },
        });
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        const ready = await app.inject({ method: 'GET', url: '/health/ready' });
        expect(ready.statusCode).toBe(503);
        expect(ready.json().checks.queue).toBe('failed');
        await app.close();
    });
    it('returns 503 readiness when no workers registered', async () => {
        const { readiness } = createDeps({ workersRegistered: false });
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        const ready = await app.inject({ method: 'GET', url: '/health/ready' });
        expect(ready.statusCode).toBe(503);
        expect(ready.json().checks.workers_registered).toBe('failed');
        await app.close();
    });
    it('serves Prometheus metrics from the existing registry', async () => {
        const { readiness } = createDeps();
        const metrics = new PrometheusMetrics('nexora-backend-worker');
        metrics.recordQueueJob({
            queue: 'integration-events',
            jobName: 'publish-integration-event',
            outcome: 'completed',
            durationSeconds: 0.01,
        });
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics,
            metricsEnabled: true,
        });
        const response = await app.inject({ method: 'GET', url: '/internal/metrics' });
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('queue_jobs_total');
        expect(response.body).toContain('service="nexora-backend-worker"');
        await app.close();
    });
    it('returns 404 for metrics when disabled', async () => {
        const { readiness } = createDeps();
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: false,
        });
        const response = await app.inject({ method: 'GET', url: '/internal/metrics' });
        expect(response.statusCode).toBe(404);
        await app.close();
    });
    it('returns 500 when metrics render fails', async () => {
        const { readiness } = createDeps();
        const metrics = {
            contentType: 'text/plain; charset=utf-8',
            render: () => Promise.reject(new Error('render failed')),
        };
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics,
            metricsEnabled: true,
        });
        const response = await app.inject({ method: 'GET', url: '/internal/metrics' });
        expect(response.statusCode).toBe(500);
        await app.close();
    });
    it('does not expose /metrics or root /health aliases', async () => {
        const { readiness } = createDeps();
        const app = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: noopMetricsRecorder,
            metricsEnabled: true,
        });
        const metricsAlias = await app.inject({ method: 'GET', url: '/metrics' });
        const healthRoot = await app.inject({ method: 'GET', url: '/health' });
        expect(metricsAlias.statusCode).toBe(404);
        expect(healthRoot.statusCode).toBe(404);
        await app.close();
    });
    it('ignores observability paths for HTTP tracing', () => {
        expect(isObservabilityProbePath('/health/live')).toBe(true);
        expect(isObservabilityProbePath('/health/ready')).toBe(true);
        expect(isObservabilityProbePath('/internal/metrics')).toBe(true);
        expect(isObservabilityProbePath('/api/v1/foundation/ping')).toBe(false);
    });
});
