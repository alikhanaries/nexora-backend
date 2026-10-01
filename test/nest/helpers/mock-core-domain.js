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
    authenticateAccessToken: { execute: jest.fn() },
    verifyApiKey: { execute: jest.fn() },
    metrics: noopMetricsRecorder,
    ...overrides,
  };
}
