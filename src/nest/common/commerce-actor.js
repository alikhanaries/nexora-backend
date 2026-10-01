export function productActorFields(actor) {
  return {
    actorId: actor.userId ?? actor.apiKeyId ?? actor.tenantId,
    actorKind: actor.apiKeyId === undefined ? 'user' : 'api-key',
  };
}

export function commerceActorFields(actor) {
  const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
  const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
  return { actorId, actorKind };
}
