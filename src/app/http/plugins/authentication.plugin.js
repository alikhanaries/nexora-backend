import fp from 'fastify-plugin';
import { enrichRequestContext, getRequestContext, } from '../../../shared/context/request-context.js';
import { AuthenticationError } from '../../../shared/errors/index.js';
const PUBLIC_ROUTE_PATTERNS = [
    /^\/health\//,
    /^\/internal\/metrics$/,
    /^\/docs(?:\/|$)/,
    /^\/openapi\.json$/,
    /^\/api\/v1\/foundation\//,
    /^\/api\/v1\/auth\/login$/,
    /^\/api\/v1\/auth\/refresh$/,
    /^\/api\/v1\/auth\/logout$/,
    /^\/api\/v1\/tenants$/,
];
function isPublicRoute(method, path) {
    if (method === 'POST' && path === '/api/v1/tenants') {
        return true;
    }
    if (method === 'GET' && path.startsWith('/api/v1/tenants/')) {
        return true;
    }
    return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}
function readBearerToken(authorization) {
    if (authorization === undefined)
        return null;
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    return match?.[1] ?? null;
}
function readApiKey(request) {
    const headerKey = request.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.length > 0) {
        return headerKey;
    }
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string')
        return null;
    const apiKeyMatch = /^ApiKey\s+(\S+)$/i.exec(authorization);
    return apiKeyMatch?.[1] ?? null;
}
const authenticationPlugin = async (app, options) => {
    app.addHook('preHandler', async (request) => {
        const path = request.routeOptions.url ?? request.url.split('?')[0] ?? request.url;
        if (isPublicRoute(request.method, path)) {
            return;
        }
        const bearer = readBearerToken(typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined);
        const apiKey = readApiKey(request);
        if (bearer !== null && apiKey !== null) {
            throw new AuthenticationError('Provide either Bearer token or API key, not both');
        }
        try {
            if (bearer !== null) {
                const principal = await options.authenticateAccessToken.execute({
                    accessToken: bearer,
                    authenticationMethod: 'password',
                });
                enrichRequestContext({
                    tenantId: principal.tenantId,
                    userId: principal.id,
                    principal,
                });
                options.metrics.recordAuthEvent({ method: 'jwt', outcome: 'success' });
                return;
            }
            if (apiKey !== null) {
                const verified = await options.verifyApiKey.execute({ rawKey: apiKey });
                const principal = {
                    kind: 'api-key',
                    id: verified.apiKeyId,
                    tenantId: verified.tenantId,
                    permissions: verified.permissions,
                    authenticationMethod: 'api-key',
                    apiKeyId: verified.apiKeyId,
                    scopes: verified.scopes,
                };
                enrichRequestContext({
                    tenantId: principal.tenantId,
                    principal,
                });
                options.metrics.recordAuthEvent({ method: 'api-key', outcome: 'success' });
                return;
            }
            throw new AuthenticationError();
        }
        catch (error) {
            options.metrics.recordAuthEvent({
                method: apiKey !== null ? 'api-key' : 'jwt',
                outcome: 'failure',
            });
            throw error;
        }
    });
    app.addHook('onResponse', (_request, _reply, done) => {
        void getRequestContext();
        done();
    });
    await Promise.resolve();
};
export default fp(authenticationPlugin, { name: 'authentication' });
