import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { toErrorMessage } from '../../shared/errors/index.js';
const NOOP_TRACING = { shutdown: () => Promise.resolve() };
export function startTracing(config, logger) {
    if (!config.observability.tracingEnabled) {
        logger.debug({}, 'Tracing disabled');
        return NOOP_TRACING;
    }
    const endpoint = config.observability.otlpEndpoint;
    if (endpoint === undefined) {
        // Config validation already rejects this combination; the guard keeps the
        // type narrowing honest.
        logger.warn({}, 'Tracing enabled without an OTLP endpoint; skipping');
        return NOOP_TRACING;
    }
    const sdk = new NodeSDK({
        resource: new Resource({
            [ATTR_SERVICE_NAME]: config.observability.serviceName,
            [ATTR_SERVICE_VERSION]: '0.1.0',
            'deployment.environment.name': config.env,
        }),
        traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
        instrumentations: [
            new HttpInstrumentation({
                // Probe and scrape traffic would otherwise dominate the trace volume.
                ignoreIncomingRequestHook: (request) => {
                    const url = request.url ?? '';
                    return url.startsWith('/health') || url.startsWith('/internal/metrics');
                },
            }),
            new PgInstrumentation({ enhancedDatabaseReporting: false }),
            new IORedisInstrumentation(),
        ],
    });
    sdk.start();
    logger.info({ endpoint }, 'Tracing started');
    return {
        shutdown: async () => {
            try {
                await sdk.shutdown();
            }
            catch (error) {
                // A failing exporter must never block process shutdown.
                logger.warn({ reason: toErrorMessage(error) }, 'Tracing shutdown failed');
            }
        },
    };
}
/**
 * Current W3C trace id, or `undefined` when tracing is off.
 *
 * Returning it lets the same identifier appear in logs and in the
 * `x-request-id`-adjacent response metadata, which is what makes a log line
 * and a trace joinable.
 */
export function currentTraceId() {
    const span = trace.getActiveSpan();
    if (span === undefined)
        return undefined;
    const { traceId } = span.spanContext();
    // All-zero ids mean "no recording context".
    return /^0+$/.test(traceId) ? undefined : traceId;
}
