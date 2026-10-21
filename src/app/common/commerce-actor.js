/**
 * Maps an authenticated principal to audit/event actor fields for product mutations.
 */
export function productActorFields(actor) {
  return {
    actorId: actor.userId ?? actor.apiKeyId ?? actor.tenantId,
    actorKind: actor.apiKeyId === undefined ? 'user' : 'api-key',
  };
}

/** Same shape as product actors; used across commerce command handlers. */
export function commerceActorFields(actor) {
  const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
  const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
  return { actorId, actorKind };
}
