import { describe, expect, it, vi } from 'vitest';
import {
    createSystemRoleSeeder,
    SystemRoleSeeder,
} from '../../../src/modules/authorization/services/system-role-seeder.js';
import { SYSTEM_ROLE_TEMPLATES } from '../../../src/modules/authorization/models/system-role-templates.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

describe('createSystemRoleSeeder', () => {
    it('fails fast when required dependencies are missing', () => {
        expect(() => createSystemRoleSeeder({
            permissions: {},
            roles: {},
        })).toThrow('createSystemRoleSeeder requires deps.database');
    });

    it('creates missing system roles and skips existing ones', async () => {
        const created = [];
        const existingKey = SYSTEM_ROLE_TEMPLATES[0].systemKey;
        const roles = {
            findSystemRoleByKey: vi.fn(async (_tenantId, systemKey) => {
                if (systemKey === existingKey) {
                    return { id: 'existing-role', systemKey, name: SYSTEM_ROLE_TEMPLATES[0].name };
                }
                return null;
            }),
            listPermissionsForRole: vi.fn(async () => [{ key: 'orders.read' }]),
            create: vi.fn(async (input) => {
                created.push(input.systemKey);
                return { id: `new-${input.systemKey}`, ...input };
            }),
        };
        const permissions = {
            listKeys: vi.fn(async () => ['orders.read', 'tenant.admin', 'users.read']),
        };
        const database = {
            execute: vi.fn(async (work) => work({})),
        };
        const seeder = createSystemRoleSeeder({ permissions, roles, database });
        const result = await seeder.execute({ tenantId: TENANT_ID });

        expect(result.createdCount).toBe(SYSTEM_ROLE_TEMPLATES.length - 1);
        expect(result.roles).toHaveLength(SYSTEM_ROLE_TEMPLATES.length);
        expect(created).not.toContain(existingKey);
        expect(created.length).toBe(SYSTEM_ROLE_TEMPLATES.length - 1);
    });

    it('is idempotent when all system roles already exist', async () => {
        const roles = {
            findSystemRoleByKey: vi.fn(async (_tenantId, systemKey) => ({
                id: `role-${systemKey}`,
                systemKey,
                name: systemKey,
            })),
            listPermissionsForRole: vi.fn(async () => [{ key: 'orders.read' }]),
            create: vi.fn(),
        };
        const seeder = createSystemRoleSeeder({
            permissions: { listKeys: vi.fn(async () => ['orders.read']) },
            roles,
            database: { execute: vi.fn(async (work) => work({})) },
        });
        const result = await seeder.execute({ tenantId: TENANT_ID });
        expect(result.createdCount).toBe(0);
        expect(roles.create).not.toHaveBeenCalled();
    });

    it('compatibility wrapper preserves seeder behavior', async () => {
        const alwaysExisting = new SystemRoleSeeder({
            permissions: { listKeys: vi.fn(async () => []) },
            roles: {
                findSystemRoleByKey: vi.fn(async (_t, systemKey) => ({ id: systemKey, systemKey, name: systemKey })),
                listPermissionsForRole: vi.fn(async () => []),
                create: vi.fn(),
            },
            database: { execute: vi.fn(async (work) => work({})) },
        });
        const result = await alwaysExisting.execute({ tenantId: TENANT_ID });
        expect(result.createdCount).toBe(0);
    });
});
