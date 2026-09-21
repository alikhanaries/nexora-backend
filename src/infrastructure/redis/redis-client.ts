import { performance } from 'node:perf_hooks';
import { Redis, type RedisOptions } from 'ioredis';
import type { RedisConfig } from '../../shared/config/index.js';
import { ServiceUnavailableError, toErrorMessage } from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/index.js';
import type { MetricsRecorder } from '../../shared/metrics/index.js';

/**
 * Owns every Redis connection in the process.
 *
 * No other module may construct a Redis client: connections are a shared
 * resource, reconnect policy must be uniform, and a stray client would not be
 * closed during graceful shutdown.
 */

export interface RedisConnectionDependencies {
  readonly config: RedisConfig;
  readonly logger: Logger;
  readonly metrics: MetricsRecorder;
}

function buildOptions(config: RedisConfig, logger: Logger): RedisOptions {
  return {
    connectTimeout: config.connectTimeoutMs,
    commandTimeout: config.commandTimeoutMs,
    // Fail fast instead of queueing commands forever while disconnected: a
    // growing offline queue turns a Redis blip into an out-of-memory crash.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    retryStrategy: (attempt: number): number => {
      const delayMs = Math.min(attempt * 200, 5_000);
      logger.warn({ attempt, delayMs }, 'Redis reconnect scheduled');
      return delayMs;
    },
  };
}

export class RedisConnection {
  readonly client: Redis;

  private readonly logger: Logger;
  private readonly metrics: MetricsRecorder;
  private closed = false;

  constructor({ config, logger, metrics }: RedisConnectionDependencies) {
    this.logger = logger.child({ component: 'redis' });
    this.metrics = metrics;
    this.client = new Redis(config.url, buildOptions(config, this.logger));

    this.client.on('error', (error: Error) => {
      // ioredis emits 'error' on every failed reconnect attempt. Without a
      // listener Node treats it as an unhandled error event and exits.
      this.logger.error({ reason: error.message }, 'Redis connection error');
    });
    this.client.on('ready', () => {
      this.logger.info({}, 'Redis connection ready');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      throw new ServiceUnavailableError('Redis is unavailable', {
        reason: toErrorMessage(error),
      });
    }
  }

  async healthCheck(): Promise<void> {
    await this.run('ping', () => this.client.ping());
  }

  /**
   * Wraps a Redis call with timing, metrics and error normalisation.
   *
   * `operation` must be a constant such as `cache.get`: it becomes a metric
   * label, so an interpolated key would explode cardinality.
   */
  async run<T>(operation: string, work: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    let success = false;
    try {
      const result = await work();
      success = true;
      return result;
    } catch (error) {
      throw new ServiceUnavailableError('Redis operation failed', {
        operation,
        reason: toErrorMessage(error),
      });
    } finally {
      this.metrics.recordRedisOperation({
        operation,
        durationSeconds: (performance.now() - startedAt) / 1_000,
        success,
      });
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      // QUIT waits for in-flight commands; disconnect() would drop them.
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
    this.logger.info({}, 'Redis connection closed');
  }
}
