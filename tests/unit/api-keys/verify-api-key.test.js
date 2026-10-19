import { describe, expect, it, vi } from 'vitest';
import {
    createVerifyApiKey,
} from '../../../src/modules/api-keys/services/use-cases/verify-api-key.js';
import { AuthenticationError } from '../../../src/shared/errors/index.js';

function createDeps() {
    return {
        db: {
            executeAsOwner: vi.fn(async () => null),
            execute: vi.fn(async () => undefined),
        },
        apiKeys: {
            findByPrefix: vi.fn(),
            touchLastUsed: vi.fn(),
        },
    };
}

describe('createVerifyApiKey', () => {
    it('rejects missing or non-string raw keys as AuthenticationError', async () => {
        const useCase = createVerifyApiKey(createDeps());
        await expect(useCase.execute({})).rejects.toBeInstanceOf(AuthenticationError);
        await expect(useCase.execute({ rawKey: null })).rejects.toBeInstanceOf(AuthenticationError);
        await expect(useCase.execute({ rawKey: 12 })).rejects.toBeInstanceOf(AuthenticationError);
        await expect(useCase.execute({ rawKey: '   ' })).rejects.toBeInstanceOf(AuthenticationError);
    });

    it('rejects malformed key material without querying the repository', async () => {
        const deps = createDeps();
        const useCase = createVerifyApiKey(deps);
        await expect(useCase.execute({ rawKey: 'not-a-key' })).rejects.toBeInstanceOf(AuthenticationError);
        expect(deps.db.executeAsOwner).not.toHaveBeenCalled();
    });
});
