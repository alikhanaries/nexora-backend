import { describe, expect, it, vi } from 'vitest';
import { BusinessRuleError } from '../../../src/shared/errors/index.js';
import { createDefaultInventoryService } from '../../../src/modules/inventory/services/default-inventory-service.js';
import { ReservationStatus } from '../../../src/modules/inventory/models/reservation-status.js';
import { StockLocationStatus } from '../../../src/modules/inventory/models/stock-location-status.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const LOCATION = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';
const RESERVATION_ID = '44444444-4444-4444-8444-444444444444';
const BALANCE_ID = '55555555-5555-4555-8555-555555555555';

function activeLocation() {
    return {
        id: LOCATION,
        tenantId: TENANT,
        name: 'Main',
        externalReference: null,
        status: StockLocationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function balanceSnapshot(overrides = {}) {
    return {
        id: BALANCE_ID,
        tenantId: TENANT,
        stockLocationId: LOCATION,
        productId: PRODUCT,
        onHand: 10,
        reserved: 2,
        available: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function createService(overrides = {}) {
    const tx = { id: 'tx-1' };
    const inventoryRepository = {
        insertReservation: vi.fn(),
        lockBalanceForUpdate: vi.fn(),
        updateBalance: vi.fn(),
        insertMovement: vi.fn().mockResolvedValue(true),
        findReservationByReference: vi.fn(),
        markReservationReleased: vi.fn(),
        ...overrides.inventoryRepository,
    };
    const stockLocationRepository = {
        findById: vi.fn().mockResolvedValue(activeLocation()),
        ...overrides.stockLocationRepository,
    };
    const productQueryService = {
        verifyProductBelongsToTenant: vi.fn().mockResolvedValue(true),
        ...overrides.productQueryService,
    };
    const eventRecorder = {
        record: vi.fn().mockResolvedValue(undefined),
    };
    const service = createDefaultInventoryService({
        transactionManager: {
            execute: async (work) => work(tx),
        },
        queryable: {},
        inventoryRepository,
        stockLocationRepository,
        productQueryService,
        eventRecorder,
    });
    return { service, tx, inventoryRepository, stockLocationRepository, productQueryService, eventRecorder };
}

describe('DefaultInventoryService reserve', () => {
    it('locks balance after inserting a new reservation', async () => {
        const callOrder = [];
        const { service, tx, inventoryRepository } = createService({
            inventoryRepository: {
                insertReservation: vi.fn().mockImplementation(async () => {
                    callOrder.push('insertReservation');
                    return {
                        inserted: true,
                        reservation: {
                            id: RESERVATION_ID,
                            tenantId: TENANT,
                            stockLocationId: LOCATION,
                            productId: PRODUCT,
                            referenceType: 'ORDER',
                            referenceId: 'order-1',
                            quantity: 3,
                            status: ReservationStatus.ACTIVE,
                            createdAt: new Date(),
                            releasedAt: null,
                        },
                    };
                }),
                lockBalanceForUpdate: vi.fn().mockImplementation(async () => {
                    callOrder.push('lockBalanceForUpdate');
                    return balanceSnapshot();
                }),
            },
        });

        const result = await service.reserve({
            tenantId: TENANT,
            stockLocationId: LOCATION,
            productId: PRODUCT,
            quantity: 3,
            referenceType: 'ORDER',
            referenceId: 'order-1',
        });

        expect(callOrder).toEqual(['insertReservation', 'lockBalanceForUpdate']);
        expect(inventoryRepository.updateBalance).toHaveBeenCalledWith(
            tx,
            BALANCE_ID,
            { onHand: 10, reserved: 5, available: 5 },
            expect.any(Date),
        );
        expect(result.idempotent).toBe(false);
        expect(result.reservationId).toBe(RESERVATION_ID);
    });

    it('returns idempotent result when reservation reference already exists with same quantity', async () => {
        const { service, inventoryRepository } = createService({
            inventoryRepository: {
                insertReservation: vi.fn().mockResolvedValue({
                    inserted: false,
                    reservation: {
                        id: RESERVATION_ID,
                        tenantId: TENANT,
                        stockLocationId: LOCATION,
                        productId: PRODUCT,
                        referenceType: 'ORDER',
                        referenceId: 'order-1',
                        quantity: 3,
                        status: ReservationStatus.ACTIVE,
                        createdAt: new Date(),
                        releasedAt: null,
                    },
                }),
                lockBalanceForUpdate: vi.fn().mockResolvedValue(balanceSnapshot()),
            },
        });

        const result = await service.reserve({
            tenantId: TENANT,
            stockLocationId: LOCATION,
            productId: PRODUCT,
            quantity: 3,
            referenceType: 'ORDER',
            referenceId: 'order-1',
        });

        expect(result.idempotent).toBe(true);
        expect(inventoryRepository.updateBalance).not.toHaveBeenCalled();
    });

    it('rejects reserve when available stock is insufficient', async () => {
        const { service } = createService({
            inventoryRepository: {
                insertReservation: vi.fn().mockResolvedValue({
                    inserted: true,
                    reservation: {
                        id: RESERVATION_ID,
                        tenantId: TENANT,
                        stockLocationId: LOCATION,
                        productId: PRODUCT,
                        referenceType: 'ORDER',
                        referenceId: 'order-1',
                        quantity: 9,
                        status: ReservationStatus.ACTIVE,
                        createdAt: new Date(),
                        releasedAt: null,
                    },
                }),
                lockBalanceForUpdate: vi.fn().mockResolvedValue(balanceSnapshot({ available: 2 })),
            },
        });

        await expect(service.reserve({
            tenantId: TENANT,
            stockLocationId: LOCATION,
            productId: PRODUCT,
            quantity: 9,
            referenceType: 'ORDER',
            referenceId: 'order-1',
        })).rejects.toBeInstanceOf(BusinessRuleError);
    });
});

describe('DefaultInventoryService release', () => {
    it('locks balance before updating reservation and quantities', async () => {
        const callOrder = [];
        const { service, tx, inventoryRepository } = createService({
            inventoryRepository: {
                findReservationByReference: vi.fn().mockImplementation(async () => {
                    callOrder.push('findReservationByReference');
                    return {
                        id: RESERVATION_ID,
                        tenantId: TENANT,
                        stockLocationId: LOCATION,
                        productId: PRODUCT,
                        referenceType: 'ORDER',
                        referenceId: 'order-1',
                        quantity: 4,
                        status: ReservationStatus.ACTIVE,
                        createdAt: new Date(),
                        releasedAt: null,
                    };
                }),
                lockBalanceForUpdate: vi.fn().mockImplementation(async () => {
                    callOrder.push('lockBalanceForUpdate');
                    return balanceSnapshot({ reserved: 4, available: 6 });
                }),
                markReservationReleased: vi.fn().mockImplementation(async () => {
                    callOrder.push('markReservationReleased');
                }),
            },
        });

        const result = await service.release({
            tenantId: TENANT,
            stockLocationId: LOCATION,
            productId: PRODUCT,
            referenceType: 'ORDER',
            referenceId: 'order-1',
        });

        expect(callOrder.indexOf('findReservationByReference')).toBeLessThan(callOrder.indexOf('lockBalanceForUpdate'));
        expect(callOrder.indexOf('lockBalanceForUpdate')).toBeLessThan(callOrder.indexOf('markReservationReleased'));
        expect(inventoryRepository.updateBalance).toHaveBeenCalledWith(
            tx,
            BALANCE_ID,
            { onHand: 10, reserved: 0, available: 10 },
            expect.any(Date),
        );
        expect(result.idempotent).toBe(false);
    });

    it('returns idempotent release when reservation is already released', async () => {
        const { service, inventoryRepository } = createService({
            inventoryRepository: {
                findReservationByReference: vi.fn().mockResolvedValue({
                    id: RESERVATION_ID,
                    tenantId: TENANT,
                    stockLocationId: LOCATION,
                    productId: PRODUCT,
                    referenceType: 'ORDER',
                    referenceId: 'order-1',
                    quantity: 4,
                    status: ReservationStatus.RELEASED,
                    createdAt: new Date(),
                    releasedAt: new Date(),
                }),
                lockBalanceForUpdate: vi.fn().mockResolvedValue(balanceSnapshot()),
            },
        });

        const result = await service.release({
            tenantId: TENANT,
            stockLocationId: LOCATION,
            productId: PRODUCT,
            referenceType: 'ORDER',
            referenceId: 'order-1',
        });

        expect(result.idempotent).toBe(true);
        expect(inventoryRepository.updateBalance).not.toHaveBeenCalled();
        expect(inventoryRepository.markReservationReleased).not.toHaveBeenCalled();
    });
});
