import { createHash } from 'node:crypto';
import { MarketplaceAuthenticationError } from '../../../domain/marketplace-errors.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';
import {
    readNoonServiceAccount,
    resolveNoonApiBaseUrl,
    resolveNoonUserAgent,
} from './noon-config.js';
import { createNoonLoginJwt } from './noon-jwt.js';

/** Session lifetime per Noon docs (~30 days); refresh before expiry. */
const NOON_SESSION_TTL_MS = 29 * 24 * 60 * 60 * 1_000;

export class NoonAuthSessionProvider {
    http;
    /** @type {string | null | undefined} */
    deploymentApiBaseUrl;
    /** @type {string | null | undefined} */
    deploymentUserAgent;
    /** @type {Map<string, { cookieHeader: string, expiresAtMs: number }>} */
    sessionCache;

    /**
     * @param {{ http?: MarketplaceHttpClient, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null }} [deps]
     */
    constructor(deps = {}) {
        this.http = deps.http ?? new MarketplaceHttpClient();
        this.deploymentApiBaseUrl = deps.deploymentApiBaseUrl;
        this.deploymentUserAgent = deps.deploymentUserAgent;
        this.sessionCache = new Map();
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     */
    async getCookieHeader(runtime) {
        const cacheKey = buildSessionCacheKey(runtime, this.deploymentApiBaseUrl);
        const cached = this.sessionCache.get(cacheKey);
        if (cached !== undefined && cached.expiresAtMs > Date.now() + 60_000) {
            return cached.cookieHeader;
        }
        const cookieHeader = await this.login(runtime);
        this.sessionCache.set(cacheKey, {
            cookieHeader,
            expiresAtMs: Date.now() + NOON_SESSION_TTL_MS,
        });
        return cookieHeader;
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     */
    async login(runtime) {
        const baseUrl = resolveNoonApiBaseUrl(runtime.configuration ?? {}, this.deploymentApiBaseUrl);
        const userAgent = resolveNoonUserAgent(runtime.configuration ?? {}, this.deploymentUserAgent);
        const { keyId, privateKeyPem, projectCode } = readNoonServiceAccount(
            runtime.credentials,
            runtime.configuration ?? {},
        );
        const token = createNoonLoginJwt(keyId, privateKeyPem);
        const response = await this.http.request({
            url: `${baseUrl}/identity/public/v1/api/login`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': userAgent,
            },
            body: JSON.stringify({
                token,
                default_project_code: projectCode,
            }),
        });
        const cookieHeader = buildCookieHeaderFromResponse(response.headers ?? {});
        if (cookieHeader.length === 0) {
            throw new MarketplaceAuthenticationError('Noon login did not return session cookies');
        }
        return cookieHeader;
    }
}

/**
 * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
 */
function buildSessionCacheKey(runtime, deploymentApiBaseUrl) {
    const { keyId, projectCode } = readNoonServiceAccount(runtime.credentials, runtime.configuration ?? {});
    const privateKey = stringField(runtime.credentials, 'privateKey')
        ?? stringField(runtime.credentials, 'private_key')
        ?? '';
    const baseUrl = resolveNoonApiBaseUrl(runtime.configuration ?? {}, deploymentApiBaseUrl);
    const digest = createHash('sha256')
        .update(`${keyId}\0${projectCode}\0${privateKey}\0${baseUrl}`, 'utf8')
        .digest('hex');
    return digest;
}

/**
 * @param {Record<string, string>} headers
 */
function buildCookieHeaderFromResponse(headers) {
    const setCookieRaw = headers['set-cookie'];
    if (setCookieRaw === undefined || setCookieRaw.length === 0) {
        return '';
    }
    const parts = setCookieRaw.split(/,(?=[^;]+?=)/);
    const pairs = parts.map((segment) => segment.split(';')[0]?.trim()).filter(Boolean);
    return pairs.join('; ');
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 */
function stringField(record, key) {
    const value = record[key];
    return typeof value === 'string' ? value : '';
}
