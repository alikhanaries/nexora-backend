import { Redis } from 'ioredis';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env', override: false });

const redisUrl = process.env.QUEUE_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6380';
const timeout = setTimeout(() => {
  console.error(JSON.stringify({ ok: false, error: 'TIMEOUT' }));
  process.exit(2);
}, 10_000);

const redis = new Redis(redisUrl, { maxRetriesPerRequest: null, connectTimeout: 5_000 });

try {
  const pong = await redis.ping();
  const info = await redis.info('server');
  const versionLine = info.split('\n').find((line) => line.startsWith('redis_version:'));
  const version = versionLine?.split(':')[1]?.trim() ?? 'unknown';
  const major = Number.parseInt(version.split('.')[0] ?? '0', 10);
  console.log(
    JSON.stringify({
      ok: true,
      endpoint: redisUrl.replace(/\/\/.*@/, '//***@'),
      ping: pong,
      redisVersion: version,
      bullMqCompatible: major >= 5,
    }),
  );
} catch (error) {
  console.log(JSON.stringify({ ok: false, endpoint: redisUrl.replace(/\/\/.*@/, '//***@'), error: error.message }));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await redis.quit().catch(() => undefined);
}
