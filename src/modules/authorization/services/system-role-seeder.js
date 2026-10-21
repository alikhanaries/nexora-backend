import { expandPermissionPatterns } from '../models/permission-pattern.js';
import { SYSTEM_ROLE_TEMPLATES } from '../models/system-role-templates.js';
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * Idempotently seeds the seven standard system roles for a tenant.
 *
 * @param {{ permissions: object, roles: object, database: object }} deps
 * @returns {{ execute: Function }}
 */
export function createSystemRoleSeeder(deps) {
    requireAuthorizationDeps(deps, 'createSystemRoleSeeder', ['permissions', 'roles', 'database']);

    /**
     * @param {{ tenantId: string }} input
     */
    async function execute(input) {
        const catalogKeys = await deps.permissions.listKeys();
        return deps.database.execute(async (tx) => {
            const seeded = [];
            let createdCount = 0;
            for (const template of SYSTEM_ROLE_TEMPLATES) {
                const existing = await deps.roles.findSystemRoleByKey(input.tenantId, template.systemKey, tx);
                if (existing !== null) {
                    const permissions = await deps.roles.listPermissionsForRole(existing.id, tx);
                    seeded.push({
                        ...existing,
                        permissionKeys: permissions.map((permission) => permission.key),
                    });
                    continue;
                }
                const permissionKeys = expandPermissionPatterns(template.patterns, catalogKeys);
                const role = await deps.roles.create({
                    tenantId: input.tenantId,
                    name: template.name,
                    permissionKeys,
                    isSystem: true,
                    systemKey: template.systemKey,
                }, tx);
                seeded.push(role);
                createdCount += 1;
            }
            return { roles: seeded, createdCount };
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
