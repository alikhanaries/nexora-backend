import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { TENANT_SETTING } from '../../src/infrastructure/postgres/postgres-database.js';
import { ConflictError } from '../../src/shared/errors/index.js';
import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../src/modules/external-id-mapping/public/index.js';
import { createExternalIdMappingModule } from '../../src/modules/external-id-mapping/index.js';
import { createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';

function buildAppRoleUrl(databaseUrl) {
    const url = new URL(databaseUrl);
    url.username = 'nexora_app';
    if (url.password === '') {
        url.password = 'nexora';
    }
    return url.toString();
}

async function queryWithTenant(pool, tenantId, sql, params = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (tenantId !== null) {
            await client.query('SELECT set_config($1, $2, true)', [TENANT_SETTING, tenantId]);
        }
        const result = await client.query(sql, params);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}

describe('external integer ID mapping integration', () => {
    /** @type {import('pg').Pool} */
    let appRolePool;

    beforeAll(async () => {
        await getTestInfrastructure();
        const config = loadConfig(process.env);
        appRolePool = new Pool({
            connectionString: buildAppRoleUrl(config.database.url),
            max: 2,
        });
    });

    afterAll(async () => {
        await appRolePool?.end().catch(() => undefined);
        await closeTestInfrastructure();
    });

    it('allocates unique IDs, supports lookups, idempotent assign, and rollback semantics', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const { externalIntegerIdMappingCommandService, externalIntegerIdMappingQueryService } =
            createExternalIdMappingModule({ database: infra.database });

        const resourceA = randomUUID();
        const resourceB = randomUUID();
        const mappingA = await infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.ORDER,
                resourceId: resourceA,
            });
            return result.mapping;
        }, { tenantId: tenant.tenantId });

        const mappingB = await infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.ORDER,
                resourceId: resourceB,
            });
            return result.mapping;
        }, { tenantId: tenant.tenantId });

        expect(mappingA.externalId).toBe(1);
        expect(mappingB.externalId).toBe(2);
        expect(mappingA.externalId).not.toBe(mappingB.externalId);

        const replay = await infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.ORDER,
                resourceId: resourceA,
            });
            return result.mapping;
        }, { tenantId: tenant.tenantId });
        expect(replay.externalId).toBe(mappingA.externalId);

        const forward = await infra.database.execute(async (tx) => externalIntegerIdMappingQueryService.findResourceIdByExternalId(
            tenant.tenantId,
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            mappingA.externalId,
            tx,
        ), { tenantId: tenant.tenantId });
        expect(forward).toBe(resourceA);

        const reverse = await infra.database.execute(async (tx) => externalIntegerIdMappingQueryService.findExternalIdByResourceId(
            tenant.tenantId,
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            resourceB,
            tx,
        ), { tenantId: tenant.tenantId });
        expect(reverse).toBe(mappingB.externalId);

        const batch = await infra.database.execute(async (tx) => externalIntegerIdMappingQueryService.findExternalIdsByResourceIds(
            tenant.tenantId,
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            [resourceA, resourceB],
            tx,
        ), { tenantId: tenant.tenantId });
        expect(batch.get(resourceA)).toBe(mappingA.externalId);
        expect(batch.get(resourceB)).toBe(mappingB.externalId);

        const rolledBackResource = randomUUID();
        await expect(infra.database.execute(async (tx) => {
            await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.ORDER,
                resourceId: rolledBackResource,
            });
            throw new Error('force rollback');
        }, { tenantId: tenant.tenantId })).rejects.toThrow();

        const afterRollback = await infra.database.execute(async (tx) => externalIntegerIdMappingQueryService.findExternalIdByResourceId(
            tenant.tenantId,
            ExternalIdMappingProvider.COMPAT_V2,
            ExternalIdMappingResourceType.ORDER,
            rolledBackResource,
            tx,
        ), { tenantId: tenant.tenantId });
        expect(afterRollback).toBeNull();

        const afterRollbackId = await infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.ORDER,
                resourceId: rolledBackResource,
            });
            return result.mapping;
        }, { tenantId: tenant.tenantId });
        expect(afterRollbackId.externalId).toBe(3);

        await app.httpServer.close();
    });

    it('allows the same external integer for different resource types and rejects duplicate resource mappings', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const { externalIntegerIdMappingCommandService } =
            createExternalIdMappingModule({ database: infra.database });

        const orderId = randomUUID();
        const returnId = randomUUID();
        const orderMapping = await infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.ORDER,
                resourceId: orderId,
            });
            return result.mapping;
        }, { tenantId: tenant.tenantId });
        const returnMapping = await infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.RETURN,
                resourceId: returnId,
            });
            return result.mapping;
        }, { tenantId: tenant.tenantId });

        expect(orderMapping.externalId).toBe(returnMapping.externalId);

        await expect(infra.database.execute(async (tx) => tx.query(
            `INSERT INTO external_integer_id_mappings (
         id, tenant_id, provider, resource_type, resource_id, external_id
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                randomUUID(),
                tenant.tenantId,
                ExternalIdMappingProvider.COMPAT_V2,
                ExternalIdMappingResourceType.ORDER,
                randomUUID(),
                orderMapping.externalId,
            ],
            { operation: 'test.external_integer_id_mappings.duplicate_external' },
        ), { tenantId: tenant.tenantId })).rejects.toBeInstanceOf(ConflictError);

        await expect(infra.database.execute(async (tx) => tx.query(
            `INSERT INTO external_integer_id_mappings (
         id, tenant_id, provider, resource_type, resource_id, external_id
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                randomUUID(),
                tenant.tenantId,
                ExternalIdMappingProvider.COMPAT_V2,
                ExternalIdMappingResourceType.ORDER,
                orderId,
                orderMapping.externalId + 100,
            ],
            { operation: 'test.external_integer_id_mappings.duplicate_resource' },
        ), { tenantId: tenant.tenantId })).rejects.toBeInstanceOf(ConflictError);

        await app.httpServer.close();
    });

    it('allocates unique IDs under concurrent transactions', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const { externalIntegerIdMappingCommandService } =
            createExternalIdMappingModule({ database: infra.database });

        const resources = Array.from({ length: 8 }, () => randomUUID());
        const mappings = await Promise.all(resources.map((resourceId) => infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenant.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.SHIPMENT,
                resourceId,
            });
            return result.mapping;
        }, { tenantId: tenant.tenantId })));

        const externalIds = mappings.map((mapping) => mapping.externalId);
        expect(new Set(externalIds).size).toBe(externalIds.length);

        await app.httpServer.close();
    });

    it('enforces tenant RLS under the nexora_app runtime role', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const { externalIntegerIdMappingCommandService } =
            createExternalIdMappingModule({ database: infra.database });
        const resourceId = randomUUID();

        const mapping = await infra.database.execute(async (tx) => {
            const result = await externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: tenantA.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.CANCELLATION,
                resourceId,
            });
            return result.mapping;
        }, { tenantId: tenantA.tenantId });

        const ownTenant = await queryWithTenant(
            appRolePool,
            tenantA.tenantId,
            `SELECT external_id FROM external_integer_id_mappings WHERE resource_id = $1`,
            [resourceId],
        );
        expect(ownTenant.rowCount).toBe(1);
        expect(Number(ownTenant.rows[0]?.external_id)).toBe(mapping.externalId);

        const crossTenantRead = await queryWithTenant(
            appRolePool,
            tenantB.tenantId,
            `SELECT external_id FROM external_integer_id_mappings WHERE resource_id = $1`,
            [resourceId],
        );
        expect(crossTenantRead.rowCount).toBe(0);

        await expect(queryWithTenant(
            appRolePool,
            tenantB.tenantId,
            `INSERT INTO external_integer_id_mappings (
         id, tenant_id, provider, resource_type, resource_id, external_id
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                randomUUID(),
                tenantA.tenantId,
                ExternalIdMappingProvider.COMPAT_V2,
                ExternalIdMappingResourceType.CANCELLATION,
                randomUUID(),
                mapping.externalId + 500,
            ],
        )).rejects.toThrow(/row-level security/i);

        await app.httpServer.close();
    });
});
