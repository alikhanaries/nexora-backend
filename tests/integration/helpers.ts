import { loadConfig } from '../../src/app/config/config.js';
import {
  createInfrastructure,
  type Infrastructure,
} from '../../src/app/bootstrap/create-infrastructure.js';

let sharedInfra: Infrastructure | undefined;

export async function getTestInfrastructure(): Promise<Infrastructure> {
  if (sharedInfra === undefined) {
    const config = loadConfig(process.env);
    sharedInfra = await createInfrastructure(config);
  }
  return sharedInfra;
}

export async function closeTestInfrastructure(): Promise<void> {
  if (sharedInfra === undefined) return;
  await sharedInfra.queue.close();
  await sharedInfra.redis.close();
  await sharedInfra.database.close();
  sharedInfra = undefined;
}
