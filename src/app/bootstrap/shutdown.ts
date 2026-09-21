import type { FastifyInstance } from 'fastify';
import type { OutboxPublisher } from '../../infrastructure/postgres/outbox-publisher.js';
import type { PostgresDatabase } from '../../infrastructure/postgres/postgres-database.js';
import type { BullMqWorkerRuntime } from '../../infrastructure/queue/bullmq-worker-runtime.js';
import type { RedisConnection } from '../../infrastructure/redis/redis-client.js';
import type { Tracing } from '../../infrastructure/observability/tracing.js';
import type { JobQueue } from '../../shared/queue/index.js';
import type { Logger } from '../../shared/logging/index.js';
import type { ReadinessService } from '../observability/readiness.js';

export interface ShutdownTargets {
  readonly readiness?: ReadinessService | undefined;
  readonly httpServer?: FastifyInstance | undefined;
  readonly outboxPublisher?: OutboxPublisher | undefined;
  readonly workerRuntime?: BullMqWorkerRuntime | undefined;
  readonly queue?: JobQueue | undefined;
  readonly redis?: RedisConnection | undefined;
  readonly database?: PostgresDatabase | undefined;
  readonly tracing?: Tracing | undefined;
  readonly logger: Logger;
  readonly timeoutMs: number;
}

export async function gracefulShutdown(targets: ShutdownTargets): Promise<void> {
  const { logger, timeoutMs } = targets;
  logger.info({}, 'Graceful shutdown started');
  targets.readiness?.markNotReady();

  const deadline = Date.now() + timeoutMs;

  const runStep = async (name: string, step: () => Promise<void>): Promise<void> => {
    try {
      await step();
      logger.info({ step: name }, 'Shutdown step completed');
    } catch (error) {
      logger.warn(
        { step: name, reason: error instanceof Error ? error.message : 'unknown' },
        'Shutdown step failed',
      );
    }
  };

  if (targets.httpServer !== undefined) {
    await runStep('http.close', async () => {
      await withTimeout(targets.httpServer!.close(), remaining(deadline), 'http.close');
    });
  }

  if (targets.outboxPublisher !== undefined) {
    await runStep('outbox.stop', () => targets.outboxPublisher!.stop());
  }

  if (targets.workerRuntime !== undefined) {
    await runStep('workers.close', () => targets.workerRuntime!.close());
  }

  if (targets.queue !== undefined) {
    await runStep('queue.close', () => targets.queue!.close());
  }

  if (targets.redis !== undefined) {
    await runStep('redis.close', () => targets.redis!.close());
  }

  if (targets.database !== undefined) {
    await runStep('postgres.close', () => targets.database!.close());
  }

  if (targets.tracing !== undefined) {
    await runStep('tracing.flush', () => targets.tracing!.shutdown());
  }

  await targets.logger.flush();
  logger.info({}, 'Graceful shutdown finished');
}

function remaining(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (timeoutMs <= 0) {
    throw new Error(`${label} timed out during shutdown`);
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out during shutdown`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
