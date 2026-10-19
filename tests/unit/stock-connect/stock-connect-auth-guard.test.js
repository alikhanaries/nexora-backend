import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/shared/context/request-context.js', () => ({
  enrichRequestContext: vi.fn(),
}));

vi.mock('../../../src/shared/auth/merchant-compat-route-prefix.js', () => ({
  isMerchantCompatQueryAuthPath: () => false,
}));

vi.mock('../../../src/shared/auth/read-merchant-compat-query-api-key.js', () => ({
  readMerchantCompatQueryApiKey: () => null,
  readMerchantCompatCeKeyHeader: () => null,
}));

vi.mock('../../../src/nest/common/auth/public-route.js', () => ({
  isPublicRoute: () => false,
}));

const { enrichRequestContext } = await import('../../../src/shared/context/request-context.js');
const { AuthGuard } = await import('../../../src/nest/common/guards/auth.guard.js');
const { AuthorizationError, AuthenticationError } = await import(
  '../../../src/shared/errors/index.js'
);

function createContext(headers = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        method: 'GET',
        path: '/api/v2/stock-connect/channels',
        url: '/api/v2/stock-connect/channels',
        query: {},
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

describe('AuthGuard StockConnect nxk_ bearer', () => {
  it('authenticates Bearer nxk_ as API key', async () => {
    const verifyApiKey = vi.fn().mockResolvedValue({
      apiKeyId: 'key-1',
      tenantId: 'tenant-a',
      permissions: ['channels.read'],
      scopes: ['channels.read'],
    });
    const guard = new AuthGuard(
      {
        verifyApiKey: { execute: verifyApiKey },
        authenticateAccessToken: { execute: vi.fn() },
        metrics: { recordAuthEvent: vi.fn() },
      },
      { get: () => false },
    );

    const ok = await guard.canActivate(
      createContext({ authorization: 'Bearer nxk_abcd1234.secretvalue' }),
    );
    expect(ok).toBe(true);
    expect(verifyApiKey).toHaveBeenCalledWith({
      rawKey: 'nxk_abcd1234.secretvalue',
    });
    expect(enrichRequestContext).toHaveBeenCalled();
  });

  it('rejects tenant mismatch on X-Tenant-Id', async () => {
    const guard = new AuthGuard(
      {
        verifyApiKey: {
          execute: vi.fn().mockResolvedValue({
            apiKeyId: 'key-1',
            tenantId: 'tenant-a',
            permissions: ['channels.read'],
            scopes: ['channels.read'],
          }),
        },
        authenticateAccessToken: { execute: vi.fn() },
        metrics: { recordAuthEvent: vi.fn() },
      },
      { get: () => false },
    );

    await expect(
      guard.canActivate(
        createContext({
          authorization: 'Bearer nxk_abcd1234.secretvalue',
          'x-tenant-id': 'tenant-b',
        }),
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('rejects missing credentials', async () => {
    const guard = new AuthGuard(
      {
        verifyApiKey: { execute: vi.fn() },
        authenticateAccessToken: { execute: vi.fn() },
        metrics: { recordAuthEvent: vi.fn() },
      },
      { get: () => false },
    );

    await expect(guard.canActivate(createContext({}))).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('does not treat non-nxk Bearer tokens as API keys', async () => {
    const authenticateAccessToken = vi.fn().mockResolvedValue({
      kind: 'user',
      id: 'user-1',
      tenantId: 'tenant-a',
      permissions: ['channels.read'],
      authenticationMethod: 'password',
    });
    const verifyApiKey = vi.fn();
    const guard = new AuthGuard(
      {
        verifyApiKey: { execute: verifyApiKey },
        authenticateAccessToken: { execute: authenticateAccessToken },
        metrics: { recordAuthEvent: vi.fn() },
      },
      { get: () => false },
    );

    await expect(
      guard.canActivate(createContext({ authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig' })),
    ).resolves.toBe(true);
    expect(authenticateAccessToken).toHaveBeenCalled();
    expect(verifyApiKey).not.toHaveBeenCalled();
  });

  it('accepts matching X-Tenant-Id with nxk_ bearer', async () => {
    const guard = new AuthGuard(
      {
        verifyApiKey: {
          execute: vi.fn().mockResolvedValue({
            apiKeyId: 'key-1',
            tenantId: 'tenant-a',
            permissions: ['channels.read'],
            scopes: ['channels.read'],
          }),
        },
        authenticateAccessToken: { execute: vi.fn() },
        metrics: { recordAuthEvent: vi.fn() },
      },
      { get: () => false },
    );

    await expect(
      guard.canActivate(
        createContext({
          authorization: 'Bearer nxk_abcd1234.secretvalue',
          'x-tenant-id': 'tenant-a',
        }),
      ),
    ).resolves.toBe(true);
  });
});
