import { Pool } from 'pg';
import { loadConfigFromEnvironment } from '../config/index.js';
import { describeErrorForLog } from '../../shared/errors/index.js';
import { createPinoLogger } from '../../infrastructure/observability/pino-logger.js';
import { migrateUp, migrationStatus } from '../../infrastructure/postgres/migrator.js';
function parseCommand(argv) {
    const command = argv[2];
    if (command === 'up' || command === 'status')
        return command;
    throw new Error(`Unknown command "${command ?? ''}". Usage: migrate-cli.js <up|status>`);
}
async function main() {
    const command = parseCommand(process.argv);
    const config = loadConfigFromEnvironment();
    const logger = createPinoLogger(config).child({ component: 'migrator' });
    const pool = new Pool({
        connectionString: config.database.url,
        max: 1,
        connectionTimeoutMillis: config.database.pool.connectionTimeoutMs,
        ...(config.database.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    });
    try {
        if (command === 'up') {
            const result = await migrateUp(pool, logger);
            logger.info({ applied: result.appliedVersions, alreadyUpToDate: result.alreadyUpToDate }, 'Migration run finished');
        }
        else {
            const status = await migrationStatus(pool);
            logger.info({
                appliedCount: status.applied.length,
                pending: status.pending.map((migration) => migration.filename),
            }, 'Migration status');
        }
    }
    finally {
        await pool.end();
        await logger.flush();
    }
}
main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ msg: 'Migration failed', err: describeErrorForLog(error) })}\n`);
    process.exitCode = 1;
});
