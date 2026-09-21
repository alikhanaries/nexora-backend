import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import type { AuthConfig } from '../../shared/config/index.js';
import { ConfigurationError } from '../../shared/errors/index.js';
import type { AccessTokenPayload, AccessTokenService } from '../../shared/auth/index.js';

const ALGORITHM_HS256 = 'HS256';
const ALGORITHM_RS256 = 'RS256';

type JwtSigningKey = Uint8Array | Awaited<ReturnType<typeof importPKCS8>>;
type JwtVerificationKey = Uint8Array | Awaited<ReturnType<typeof importSPKI>>;

export class JoseAccessTokenService implements AccessTokenService {
  private readonly signingKey: JwtSigningKey;
  private readonly verificationKey: JwtVerificationKey;
  private readonly algorithm: string;
  private readonly ttlSeconds: number;

  private constructor(
    signingKey: JwtSigningKey,
    verificationKey: JwtVerificationKey,
    algorithm: string,
    ttlSeconds: number,
  ) {
    this.signingKey = signingKey;
    this.verificationKey = verificationKey;
    this.algorithm = algorithm;
    this.ttlSeconds = ttlSeconds;
  }

  static async create(config: AuthConfig): Promise<JoseAccessTokenService> {
    const hasRsaKeys = config.jwtPrivateKey !== undefined && config.jwtPublicKey !== undefined;

    if (hasRsaKeys) {
      const signingKey = await importPKCS8(config.jwtPrivateKey, ALGORITHM_RS256);
      const verificationKey = await importSPKI(config.jwtPublicKey, ALGORITHM_RS256);
      return new JoseAccessTokenService(
        signingKey,
        verificationKey,
        ALGORITHM_RS256,
        config.accessTokenTtlSeconds,
      );
    }

    if (config.jwtSecret === undefined) {
      throw new ConfigurationError('JWT signing configuration is missing');
    }

    const secret = new TextEncoder().encode(config.jwtSecret);
    return new JoseAccessTokenService(
      secret,
      secret,
      ALGORITHM_HS256,
      config.accessTokenTtlSeconds,
    );
  }

  async sign(payload: AccessTokenPayload): Promise<string> {
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

  async verify(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.verificationKey, {
      algorithms: [this.algorithm],
    });

    const sub = payload.sub;
    const tenantId = payload.tenantId;
    const sessionId = payload.sessionId;
    const tokenVersion = payload.tokenVersion;

    if (
      typeof sub !== 'string' ||
      typeof tenantId !== 'string' ||
      typeof sessionId !== 'string' ||
      typeof tokenVersion !== 'number'
    ) {
      throw new ConfigurationError('Access token payload is invalid');
    }

    return { sub, tenantId, sessionId, tokenVersion };
  }
}
