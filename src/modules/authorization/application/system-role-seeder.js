import { expandPermissionPatterns } from '../domain/permission-pattern.js';
import { SYSTEM_ROLE_TEMPLATES } from '../domain/system-role-templates.js';
/**
 * Idempotently seeds the seven standard system roles for a tenant.
 */
export class SystemRoleSeeder {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        const catalogKeys = await this.deps.permissions.listKeys();
        return this.deps.database.execute(async (tx) => {
            const seeded = [];
            let createdCount = 0;
            for (const template of SYSTEM_ROLE_TEMPLATES) {
                const existing = await this.deps.roles.findSystemRoleByKey(input.tenantId, template.systemKey, tx);
                if (existing !== null) {
                    const permissions = await this.deps.roles.listPermissionsForRole(existing.id, tx);
                    seeded.push({
                        ...existing,
                        permissionKeys: permissions.map((permission) => permission.key),
                    });
                    continue;
                }
                const permissionKeys = expandPermissionPatterns(template.patterns, catalogKeys);
                const role = await this.deps.roles.create({
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
}
