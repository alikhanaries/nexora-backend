import { loadConfig, type AppConfig } from './config.js';

export type {
  AppConfig,
  DatabaseConfig,
  EnvironmentSource,
  HttpClientConfig,
  IdempotencyConfig,
  LogLevel,
  NodeEnvironment,
  ObservabilityConfig,
  OutboxConfig,
  QueueConfig,
  RedisConfig,
  SecurityConfig,
  ServerConfig,
  StorageConfig,
} from './config.js';
export { loadConfig } from './config.js';

export function loadConfigFromEnvironment(): AppConfig {
  return loadConfig(process.env);
}
