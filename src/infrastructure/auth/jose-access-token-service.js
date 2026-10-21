/**
 * JWT access-token signing and verification (jose).
 *
 * Used by the API auth stack; supports HS256 (shared secret) or RS256 (key pair)
 * from application configuration.
 */
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { ConfigurationError } from '../../shared/errors/index.js';
const ALGORITHM_HS256 = 'HS256';
const ALGORITHM_RS256 = 'RS256';
/** Infrastructure adapter for the access-token port. */
export class JoseAccessTokenService {
    signingKey;
    verificationKey;
    algorithm;
    ttlSeconds;
    /** @param {import('jose').KeyLike} signingKey @param {import('jose').KeyLike} verificationKey */
    constructor(signingKey, verificationKey, algorithm, ttlSeconds) {
        this.signingKey = signingKey;
        this.verificationKey = verificationKey;
        this.algorithm = algorithm;
        this.ttlSeconds = ttlSeconds;
    }
    /** Builds HS256 (secret) or RS256 (PEM key pair) service from auth config. */
    static async create(config) {
        const hasRsaKeys = config.jwtPrivateKey !== undefined && config.jwtPublicKey !== undefined;
        if (hasRsaKeys) {
            const signingKey = await importPKCS8(config.jwtPrivateKey, ALGORITHM_RS256);
            const verificationKey = await importSPKI(config.jwtPublicKey, ALGORITHM_RS256);
            return new JoseAccessTokenService(signingKey, verificationKey, ALGORITHM_RS256, config.accessTokenTtlSeconds);
        }
        if (config.jwtSecret === undefined) {
            throw new ConfigurationError('JWT signing configuration is missing');
        }
        const secret = new TextEncoder().encode(config.jwtSecret);
        return new JoseAccessTokenService(secret, secret, ALGORITHM_HS256, config.accessTokenTtlSeconds);
    }
    /** Signs a compact JWT with subject, tenant, session, and token version claims. */
    async sign(payload) {
        return new SignJWT({
            tenantId: payload.tenantId,
            sessionId: payload.sessionId,
            tokenVersion: payload.tokenVersion,
        })
            .setProtectedHeader({ alg: this.algorithm })
            .setSubject(payload.sub)
            .setIssuedAt()
            .setExpirationTime(`${this.ttlSeconds}s`)
            .sign(this.signingKey);
    }
    /** Verifies signature and expiry; returns typed payload fields or throws on invalid tokens. */
    async verify(token) {
        const { payload } = await jwtVerify(token, this.verificationKey, {
            algorithms: [this.algorithm],
        });
        const sub = payload.sub;
        const tenantId = payload.tenantId;
        const sessionId = payload.sessionId;
        const tokenVersion = payload.tokenVersion;
        if (typeof sub !== 'string' ||
            typeof tenantId !== 'string' ||
            typeof sessionId !== 'string' ||
            typeof tokenVersion !== 'number') {
            throw new ConfigurationError('Access token payload is invalid');
        }
        return { sub, tenantId, sessionId, tokenVersion };
    }
}
