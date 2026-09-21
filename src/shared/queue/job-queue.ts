/**
 * Queue port.
 *
 * Business code depends on this interface; only
 * src/infrastructure/queue may import BullMQ. That keeps the queue technology
 * replaceable and keeps BullMQ types out of use cases.
 */

export type JobPayload = Readonly<Record<string, unknown>>;

export interface EnqueueOptions {
  /**
   * Stable job identity. Re-enqueueing the same id is ignored by the backend,
   * which makes producer-side retries safe.
   */
  readonly jobId?: string | undefined;
  readonly attempts?: number | undefined;
  readonly priority?: number | undefined;
  /** Seconds a completed job is retained for inspection. */
  readonly removeOnCompleteSeconds?: number | undefined;
}

export interface EnqueuedJob {
  readonly id: string;
  readonly queue: string;
  readonly name: string;
}

export interface JobContext {
  readonly id: string;
  readonly name: string;
  readonly queue: string;
  readonly attempt: number;
  readonly maxAttempts: number;
}

export type JobHandler = (payload: JobPayload, context: JobContext) => Promise<void>;

export interface JobQueue {
  enqueue(
    queue: string,
    name: string,
    payload: JobPayload,
    options?: EnqueueOptions,
  ): Promise<EnqueuedJob>;
  /** Schedules `name` to run after `delayMs`. */
  enqueueDelayed(
    queue: string,
    name: string,
    payload: JobPayload,
    delayMs: number,
    options?: EnqueueOptions,
  ): Promise<EnqueuedJob>;
  /**
   * Removes a job that has not started.
   *
   * Returns `false` when the job is active or already finished - an active job
   * cannot be cancelled safely, so callers must handle that case rather than
   * assume removal succeeded.
   */
  remove(queue: string, jobId: string): Promise<boolean>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}
