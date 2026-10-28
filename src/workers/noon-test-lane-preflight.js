import { QueueName } from '../infrastructure/queue/queue-names.js';
import { classifyNoonDeploymentGateway } from '../modules/marketplaces/repositories/adapters/noon/noon-gateway-classification.js';

/** Approved isolated lane defaults (override via env for future lanes). */
export const DEFAULT_APPROVED_ISOLATED_REDIS_HOST = 'localhost:6380';
export const DEFAULT_APPROVED_ISOLATED_QUEUE_PREFIX = 'wasl-noon-isolated-v1';

const PREFLIGHT_QUEUES = [
    QueueName.INTEGRATION_EVENTS,
    QueueName.CHANNEL_CATALOG_SYNC,
    QueueName.WEBHOOK_DELIVERIES,
];

/**
 * @param {string | null | undefined} redisUrl
 */
export function sanitizeRedisEndpoint(redisUrl) {
    if (typeof redisUrl !== 'string' || redisUrl.trim().length === 0) {
        return { hostPort: 'UNKNOWN', source: 'missing' };
    }
    try {
        const parsed = new URL(redisUrl);
        const port = parsed.port || (parsed.protocol === 'rediss:' ? '6380' : '6379');
        return { hostPort: `${parsed.hostname}:${port}`, source: 'configured' };
    }
    catch {
        return { hostPort: 'UNKNOWN', source: 'invalid' };
    }
}

/**
 * Pure preflight checks for an approved Noon test worker lane. Does not mutate Redis.
 *
 * @param {{
 *   config: import('../app/config/config.js').AppConfig,
 *   queueJobCounts: (queueName: string) => Promise<{ waiting?: number, active?: number, delayed?: number, failed?: number }>,
 *   env?: NodeJS.ProcessEnv,
 * }} input
 * @returns {Promise<{ ok: boolean, failures: string[], warnings: string[] }>}
 */
export async function evaluateNoonTestLaneWorkerPreflight(input) {
    const env = input.env ?? process.env;
    const failures = [];
    const warnings = [];

    if (env.WASL_NOON_TEST_LANE_PREFLIGHT !== 'true') {
        return { ok: true, failures, warnings };
    }

    if (env.WASL_NOON_TEST_LANE_APPROVED !== 'true') {
        failures.push('WASL_NOON_TEST_LANE_APPROVED must be true when preflight is enabled');
    }
    if (env.WASL_NOON_OPERATOR_CONFIRMED !== 'true') {
        failures.push('WASL_NOON_OPERATOR_CONFIRMED must be true (tenant/channel/SKU not operator-confirmed)');
    }

    const approvedHost = env.WASL_NOON_APPROVED_REDIS_HOST ?? DEFAULT_APPROVED_ISOLATED_REDIS_HOST;
    const approvedPrefix = env.WASL_NOON_APPROVED_QUEUE_PREFIX ?? DEFAULT_APPROVED_ISOLATED_QUEUE_PREFIX;

    const redisEndpoint = sanitizeRedisEndpoint(input.config.queue.redisUrl);
    if (redisEndpoint.hostPort !== approvedHost) {
        failures.push(`Queue Redis endpoint ${redisEndpoint.hostPort} does not match approved ${approvedHost}`);
    }
    if (input.config.queue.prefix !== approvedPrefix) {
        failures.push(`QUEUE_PREFIX ${input.config.queue.prefix} does not match approved ${approvedPrefix}`);
    }

    if (input.config.marketplace.noonCatalogWritesEnabled) {
        failures.push('NOON_CATALOG_WRITES_ENABLED must remain false for test lane preflight');
    }
    if (input.config.catalogSyncReconciliation.enabled) {
        failures.push('CATALOG_SYNC_RECONCILIATION_ENABLED must remain false for test lane preflight');
    }
    if (!input.config.marketplace.noonTestLaneBlockHttp) {
        failures.push('NOON_TEST_LANE_BLOCK_HTTP must be true for test lane preflight');
    }

    const gateway = classifyNoonDeploymentGateway(input.config.marketplace.noonApiBaseUrl);
    if (gateway.classification === 'production_partners' && !input.config.marketplace.noonTestLaneBlockHttp) {
        failures.push('Production Noon gateway configured without NOON_TEST_LANE_BLOCK_HTTP');
    }

    warnings.push('Competing API outbox publisher on the same Redis prefix cannot be verified automatically (UNKNOWN)');

    for (const queueName of PREFLIGHT_QUEUES) {
        const counts = await input.queueJobCounts(queueName);
        const backlog = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0) + (counts.failed ?? 0);
        if (backlog > 0 && env.WASL_NOON_ALLOW_NONEMPTY_QUEUES !== 'true') {
            failures.push(`Queue ${queueName} is not empty (waiting=${counts.waiting ?? 0}, active=${counts.active ?? 0}, delayed=${counts.delayed ?? 0}, failed=${counts.failed ?? 0}); set WASL_NOON_ALLOW_NONEMPTY_QUEUES=true after operator review`);
        }
    }

    return { ok: failures.length === 0, failures, warnings };
}

/**
 * Fail-closed worker startup gate (opt-in via WASL_NOON_TEST_LANE_PREFLIGHT=true).
 *
 * @param {{ config: import('../app/config/config.js').AppConfig, queue: import('../infrastructure/queue/bullmq-job-queue.js').BullMqJobQueue }} deps
 */
export async function runNoonTestLaneWorkerPreflight(deps) {
    const result = await evaluateNoonTestLaneWorkerPreflight({
        config: deps.config,
        queueJobCounts: async (queueName) => deps.queue.queue(queueName).getJobCounts('waiting', 'active', 'delayed', 'failed'),
    });
    if (!result.ok) {
        const err = new Error(`Noon test lane worker preflight failed: ${result.failures.join('; ')}`);
        err.name = 'NoonTestLanePreflightError';
        /** @type {any} */ (err).failures = result.failures;
        /** @type {any} */ (err).warnings = result.warnings;
        throw err;
    }
    return result;
}
