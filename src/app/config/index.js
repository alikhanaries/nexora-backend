/**
 * Application config entry: re-exports {@link loadConfig} and the process.env convenience wrapper.
 */
import { loadConfig } from './config.js';
export { loadConfig } from './config.js';

/** Loads configuration from the current process environment. */
export function loadConfigFromEnvironment() {
    return loadConfig(process.env);
}
