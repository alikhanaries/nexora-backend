import { describe, expect, it, vi } from 'vitest';
import { createApiKeysModule } from '../../../src/modules/api-keys/index.js';

describe('createApiKeysModule', () => {
    it('fails fast when required dependencies are missing', () => {
        expect(() => createApiKeysModule({})).toThrow('createApiKeysModule requires deps.database');
        expect(() => createApiKeysModule({
            database: {},
            rateLimiter: {},
        })).toThrow('createApiKeysModule requires deps.stepUpVerifier');
    });

    it('wires use cases when required dependencies are present', () => {
        const module = createApiKeysModule({
            database: { execute: vi.fn() },
            rateLimiter: { consume: vi.fn() },
            stepUpVerifier: { hasValidStepUp: vi.fn() },
        });
        expect(module.useCases.createApiKey).toHaveProperty('execute');
        expect(module.useCases.verifyApiKey).toHaveProperty('execute');
        expect(module.useCases.rotateApiKey).toHaveProperty('execute');
        expect(module.useCases.revokeApiKey).toHaveProperty('execute');
        expect(module.useCases.listApiKeys).toHaveProperty('execute');
    });
});
