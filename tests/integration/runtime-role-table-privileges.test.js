import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

/**
 * Tables introduced after 0030_rls_hardening must remain writable by wasl_app.
 * Order creation assigns compat external IDs via external_integer_id_mappings.
 */
const RUNTIME_ROLE_TABLES = [
    'external_integer_id_mappings',
    'external_integer_id_sequences',
    'webhook_subscriptions',
    'webhook_deliveries',
    'marketplace_connections',
    'marketplace_entity_mappings',
];

function buildAppRoleUrl(databaseUrl) {
    const url = new URL(databaseUrl);
    url.username = 'wasl_app';
    if (url.password === '') {
        url.password = 'wasl';
    }
    return url.toString();
}

describe('wasl_app table privileges (post-0030 migrations)', () => {
    /** @type {import('pg').Pool} */
    let appRolePool;

    beforeAll(async () => {
        await getTestInfrastructure();
        const config = loadConfig(process.env);
        appRolePool = new Pool({
            connectionString: buildAppRoleUrl(config.database.url),
            max: 1,
        });
    });

    afterAll(async () => {
        await appRolePool?.end().catch(() => undefined);
        await closeTestInfrastructure();
    });

    it.each(RUNTIME_ROLE_TABLES)('grants DML on %s to wasl_app', async (tableName) => {
        const result = await appRolePool.query(
            `SELECT
         has_table_privilege('wasl_app', $1, 'SELECT') AS can_select,
         has_table_privilege('wasl_app', $1, 'INSERT') AS can_insert,
         has_table_privilege('wasl_app', $1, 'UPDATE') AS can_update,
         has_table_privilege('wasl_app', $1, 'DELETE') AS can_delete`,
            [tableName],
        );
        const row = result.rows[0];
        expect(row?.can_select).toBe(true);
        expect(row?.can_insert).toBe(true);
        expect(row?.can_update).toBe(true);
        expect(row?.can_delete).toBe(true);
    });
});
