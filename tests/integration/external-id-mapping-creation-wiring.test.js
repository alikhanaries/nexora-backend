import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { createExternalIdMappingModule } from '../../src/modules/external-id-mapping/index.js';
import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../src/modules/external-id-mapping/public/index.js';
import { ValidationError } from '../../src/shared/errors/index.js';
import {
    authHeaders,
    createAuthenticatedUser,
    createTestTenant,
} from './auth-helpers.js';
import {
    cancellationHeaders,
    cancellationPayload,
    channelOrderHeaders,
    channelOrderPayload,
    configureChannelForIngest,
    createOrder,
    returnHeaders,
    returnPayload,
    seedCommerceFixture,
    shipOrderQuantity,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const FULFILLED_URL = '/api/v2/orders/channel-fulfilled';

async function findExternalId(queryService, tenantId, resourceType, resourceId) {
    return queryService.findExternalIdByResourceId(
        tenantId,
        ExternalIdMappingProvider.COMPAT_V2,
        resourceType,
        resourceId,
    );
}

async function countMappingsForResource(database, tenantId, resourceId) {
    const result = await database.execute(async (tx) => tx.query(
        `SELECT COUNT(*)::int AS count
     FROM external_integer_id_mappings
     WHERE tenant_id = $1 AND resource_id = $2`,
        [tenantId, resourceId],
        { operation: 'test.count_external_integer_id_mappings' },
    ), { tenantId });
    return result.rows[0]?.count ?? 0;
}

describe('external integer ID mapping creation wiring', () => {
    let app;
    let server;
    /** @type {import('../../src/modules/external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} */
    let queryService;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
        queryService = createExternalIdMappingModule({ database: infra.database })
            .externalIntegerIdMappingQueryService;
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    it('assigns mappings for native order creation and order lines', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `native-${Date.now()}`, 2);

        const orderExternalId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        expect(orderExternalId).toBeGreaterThan(0);

        expect(order.lines).toHaveLength(1);
        const lineExternalId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER_LINE,
            order.lines[0].id,
        );
        expect(lineExternalId).toBeGreaterThan(0);
    });

    it('assigns mappings for channel order creation', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const owner = await createAuthenticatedUser(app, tenantId, slug);
        const ownerHeaders = authHeaders(owner.accessToken);
        const fixture = await seedCommerceFixture(server, ownerHeaders);
        const channelContext = await configureChannelForIngest(
            server,
            ownerHeaders,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const merchantOrderNo = `CH-MAP-${Date.now()}`;

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(
                ownerHeaders,
                `channel-map-${Date.now()}`,
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, merchantOrderNo),
        });
        expect(response.statusCode).toBe(201);

        const orderId = await app.infra.database.execute(async (tx) => {
            const result = await tx.query(
                `SELECT id FROM orders
         WHERE tenant_id = $1 AND external_order_reference = $2`,
                [tenantId, merchantOrderNo],
                { operation: 'test.find_channel_order' },
            );
            return result.rows[0]?.id;
        }, { tenantId });
        expect(orderId).toBeDefined();

        const orderExternalId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderId,
        );
        expect(orderExternalId).toBeGreaterThan(0);

        const lines = await app.infra.database.execute(async (tx) => tx.query(
            `SELECT id FROM order_lines WHERE tenant_id = $1 AND order_id = $2`,
            [tenantId, orderId],
            { operation: 'test.find_channel_order_lines' },
        ), { tenantId });
        expect(lines.rowCount).toBeGreaterThan(0);
        for (const row of lines.rows) {
            const lineExternalId = await findExternalId(
                queryService,
                tenantId,
                ExternalIdMappingResourceType.ORDER_LINE,
                row.id,
            );
            expect(lineExternalId).toBeGreaterThan(0);
        }
    });

    it('assigns mappings for channel-fulfilled order creation including shipment', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const owner = await createAuthenticatedUser(app, tenantId, slug);
        const ownerHeaders = authHeaders(owner.accessToken);
        const fixture = await seedCommerceFixture(server, ownerHeaders);
        const channelContext = await configureChannelForIngest(
            server,
            ownerHeaders,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const merchantOrderNo = `CH-FUL-MAP-${Date.now()}`;

        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(
                ownerHeaders,
                `channel-fulfilled-map-${Date.now()}`,
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, merchantOrderNo),
        });
        expect(response.statusCode).toBe(201);

        const orderId = await app.infra.database.execute(async (tx) => {
            const result = await tx.query(
                `SELECT id FROM orders
         WHERE tenant_id = $1 AND external_order_reference = $2`,
                [tenantId, merchantOrderNo],
                { operation: 'test.find_fulfilled_order' },
            );
            return result.rows[0]?.id;
        }, { tenantId });
        expect(orderId).toBeDefined();

        const orderExternalId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderId,
        );
        expect(orderExternalId).toBeGreaterThan(0);

        const shipment = await app.infra.database.execute(async (tx) => {
            const result = await tx.query(
                `SELECT id FROM shipments WHERE tenant_id = $1 AND order_id = $2 LIMIT 1`,
                [tenantId, orderId],
                { operation: 'test.find_fulfilled_shipment' },
            );
            return result.rows[0];
        }, { tenantId });
        expect(shipment).toBeDefined();

        const shipmentExternalId = await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.SHIPMENT,
            shipment.id,
        );
        expect(shipmentExternalId).toBeGreaterThan(0);
    });

    it('assigns mappings for shipment, cancellation, and return creation', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `lifecycle-${Date.now()}`, 4);
        const orderLineId = order.lines[0].id;

        await shipOrderQuantity(server, headers, order.id, orderLineId, 2, `ship-${Date.now()}`);
        const shipmentRow = await app.infra.database.execute(async (tx) => {
            const result = await tx.query(
                `SELECT id FROM shipments WHERE tenant_id = $1 AND order_id = $2 LIMIT 1`,
                [tenantId, order.id],
                { operation: 'test.find_native_shipment' },
            );
            return result.rows[0];
        }, { tenantId });
        expect(shipmentRow).toBeDefined();
        expect(await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.SHIPMENT,
            shipmentRow.id,
        )).toBeGreaterThan(0);

        const merchantCancellationNo = `CAN-MAP-${Date.now()}`;
        const cancellationRes = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, `cancel-map-${Date.now()}`),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, merchantCancellationNo),
        });
        expect(cancellationRes.statusCode).toBe(201);
        const cancellationId = await app.infra.database.execute(async (tx) => {
            const result = await tx.query(
                `SELECT id FROM cancellations
         WHERE tenant_id = $1 AND external_reference = $2`,
                [tenantId, merchantCancellationNo],
                { operation: 'test.find_cancellation' },
            );
            return result.rows[0]?.id;
        }, { tenantId });
        expect(await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.CANCELLATION,
            cancellationId,
        )).toBeGreaterThan(0);

        const merchantReturnNo = `RET-MAP-${Date.now()}`;
        const returnRes = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, `return-map-${Date.now()}`),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, merchantReturnNo),
        });
        expect(returnRes.statusCode).toBe(201);
        const returnId = await app.infra.database.execute(async (tx) => {
            const result = await tx.query(
                `SELECT id FROM returns
         WHERE tenant_id = $1 AND external_reference = $2`,
                [tenantId, merchantReturnNo],
                { operation: 'test.find_return' },
            );
            return result.rows[0]?.id;
        }, { tenantId });
        expect(await findExternalId(
            queryService,
            tenantId,
            ExternalIdMappingResourceType.RETURN,
            returnId,
        )).toBeGreaterThan(0);
    });

    it('rolls back resource creation when external ID assignment fails', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const original = app.orders.createOrder.deps.externalIntegerIdMappingCommandService;
        app.orders.createOrder.deps.externalIntegerIdMappingCommandService = {
            assignMapping: async (transaction, command) => {
                if (command.resourceType === ExternalIdMappingResourceType.ORDER_LINE) {
                    throw new ValidationError('Simulated mapping failure');
                }
                return original.assignMapping(transaction, command);
            },
        };

        const roles = await app.authorization.useCases.listRoles.execute({
            tenantId,
            actorPermissions: ['tenant.admin', 'roles.read'],
        });
        const ownerRole = roles.find((role) => role.systemKey === 'owner');
        expect(ownerRole).toBeDefined();

        const merchantOrderNo = `rollback-${Date.now()}`;
        try {
            await expect(app.orders.createOrder.execute({
                tenantId,
                actorId: user.userId,
                actorKind: 'user',
                actorPermissions: ownerRole.permissionKeys,
                channelId: fixture.channelId,
                currency: 'USD',
                externalOrderReference: merchantOrderNo,
                lines: [{
                    productId: fixture.productId,
                    stockLocationId: fixture.stockLocationId,
                    quantity: 1,
                }],
            })).rejects.toThrow(ValidationError);

            const orderCount = await app.infra.database.execute(async (tx) => tx.query(
                `SELECT COUNT(*)::int AS count FROM orders
         WHERE tenant_id = $1 AND external_order_reference = $2`,
                [tenantId, merchantOrderNo],
                { operation: 'test.count_orders_after_failed_mapping' },
            ), { tenantId });
            expect(orderCount.rows[0]?.count).toBe(0);
        }
        finally {
            app.orders.createOrder.deps.externalIntegerIdMappingCommandService = original;
        }
    });

    it('does not create duplicate mappings on idempotent order replay', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const idempotencyKey = `order-map-idem-${Date.now()}`;
        const payload = {
            channelId: fixture.channelId,
            currency: 'USD',
            externalOrderReference: `idem-${Date.now()}`,
            lines: [{
                productId: fixture.productId,
                stockLocationId: fixture.stockLocationId,
                quantity: 1,
            }],
        };

        const first = await server.inject({
            method: 'POST',
            url: '/api/v1/orders',
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        expect(first.statusCode).toBe(201);
        const orderId = first.json().data.id;

        const mappingCountBefore = await countMappingsForResource(app.infra.database, tenantId, orderId);
        expect(mappingCountBefore).toBe(1);

        const replay = await server.inject({
            method: 'POST',
            url: '/api/v1/orders',
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        expect(replay.statusCode).toBe(201);
        expect(replay.json().data.id).toBe(orderId);

        const mappingCountAfter = await countMappingsForResource(app.infra.database, tenantId, orderId);
        expect(mappingCountAfter).toBe(1);
    });

    it('keeps mappings tenant-scoped after resource creation', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const headersA = authHeaders(userA.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const order = await createOrder(server, headersA, fixtureA, `tenant-a-${Date.now()}`, 1);

        const tenantAExternalId = await findExternalId(
            queryService,
            tenantA.tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        expect(tenantAExternalId).toBeGreaterThan(0);

        const crossTenantLookup = await findExternalId(
            queryService,
            tenantB.tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        expect(crossTenantLookup).toBeNull();
    });
});
