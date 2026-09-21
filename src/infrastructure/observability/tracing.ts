import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { AppConfig } from '../../shared/config/index.js';
import { toErrorMessage } from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/index.js';

/**
 * OpenTelemetry bootstrap.
 *
 * Tracing is opt-in and never required to start the application: with
 * `TRACING_ENABLED=false` no SDK is created and no exporter is contacted, so a
 * developer can run the API with nothing but PostgreSQL and Redis.
 *
 * Instrumentation is enumerated explicitly instead of using
 * auto-instrumentations-node: we only want HTTP, PostgreSQL and Redis, and
 * the explicit list keeps startup cost and dependency surface predictable.
 */

export interface Tracing {
  shutdown(): Promise<void>;
}

const NOOP_TRACING: Tracing = { shutdown: () => Promise.resolve() };

export function startTracing(config: AppConfig, logger: Logger): Tracing {
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
      } catch (error) {
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
export function currentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span === undefined) return undefined;
  const { traceId } = span.spanContext();
  // All-zero ids mean "no recording context".
  return /^0+$/.test(traceId) ? undefined : traceId;
}
