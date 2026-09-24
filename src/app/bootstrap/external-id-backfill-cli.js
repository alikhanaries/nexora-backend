import { loadConfigFromEnvironment } from '../config/index.js';
import { createInfrastructure } from './create-infrastructure.js';
import { createExternalIdMappingModule } from '../../modules/external-id-mapping/index.js';
import { describeErrorForLog } from '../../shared/errors/index.js';

const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string[]} argv
 */
function parseOptions(argv) {
    /** @type {{ tenantId?: string }} */
    const options = {};
    for (const arg of argv.slice(2)) {
        if (arg.startsWith('--tenant-id=')) {
            const tenantId = arg.slice('--tenant-id='.length).trim();
            if (!TENANT_ID_PATTERN.test(tenantId)) {
                throw new Error(`Invalid --tenant-id value: ${tenantId}`);
            }
            options.tenantId = tenantId;
        }
        else {
            throw new Error(`Unknown argument "${arg}". Usage: external-id-backfill-cli.js [--tenant-id=<uuid>]`);
        }
    }
    return options;
}

async function main() {
    const options = parseOptions(process.argv);
    const config = loadConfigFromEnvironment();
    const infra = await createInfrastructure(config);
    const logger = infra.logger.child({ component: 'external-id-backfill-cli' });
    try {
        const { externalIntegerIdBackfillService } = createExternalIdMappingModule({
            database: infra.database,
            logger: infra.logger,
        });
        const result = await externalIntegerIdBackfillService.run({
            tenantIds: options.tenantId === undefined ? undefined : [options.tenantId],
        });
        logger.info({ tenants: result.tenants }, 'External integer ID backfill completed');
    }
    finally {
        await infra.database.close().catch(() => undefined);
        await infra.redis.close().catch(() => undefined);
        await infra.queue.close().catch(() => undefined);
        await logger.flush();
    }
}

main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ msg: 'External ID backfill failed', err: describeErrorForLog(error) })}\n`);
    process.exitCode = 1;
});
