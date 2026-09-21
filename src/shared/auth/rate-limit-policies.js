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
};
