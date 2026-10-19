export const SYSTEM_ROLE_TEMPLATES = [
    {
        systemKey: 'owner',
        name: 'Owner',
        patterns: [{ kind: 'all' }],
    },
    {
        systemKey: 'administrator',
        name: 'Administrator',
        patterns: [
            { kind: 'exact', key: 'tenant.admin' },
            { kind: 'prefix', prefix: 'users' },
            { kind: 'prefix', prefix: 'roles' },
            { kind: 'prefix', prefix: 'audit' },
            { kind: 'prefix', prefix: 'api_keys' },
            { kind: 'exact', key: 'mfa.manage' },
        ],
    },
    {
        systemKey: 'operations_manager',
        name: 'Operations Manager',
        patterns: [
            { kind: 'prefix', prefix: 'orders' },
            { kind: 'prefix', prefix: 'products' },
            { kind: 'prefix', prefix: 'inventory' },
            { kind: 'prefix', prefix: 'shipments' },
            { kind: 'prefix', prefix: 'returns' },
        ],
    },
    {
        systemKey: 'fulfillment_operator',
        name: 'Fulfillment Operator',
        patterns: [
            { kind: 'exact', key: 'orders.read' },
            { kind: 'prefix', prefix: 'inventory' },
            { kind: 'prefix', prefix: 'shipments' },
        ],
    },
    {
        systemKey: 'viewer',
        name: 'Viewer',
        patterns: [{ kind: 'suffix', suffix: '.read' }],
    },
    {
        systemKey: 'auditor',
        name: 'Auditor',
        patterns: [
            { kind: 'prefix', prefix: 'audit' },
            { kind: 'exact', key: 'users.read' },
            { kind: 'exact', key: 'roles.read' },
        ],
    },
    {
        systemKey: 'integration',
        name: 'Integration',
        patterns: [
            { kind: 'prefix', prefix: 'channels' },
            { kind: 'exact', key: 'products.read' },
            { kind: 'exact', key: 'orders.read' },
            { kind: 'exact', key: 'inventory.read' },
        ],
    },
];
export function findSystemRoleTemplate(systemKey) {
    const template = SYSTEM_ROLE_TEMPLATES.find((entry) => entry.systemKey === systemKey);
    if (template === undefined) {
        throw new Error(`Unknown system role key: ${systemKey}`);
    }
    return template;
}
