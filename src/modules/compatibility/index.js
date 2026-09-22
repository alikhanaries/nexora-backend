import { CancellationCompatibilityCommand } from './application/cancellation-compatibility-command.js';
import { CancellationCompatibilityQuery } from './application/cancellation-compatibility-query.js';
import { ReturnCompatibilityCommand } from './application/return-compatibility-command.js';
import { ReturnCompatibilityQuery } from './application/return-compatibility-query.js';
import { OrderCompatibilityCommand } from './application/order-compatibility-command.js';
import { OrderCompatibilityQuery } from './application/order-compatibility-query.js';
import { ShipmentCompatibilityCommand } from './application/shipment-compatibility-command.js';
import { ShipmentCompatibilityQuery } from './application/shipment-compatibility-query.js';
import compatibilityRoutes from './presentation/compatibility.routes.js';

/**
 * @param {object} deps
 * @param {import('./application/core-contracts.js').CompatibilityCoreContracts} deps.coreContracts
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 */
export function createCompatibilityModule(deps) {
    const orderCompatibilityQuery = new OrderCompatibilityQuery({
        orderQueryService: deps.coreContracts.orderQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
    });
    const orderCompatibilityCommand = new OrderCompatibilityCommand({
        orderCommandService: deps.coreContracts.orderCommandService,
        channelQueryService: deps.coreContracts.channelQueryService,
    });
    const shipmentCompatibilityCommand = new ShipmentCompatibilityCommand({
        orderQueryService: deps.coreContracts.orderQueryService,
        shipmentCommandService: deps.coreContracts.shipmentCommandService,
    });
    const cancellationCompatibilityCommand = new CancellationCompatibilityCommand({
        orderQueryService: deps.coreContracts.orderQueryService,
        cancellationCommandService: deps.coreContracts.cancellationCommandService,
    });
    const returnCompatibilityCommand = new ReturnCompatibilityCommand({
        orderQueryService: deps.coreContracts.orderQueryService,
        returnQueryService: deps.coreContracts.returnQueryService,
        returnCommandService: deps.coreContracts.returnCommandService,
    });
    const shipmentCompatibilityQuery = new ShipmentCompatibilityQuery({
        shipmentQueryService: deps.coreContracts.shipmentQueryService,
        orderQueryService: deps.coreContracts.orderQueryService,
    });
    const cancellationCompatibilityQuery = new CancellationCompatibilityQuery({
        cancellationQueryService: deps.coreContracts.cancellationQueryService,
        orderQueryService: deps.coreContracts.orderQueryService,
    });
    const returnCompatibilityQuery = new ReturnCompatibilityQuery({
        returnQueryService: deps.coreContracts.returnQueryService,
        orderQueryService: deps.coreContracts.orderQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
    });
    return {
        routes: compatibilityRoutes,
        routeDeps: {
            orderCompatibilityQuery,
            orderCompatibilityCommand,
            shipmentCompatibilityCommand,
            shipmentCompatibilityQuery,
            cancellationCompatibilityCommand,
            cancellationCompatibilityQuery,
            returnCompatibilityCommand,
            returnCompatibilityQuery,
            rateLimiter: deps.rateLimiter,
        },
        coreContracts: deps.coreContracts,
    };
}
