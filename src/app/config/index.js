import { loadConfig } from './config.js';
export { loadConfig } from './config.js';
export function loadConfigFromEnvironment() {
    return loadConfig(process.env);
}
