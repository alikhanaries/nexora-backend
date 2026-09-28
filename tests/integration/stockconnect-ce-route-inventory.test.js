import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const REQUIRED_CE_ROUTES = [
    'GET /api/v2/ce/orders',
    'POST /api/v2/ce/orders/acknowledge',
    'POST /api/v2/ce/cancellations',
    'POST /api/v2/ce/shipments',
    'GET /api/v2/ce/shipments/merchant',
    'PUT /api/v2/ce/shipments/:merchantShipmentNo/delivery-state',
    'GET /api/v2/ce/returns',
    'POST /api/v2/ce/returns/merchant',
    'POST /api/v2/ce/returns/merchant/acknowledge',
    'PUT /api/v2/ce/returns',
    'GET /api/v2/ce/products',
    'POST /api/v2/ce/products',
    'POST /api/v2/ce/products/freeze',
    'POST /api/v2/ce/products/bulkdelete',
    'PATCH /api/v2/ce/products/extra-data/bulk',
    'PUT /api/v2/ce/offer',
    'PUT /api/v2/ce/offer/stock',
    'GET /api/v2/ce/channels',
    'GET /api/v2/ce/channels/:channelId/products',
    'GET /api/v2/ce/orders/:merchantOrderNo/invoice',
];

describe('StockConnect CE route inventory (Phase 49)', () => {
    let app;
    let server;
    let routeSource;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
        const thisDir = dirname(fileURLToPath(import.meta.url));
        routeSource = readFileSync(
            join(thisDir, '../../src/modules/compatibility/presentation/stockconnect-ce.routes.js'),
            'utf8',
        );
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('registers every StockConnect-required CE route in source', () => {
        for (const route of REQUIRED_CE_ROUTES) {
            const [method, path] = route.split(' ');
            expect(routeSource).toContain(`typed.${method.toLowerCase()}('${path}'`);
        }
    });

    it('mounts StockConnect CE routes on the application instance', () => {
        expect(app.compatibility.routeDeps.stockConnectCeOrderInvoiceQuery).toBeDefined();
        expect(app.compatibility.routeDeps.stockConnectCeProductsQuery).toBeDefined();
        expect(app.compatibility.routeDeps.stockConnectCeChannelProductsQuery).toBeDefined();
    });
});
