import { describe, expect, it } from 'vitest';
import { loadConfig, WASL_NAMING, configSchema } from '../../../src/config/index.js';

describe('src/config facade', () => {
  it('re-exports loadConfig and naming without duplicating schema', () => {
    expect(typeof loadConfig).toBe('function');
    expect(WASL_NAMING.application.backendServiceId).toBe('wasl-backend');
    expect(typeof configSchema.parse).toBe('function');
  });
});
