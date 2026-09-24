export const AUTH_RATE_LIMIT_POLICIES = {
    login: { name: 'auth.login', limit: 10, windowSeconds: 900 },
    refresh: { name: 'auth.refresh', limit: 30, windowSeconds: 900 },
    passwordResetRequest: {
        name: 'auth.password-reset',
        limit: 5,
        windowSeconds: 3600,
    },
    passwordResetConfirm: {
        name: 'auth.password-reset-confirm',
        limit: 10,
        windowSeconds: 3600,
    },
    mfaVerify: { name: 'auth.mfa', limit: 10, windowSeconds: 900 },
    apiKeyCreate: {
        name: 'api-key.create',
        limit: 10,
        windowSeconds: 3600,
    },
    apiKeyRotate: {
        name: 'api-key.rotate',
        limit: 10,
        windowSeconds: 3600,
    },
    webhookCreate: {
        name: 'webhook.create',
        limit: 20,
        windowSeconds: 3600,
    },
    webhookManage: {
        name: 'webhook.manage',
        limit: 60,
        windowSeconds: 3600,
    },
    webhookRead: {
        name: 'webhook.read',
        limit: 120,
        windowSeconds: 60,
    },
    catalogSync: {
        name: 'catalog-sync',
        limit: 120,
        windowSeconds: 60,
    },
    webhookSecretRotate: {
        name: 'webhook.secret-rotate',
        limit: 5,
        windowSeconds: 3600,
    },
};

export const CATALOG_SYNC_RATE_LIMIT_POLICY = AUTH_RATE_LIMIT_POLICIES.catalogSync;

/** Provider-neutral rate limits for the `/api/v2` compatibility surface. */
export const COMPATIBILITY_RATE_LIMIT_POLICIES = {
    read: {
        name: 'compatibility.read',
        limit: 120,
        windowSeconds: 60,
    },
    mutation: {
        name: 'compatibility.mutation',
        limit: 60,
        windowSeconds: 60,
    },
};
