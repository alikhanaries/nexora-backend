/** Requires `webhooks.read` to list subscriptions and delivery history. */
export function requireWebhooksRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'webhooks.read');
}

/** Requires `webhooks.manage` to create/update subscriptions and rotate secrets. */
export function requireWebhooksManage(authorization, permissions) {
    authorization.requirePermission(permissions, 'webhooks.manage');
}
