export function requireWebhooksRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'webhooks.read');
}

export function requireWebhooksManage(authorization, permissions) {
    authorization.requirePermission(permissions, 'webhooks.manage');
}
