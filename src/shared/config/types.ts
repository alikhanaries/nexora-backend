export type NodeEnvironment = 'development' | 'test' | 'production';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly shutdownTimeoutMs: number;
  readonly bodyLimitBytes: number;
  readonly corsOrigins: readonly string[];
  readonly trustIncomingRequestId: boolean;
  readonly trustProxy: boolean;
}

export interface DatabaseConfig {
  readonly url: string;
  readonly ssl: boolean;
  readonly pool: {
    readonly max: number;
    readonly min: number;
    readonly connectionTimeoutMs: number;
    readonly idleTimeoutMs: number;
    readonly statementTimeoutMs: number;
    readonly queryTimeoutMs: number;
  };
}

export interface RedisConfig {
  readonly url: string;
  readonly keyPrefix: string;
  readonly connectTimeoutMs: number;
  readonly commandTimeoutMs: number;
}

export interface QueueConfig {
  readonly redisUrl: string;
  readonly prefix: string;
  readonly defaultAttempts: number;
  readonly backoffBaseMs: number;
  readonly workerConcurrency: number;
  readonly jobTimeoutMs: number;
}

export interface StorageConfig {
  readonly endpoint: string | undefined;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
}

export interface OutboxConfig {
  readonly batchSize: number;
  readonly pollIntervalMs: number;
  readonly maxAttempts: number;
}

export interface IdempotencyConfig {
  readonly ttlSeconds: number;
}

export interface ObservabilityConfig {
  readonly logLevel: LogLevel;
  readonly logPretty: boolean;
  readonly metricsEnabled: boolean;
  readonly tracingEnabled: boolean;
  readonly otlpEndpoint: string | undefined;
  readonly serviceName: string;
}

export interface HttpClientConfig {
  readonly timeoutMs: number;
}

export interface SecurityConfig {
  readonly corsEnabled: boolean;
  readonly allowedOrigins: readonly string[];
  readonly trustIncomingRequestId: boolean;
}

export interface AuthConfig {
  readonly jwtSecret: string | undefined;
  readonly jwtPrivateKey: string | undefined;
  readonly jwtPublicKey: string | undefined;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly mfaEncryptionKey: string;
  readonly stepUpTtlSeconds: number;
  readonly passwordMinLength: number;
  readonly passwordMaxLength: number;
}

export interface AppConfig {
  readonly env: NodeEnvironment;
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly appName: string;
  readonly instanceNamespace: string;
  readonly server: ServerConfig;
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly queue: QueueConfig;
  readonly storage: StorageConfig;
  readonly outbox: OutboxConfig;
  readonly idempotency: IdempotencyConfig;
  readonly observability: ObservabilityConfig;
  readonly httpClient: HttpClientConfig;
  readonly security: SecurityConfig;
  readonly auth: AuthConfig;
  readonly docsEnabled: boolean;
}
