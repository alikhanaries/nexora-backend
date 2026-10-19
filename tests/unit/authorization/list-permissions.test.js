import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import {
    createListPermissions,
} from '../../../src/modules/authorization/services/list-permissions.js';
import { createDefaultAuthorizationService } from '../../../src/modules/authorization/services/authorization-service.js';

describe('createListPermissions', () => {
    it('denies actors without roles.read', async () => {
        const useCase = createListPermissions({
            authorization: createDefaultAuthorizationService(),
            permissions: { listAll: vi.fn(async () => []) },
        });
        await expect(useCase.execute({
            actorPermissions: [],
        })).rejects.toBeInstanceOf(AuthorizationError);
    });

    it('lists permissions when authorized', async () => {
        const listAll = vi.fn(async () => [{ key: 'orders.read' }]);
        const useCase = createListPermissions({
            authorization: createDefaultAuthorizationService(),
            permissions: { listAll },
        });
        await expect(useCase.execute({
            actorPermissions: ['roles.read'],
        })).resolves.toEqual([{ key: 'orders.read' }]);
        expect(listAll).toHaveBeenCalledOnce();
    });
});
