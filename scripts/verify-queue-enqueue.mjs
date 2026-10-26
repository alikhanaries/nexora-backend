import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env', override: false });
process.env.REDIS_URL = process.env.WASL_INTEGRATION_REDIS_URL ?? 'redis://localhost:6380';
process.env.QUEUE_REDIS_URL = process.env.REDIS_URL;
process.env.NODE_ENV ??= 'test';

const timeout = setTimeout(() => {
  console.error(JSON.stringify({ ok: false, error: 'TIMEOUT' }));
  process.exit(2);
}, 15_000);

const { getTestInfrastructure } = await import('../tests/integration/helpers.js');
const { QueueName, JobName } = await import('../src/infrastructure/queue/queue-names.js');

const infra = await getTestInfrastructure();
const jobId = `verify-${randomUUID()}`;

try {
  const result = await infra.queue.enqueue(
    QueueName.WEBHOOK_DELIVERIES,
    JobName.DELIVER_WEBHOOK,
    { tenantId: randomUUID(), deliveryId: randomUUID() },
    { jobId },
  );
  const removed = await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, jobId);
  console.log(JSON.stringify({ ok: true, enqueued: result, removed }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, message: error.message, details: error.safeDetails ?? null }));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await infra.queue.close().catch(() => undefined);
  await infra.redis.close().catch(() => undefined);
  await infra.database.close().catch(() => undefined);
}
