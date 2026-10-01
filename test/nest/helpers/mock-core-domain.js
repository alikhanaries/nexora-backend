import { jest } from '@jest/globals';
import { noopMetricsRecorder } from '../../../src/shared/metrics/index.js';

export function createMockCoreDomain(overrides = {}) {
  return {
    identity: {
      useCases: {
        login: { execute: jest.fn() },
        refreshToken: { execute: jest.fn() },
        logout: { execute: jest.fn() },
        getCurrentUser: { execute: jest.fn() },
      },
    },
    tenants: {
      useCases: {
        createTenant: { execute: jest.fn() },
        getTenant: { execute: jest.fn() },
        suspendTenant: { execute: jest.fn() },
        reactivateTenant: { execute: jest.fn() },
        closeTenant: { execute: jest.fn() },
      },
    },
    authorization: {
      routes: {
        options: {
          listPermissions: { execute: jest.fn().mockResolvedValue([]) },
          listRoles: { execute: jest.fn().mockResolvedValue([]) },
          createRole: { execute: jest.fn() },
          getEffectivePermissions: { execute: jest.fn() },
          assignRole: { execute: jest.fn() },
          removeRole: { execute: jest.fn() },
        },
      },
    },
    audit: {
      routes: {
        options: {
          auditService: {
            listEvents: jest.fn().mockResolvedValue({ total: 0, events: [] }),
          },
        },
      },
    },
    apiKeys: {
      useCases: {
        listApiKeys: { execute: jest.fn().mockResolvedValue([]) },
        createApiKey: { execute: jest.fn() },
        rotateApiKey: { execute: jest.fn() },
        revokeApiKey: { execute: jest.fn() },
        verifyApiKey: { execute: jest.fn() },
      },
    },
    mfa: {
      routes: {
        options: {
          startTotpEnrollment: { execute: jest.fn() },
          verifyTotpEnrollment: { execute: jest.fn() },
          activateTotpFactor: { execute: jest.fn() },
          verifyMfa: { execute: jest.fn() },
          useRecoveryCode: { execute: jest.fn() },
        },
      },
    },
    products: {
      useCases: {
        listProducts: { execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }) },
        createProduct: { execute: jest.fn() },
        getProduct: { execute: jest.fn() },
        updateProduct: { execute: jest.fn() },
        deactivateProduct: { execute: jest.fn() },
        archiveProduct: { execute: jest.fn() },
        getProductContent: { execute: jest.fn().mockResolvedValue({ content: [] }) },
        upsertProductContent: { execute: jest.fn() },
      },
    },
    pricing: {
      useCases: {
        listPrices: { execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }) },
        createPrice: { execute: jest.fn() },
        getPrice: { execute: jest.fn() },
        updatePrice: { execute: jest.fn() },
        deactivatePrice: { execute: jest.fn() },
      },
    },
    offers: {
      useCases: {
        listOffers: { execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }) },
        createOffer: { execute: jest.fn() },
        getOffer: { execute: jest.fn() },
        updateOffer: { execute: jest.fn() },
        activateOffer: { execute: jest.fn() },
        suspendOffer: { execute: jest.fn() },
        deactivateOffer: { execute: jest.fn() },
      },
    },
    channelRouteDeps: {
      listChannels: { execute: jest.fn().mockResolvedValue({ channels: [] }) },
      createChannel: { execute: jest.fn() },
      getChannel: { execute: jest.fn() },
      updateChannel: { execute: jest.fn() },
      activateChannel: { execute: jest.fn() },
      deactivateChannel: { execute: jest.fn() },
      suspendChannel: { execute: jest.fn() },
      upsertMarketplaceConnection: { execute: jest.fn() },
      getMarketplaceConnection: { execute: jest.fn() },
      patchMarketplaceConnection: { execute: jest.fn() },
      deleteMarketplaceConnection: { execute: jest.fn() },
      testMarketplaceConnection: { execute: jest.fn() },
    },
    marketplaces: {
      useCases: {
        listMarketplaces: { execute: jest.fn().mockResolvedValue({ marketplaces: [] }) },
        createMarketplace: { execute: jest.fn() },
        getMarketplace: { execute: jest.fn() },
        updateMarketplace: { execute: jest.fn() },
        activateMarketplace: { execute: jest.fn() },
        deactivateMarketplace: { execute: jest.fn() },
      },
    },
    inventory: {
      useCases: {
        listStockLocations: { execute: jest.fn().mockResolvedValue({ locations: [] }) },
        createStockLocation: { execute: jest.fn() },
        getStockLocation: { execute: jest.fn() },
        getInventory: { execute: jest.fn().mockResolvedValue({ balances: [] }) },
        adjustInventory: { execute: jest.fn() },
        receiveInventory: { execute: jest.fn() },
        reserveInventory: { execute: jest.fn() },
        releaseInventory: { execute: jest.fn() },
      },
    },
    orders: {
      useCases: {
        createOrder: { execute: jest.fn() },
        listOrders: {
          execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
        },
        getOrder: { execute: jest.fn() },
        confirmOrder: { execute: jest.fn() },
        idempotency: {
          execute: jest.fn(async (_key, _fp, operation) => {
            const value = await operation({});
            return { kind: 'executed', value };
          }),
        },
      },
    },
    cancellations: {
      useCases: {
        listCancellations: {
          execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
        },
        createCancellation: { execute: jest.fn() },
        getCancellation: { execute: jest.fn() },
        idempotency: {
          execute: jest.fn(async (_key, _fp, operation) => {
            const value = await operation({});
            return { kind: 'executed', value };
          }),
        },
      },
    },
    shipments: {
      useCases: {
        createShipment: { execute: jest.fn() },
        listShipments: {
          execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
        },
        getShipment: { execute: jest.fn() },
        shipShipment: { execute: jest.fn() },
        deliverShipment: { execute: jest.fn() },
        cancelShipment: { execute: jest.fn() },
        idempotency: {
          execute: jest.fn(async (_key, _fp, operation) => {
            const value = await operation({});
            return { kind: 'executed', value };
          }),
        },
      },
    },
    returns: {
      useCases: {
        createReturn: { execute: jest.fn() },
        listReturns: {
          execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
        },
        getReturn: { execute: jest.fn() },
        approveReturn: { execute: jest.fn() },
        receiveReturn: { execute: jest.fn() },
        completeReturn: { execute: jest.fn() },
        rejectReturn: { execute: jest.fn() },
        cancelReturn: { execute: jest.fn() },
        idempotency: {
          execute: jest.fn(async (_key, _fp, operation) => {
            const value = await operation({});
            return { kind: 'executed', value };
          }),
        },
      },
    },
    compatibility: {
      routeDeps: {
        rateLimiter: {
          consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
        },
        orderCompatibilityQuery: {
          listOrders: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
          listNewOrders: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
        },
        orderCompatibilityCommand: {
          createChannelOrder: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 201,
            Content: { MerchantOrderNo: 'ORD-1' },
          }),
          createChannelFulfilledOrder: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 201,
            Content: { MerchantOrderNo: 'ORD-2' },
          }),
          acknowledgeOrder: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 201,
            Content: { MerchantOrderNo: 'ORD-1' },
          }),
        },
        stockConnectCeOrderCompatibilityQuery: {
          listOrdersForStockConnectPoll: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
        },
        stockConnectCeOrderInvoiceQuery: {
          getOrderInvoice: jest.fn().mockResolvedValue({
            contentType: 'application/pdf',
            body: Buffer.from('%PDF'),
          }),
        },
        shipmentCompatibilityQuery: {
          listMerchantShipments: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
        },
        shipmentCompatibilityCommand: {
          createShipment: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 201,
            Content: { MerchantShipmentNo: 'SHP-1' },
          }),
          updateShipmentTracking: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: { MerchantShipmentNo: 'SHP-1' },
          }),
        },
        cancellationCompatibilityQuery: {
          listMerchantCancellations: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
        },
        cancellationCompatibilityCommand: {
          createCancellation: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 201,
            Content: { MerchantCancellationNo: 'CAN-1' },
          }),
        },
        returnCompatibilityQuery: {
          listNewMerchantReturns: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
          listReturnsByMerchantOrderNo: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
          }),
          listMerchantReturns: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
        },
        returnCompatibilityCommand: {
          receiveReturn: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: { MerchantReturnNo: 'RET-1' },
          }),
          acknowledgeReturn: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: { MerchantReturnNo: 'RET-1' },
          }),
          createReturn: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 201,
            Content: { MerchantReturnNo: 'RET-1' },
          }),
        },
        catalogCompatibilityQuery: {
          listProductsByMerchantProductNos: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
          }),
        },
        catalogCompatibilityCommand: {
          upsertProducts: jest.fn().mockResolvedValue({
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: [],
          }),
          freezeProducts: jest.fn().mockResolvedValue({
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: [],
          }),
          bulkDeleteProducts: jest.fn().mockResolvedValue({
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: [],
          }),
          patchExtraDataBulk: jest.fn().mockResolvedValue({
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: [],
          }),
          updateOfferPrice: jest.fn().mockResolvedValue({
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: [],
          }),
          updateOfferStock: jest.fn().mockResolvedValue({
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: [],
          }),
        },
        stockConnectCeProductsQuery: {
          listProductsByMerchantProductNos: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
          }),
        },
        stockConnectCeChannelProductsQuery: {
          listChannelProducts: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
        },
        stockConnectCeChannelCompatibilityQuery: {
          listChannels: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 50,
          }),
        },
        stockConnectCeCatalogCommand: {
          pushProducts: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Message: null,
          }),
          updateOfferStock: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Message: null,
          }),
          updateOfferPrice: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Message: null,
          }),
          freezeProducts: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Message: null,
          }),
          bulkDeleteProducts: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Message: null,
          }),
          patchExtraData: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Message: null,
          }),
        },
        stockConnectCeShipmentDeliveryCommand: {
          updateDeliveryState: jest.fn().mockResolvedValue({
            Success: true,
            StatusCode: 200,
            Message: null,
          }),
        },
      },
    },
    marketplaceWebhookIngestion: {
      receiveMarketplaceWebhook: {
        execute: jest.fn().mockResolvedValue({
          data: { outcome: 'enqueued', externalOrderReference: 'order-1' },
          replayed: false,
        }),
      },
    },
    authenticateAccessToken: { execute: jest.fn() },
    verifyApiKey: { execute: jest.fn() },
    metrics: noopMetricsRecorder,
    ...overrides,
  };
}
