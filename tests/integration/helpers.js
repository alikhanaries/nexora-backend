import { loadConfig } from '../../src/app/config/config.js';
import { createInfrastructure, } from '../../src/app/bootstrap/create-infrastructure.js';
let sharedInfra;
async function closeInfrastructure(infra) {
    await infra.queue.close().catch(() => undefined);
    await infra.redis.close().catch(() => undefined);
    await infra.database.close().catch(() => undefined);
}
async function createFreshInfrastructure() {
    const config = loadConfig(process.env);
    sharedInfra = await createInfrastructure(config);
    return sharedInfra;
}
export async function getTestInfrastructure() {
    if (sharedInfra === undefined) {
        return createFreshInfrastructure();
    }
    try {
        await sharedInfra.redis.healthCheck();
        return sharedInfra;
    }
    catch {
        await closeInfrastructure(sharedInfra);
        return createFreshInfrastructure();
    }
}
export async function closeTestInfrastructure() {
    if (sharedInfra === undefined)
        return;
    await closeInfrastructure(sharedInfra);
    sharedInfra = undefined;
}
