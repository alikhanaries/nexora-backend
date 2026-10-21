/**
 * MFA HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const MFA_ROUTES = Object.freeze({
    startTotp: Object.freeze({
        method: 'POST',
        path: '/api/v1/mfa/totp/start',
        public: false,
        handler: 'startTotp',
    }),
    verifyTotp: Object.freeze({
        method: 'POST',
        path: '/api/v1/mfa/totp/verify',
        public: false,
        handler: 'verifyTotp',
    }),
    activateTotp: Object.freeze({
        method: 'POST',
        path: '/api/v1/mfa/totp/activate',
        public: false,
        handler: 'activateTotp',
    }),
    verifyMfa: Object.freeze({
        method: 'POST',
        path: '/api/v1/mfa/verify',
        public: false,
        handler: 'verifyMfa',
    }),
    useRecoveryCode: Object.freeze({
        method: 'POST',
        path: '/api/v1/mfa/recovery-code/use',
        public: false,
        handler: 'useRecoveryCode',
    }),
});

/** Flat list for inventory / parity tests. */
export const MFA_ROUTE_LIST = Object.freeze(Object.values(MFA_ROUTES));
