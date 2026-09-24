import { describe, expect, it, vi } from 'vitest';
import { fulfillInventoryWhenShipmentShipped } from '../../../src/modules/shipments/application/fulfill-inventory-when-shipment-shipped.js';

describe('fulfillInventoryWhenShipmentShipped', () => {
    it('calls fulfillReservedForShipment for normal orders', async () => {
        const fulfillReservedForShipment = vi.fn().mockResolvedValue({ idempotent: false });
        const recordSale = vi.fn();
        const orderQueryService = {
            getOrderLines: vi.fn().mockResolvedValue([
                {
                    id: 'ol-1',
                    productId: 'prod-1',
                    stockLocationId: 'loc-1',
                },
            ]),
        };

        await fulfillInventoryWhenShipmentShipped({
            inventoryService: { fulfillReservedForShipment, recordSale },
            orderQueryService,
        }, {}, {
            tenantId: 'tenant-1',
            orderId: 'order-1',
            shipmentId: 'ship-1',
            shipmentLines: [{ id: 'sl-1', orderLineId: 'ol-1', quantity: 2 }],
        });

        expect(fulfillReservedForShipment).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            stockLocationId: 'loc-1',
            productId: 'prod-1',
            quantity: 2,
            orderId: 'order-1',
            shipmentId: 'ship-1',
            shipmentLineId: 'sl-1',
            orderLineId: 'ol-1',
        }, {});
        expect(recordSale).not.toHaveBeenCalled();
    });

    it('calls recordSale for channel-fulfilled mode', async () => {
        const fulfillReservedForShipment = vi.fn();
        const recordSale = vi.fn().mockResolvedValue({});
        const orderQueryService = {
            getOrderLines: vi.fn().mockResolvedValue([
                {
                    id: 'ol-1',
                    productId: 'prod-1',
                    stockLocationId: 'loc-1',
                },
            ]),
        };

        await fulfillInventoryWhenShipmentShipped({
            inventoryService: { fulfillReservedForShipment, recordSale },
            orderQueryService,
        }, {}, {
            tenantId: 'tenant-1',
            orderId: 'order-1',
            shipmentId: 'ship-1',
            inventoryConsumptionMode: 'record_sale_only',
            shipmentLines: [{ id: 'sl-1', orderLineId: 'ol-1', quantity: 3 }],
        });

        expect(recordSale).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            stockLocationId: 'loc-1',
            productId: 'prod-1',
            quantity: 3,
            referenceType: 'SHIPMENT',
            referenceId: 'ship-1',
            idempotencyKey: 'sl-1',
        }, {});
        expect(fulfillReservedForShipment).not.toHaveBeenCalled();
    });
});
