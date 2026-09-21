import { loadConfig } from '../../src/app/config/config.js';
import {
  createInfrastructure,
  type Infrastructure,
} from '../../src/app/bootstrap/create-infrastructure.js';

let sharedInfra: Infrastructure | undefined;

async function closeInfrastructure(infra: Infrastructure): Promise<void> {
  await infra.queue.close().catch(() => undefined);
  await infra.redis.close().catch(() => undefined);
  await infra.database.close().catch(() => undefined);
}

async function createFreshInfrastructure(): Promise<Infrastructure> {
  const config = loadConfig(process.env);
  sharedInfra = await createInfrastructure(config);
  return sharedInfra;
}

export async function getTestInfrastructure(): Promise<Infrastructure> {
  if (sharedInfra === undefined) {
    return createFreshInfrastructure();
  }

  try {
    await sharedInfra.redis.healthCheck();
    return sharedInfra;
  } catch {
    await closeInfrastructure(sharedInfra);
    return createFreshInfrastructure();
  }
}

export async function closeTestInfrastructure(): Promise<void> {
  if (sharedInfra === undefined) return;
  await closeInfrastructure(sharedInfra);
  sharedInfra = undefined;
}
