import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApplication } from '../../src/app/create-application.js';
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

const CONTROLLER_FILES = [
    'compat-v2.controller.js',
    'compat-v2-orders.controller.js',
];

describe('StockConnect CE route inventory (Phase 50)', () => {
    let app;
    let routeSource;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        await app.httpServer.ready();
        const thisDir = dirname(fileURLToPath(import.meta.url));
        const nestDir = join(thisDir, '../../src/modules/compatibility/controllers/nest');
        routeSource = CONTROLLER_FILES.map((name) =>
            readFileSync(join(nestDir, name), 'utf8'),
        ).join('\n');
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('registers every StockConnect-required CE route in Nest controllers', () => {
        for (const route of REQUIRED_CE_ROUTES) {
            const [, path] = route.split(' ');
            expect(routeSource, `missing ${route}`).toContain(`'${path}'`);
        }
    });

    it('mounts StockConnect CE route dependencies on the application', () => {
        expect(app.compatibility.routeDeps.compatV2OrderInvoiceQuery).toBeDefined();
        expect(app.compatibility.routeDeps.compatV2ProductsQuery).toBeDefined();
        expect(app.compatibility.routeDeps.compatV2IntegrationProductsQuery).toBeDefined();
    });
});
