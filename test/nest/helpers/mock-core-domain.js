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
    authenticateAccessToken: { execute: jest.fn() },
    verifyApiKey: { execute: jest.fn() },
    metrics: noopMetricsRecorder,
    ...overrides,
  };
}
