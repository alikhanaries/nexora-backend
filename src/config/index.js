/**
 * Validated configuration entrypoint (migration facade).
 *
 * New code may import from here; existing imports of `src/app/config/` remain valid.
 * Environment variables are parsed only through the schema in `env.config.js`.
 */
export { loadConfig, loadConfigFromEnvironment } from '../app/config/index.js';
export { configSchema } from './env.config.js';
export {
  WASL_EXTERNAL_COMPATIBILITY,
  WASL_NAMING,
  getExternalCompatibilityEntry,
  validateWaslNaming,
} from './naming.config.js';
