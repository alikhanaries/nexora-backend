/**
 * Builds a tenant-scoped rate-limit subject for `/api/v2` compatibility requests.
 *
 * Includes tenant and authenticated principal so one credential cannot consume
 * another tenant's quota.
 *
 * Accepts either {@link requireActorContext} output or an authenticated principal.
 *
 * @param {{ tenantId: string, userId?: string, apiKeyId?: string, kind?: string, id?: string }} actor
 * @param {'read'|'mutation'} category
 */
export function compatibilityRateLimitSubject(actor, category) {
    const principalId = actor.apiKeyId !== undefined
        ? `api-key:${actor.apiKeyId}`
        : `user:${actor.userId ?? actor.id}`;
    return `${actor.tenantId}:${principalId}:${category}`;
}
