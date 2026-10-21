/**
 * Starts the worker-only HTTP server for liveness, readiness, and metrics.
 *
 * Disabled when worker observability HTTP is off in configuration.
 */
import { ConfigurationError } from '../../shared/errors/index.js';
import { createWorkerObservabilityHttpServer } from './create-worker-observability-http-server.js';

/**
 * @param {object} input
 * @param {import('../../app/config/config.js').AppConfig['workerObservability']} input.workerObservability
 * @param {number} input.serverPort
 * @param {import('../../app/observability/readiness.js').ReadinessService} input.readiness
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} input.metrics
 * @param {boolean} input.metricsEnabled
 * @param {import('../../shared/logging/logger.port.js').Logger} [input.logger]
 */
export async function startWorkerObservabilityHttp(input) {
    const { workerObservability, serverPort, readiness, metrics, metricsEnabled, logger } = input;
    if (!workerObservability.httpEnabled) {
        return undefined;
    }
    if (workerObservability.port === serverPort) {
        throw new ConfigurationError(
            'WORKER_OBSERVABILITY_PORT must not equal SERVER_PORT when worker observability HTTP is enabled',
        );
    }
    const nestServerPort = parseOptionalPort(process.env.NEST_SERVER_PORT);
    if (nestServerPort !== null && workerObservability.port === nestServerPort) {
        throw new ConfigurationError(
            'WORKER_OBSERVABILITY_PORT must not equal NEST_SERVER_PORT when worker observability HTTP is enabled',
        );
    }
    const workerObservabilityHttp = await createWorkerObservabilityHttpServer({
        readiness,
        metrics,
        metricsEnabled,
    });
    try {
        await listen(workerObservabilityHttp, workerObservability.port, workerObservability.host);
    }
    catch (error) {
        throw mapWorkerObservabilityListenError(error, workerObservability);
    }
    logger?.info({
        host: workerObservability.host,
        port: workerObservability.port,
    }, 'Worker observability HTTP started');
    return workerObservabilityHttp;
}

/**
 * @param {{ listen: (port: number, host: string, cb: (err?: Error) => void) => void }} server
 * @param {number} port
 * @param {string} host
 */
function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        server.listen(port, host, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

/**
 * @param {unknown} error
 * @param {{ host: string, port: number }} workerObservability
 */
function mapWorkerObservabilityListenError(error, workerObservability) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'EADDRINUSE') {
        return new ConfigurationError(
            `Worker observability HTTP could not bind ${workerObservability.host}:${workerObservability.port} `
            + '(address already in use). Set WORKER_OBSERVABILITY_PORT to a free port (default 3002) '
            + 'that does not collide with the API or Nest server.',
        );
    }
    return error;
}

/** @param {string | undefined} raw */
function parseOptionalPort(raw) {
    if (raw === undefined || raw.trim().length === 0) {
        return null;
    }
    const parsed = Number.parseInt(raw.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
        return null;
    }
    return parsed;
}
