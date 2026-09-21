import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { ConfigurationError } from '../../shared/errors/index.js';
const ALGORITHM_HS256 = 'HS256';
const ALGORITHM_RS256 = 'RS256';
export class JoseAccessTokenService {
    signingKey;
    verificationKey;
    algorithm;
    ttlSeconds;
    constructor(signingKey, verificationKey, algorithm, ttlSeconds) {
        this.signingKey = signingKey;
        this.verificationKey = verificationKey;
        this.algorithm = algorithm;
        this.ttlSeconds = ttlSeconds;
    }
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
