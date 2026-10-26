# Webhook ingress token provisioning (design for approval)

**Status:** Proposed (ADR-031 follow-up)  
**Scope:** Close the gap where `POST …/marketplace-connection` does not issue ingress tokens.

## Problem

- Inbound route: `POST /api/v1/inbound/marketplace-webhooks/:ingressToken` (`ingressToken` length 16–128).
- DB stores **SHA-256** only: `marketplace_connections.webhook_ingress_token_hash` (unique, migration `0047`).
- Lookup uses `app.lookup_marketplace_connection_for_webhook` (**SECURITY DEFINER**, no tenant GUC) to bind token → `(tenant_id, channel_id, marketplace_key)`.
- Integration tests manually call `PostgresMarketplaceConnectionRepository.updateWebhookIngressTokenHash` after upsert (`webhooks-marketplace.test.js`).
- ADR-031 documents automatic issuance as deferred.

## Security model (target)

| Concern | Rule |
| ------- | ---- |
| Plaintext token | Shown **once** in the HTTP response body of the provisioning call; never logged, never stored, never returned on GET |
| At rest | `hashWebhookIngressToken(token)` = SHA-256 UTF-8 (`webhook-ingress-token.js`) |
| Authz | Same as connection mutations: `channels.update` + tenant-scoped channel ownership |
| Tenant isolation | Provisioning loads connection by `(tenantId, channelId)` from actor context; hash update scoped by `tenant_id` + `connection.id` |
| Rotation | New token replaces hash on active connection; old URL stops working immediately |
| Revocation | `DELETE` connection or set hash to NULL via dedicated revoke (disable ingress without deleting credentials) |
| Cross-tenant | Unique index on hash globally; collision retry on generate (negligible) |

Noon provider auth remains in `NoonWebhookAdapter` (parse envelope only); ingress token is **Wasl routing**, not Noon HMAC.

## Proposed API (minimal)

Add to channel marketplace-connection route family (Nest + `commerce-integration.routes.js`):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/api/v1/channels/:channelId/marketplace-connection/webhook-ingress-token` | Issue new token (rotate) |
| `DELETE` | `/api/v1/channels/:channelId/marketplace-connection/webhook-ingress-token` | Revoke (clear hash) |

Optional later: auto-issue on first `POST …/marketplace-connection` with `{ "issueWebhookIngressToken": true }` — **not** in v1 to avoid accidental token loss on credential-only upserts.

### Issue response (201)

```json
{
  "success": true,
  "data": {
    "connectionId": "<uuid>",
    "webhookIngressUrlPath": "/api/v1/inbound/marketplace-webhooks/<plaintext-token>",
    "issuedAt": "<iso8601>",
    "rotatePrevious": true
  }
}
```

Document that operators must prepend public API base URL (HTTPS). Do not embed host in DB.

### Issue behavior

1. `requirePermission(actor, 'channels.update')`.
2. Load active connection for `(tenantId, channelId)` or 404.
3. `plaintext = generateWebhookIngressToken()` (32 bytes base64url).
4. `hash = hashWebhookIngressToken(plaintext)`.
5. In tenant transaction: `updateWebhookIngressTokenHash(tx, tenantId, connectionId, hash)`.
6. Audit: `MARKETPLACE_WEBHOOK_INGRESS_TOKEN_ROTATED` (metadata: `connectionId`, `channelId`, `marketplaceKey` — **no token**).
7. Return plaintext in path segment only; structured logger must redact path if request logging includes URL.

### Revoke behavior

1. Same authz + load connection.
2. Set `webhook_ingress_token_hash = NULL` (new repository method `clearWebhookIngressTokenHash`).
3. Audit: `MARKETPLACE_WEBHOOK_INGRESS_TOKEN_REVOKED`.

## Implementation touchpoints

| Layer | Change |
| ----- | ------ |
| `MarketplaceConnectionCommandService` | `issueWebhookIngressToken`, `revokeWebhookIngressToken` |
| `PostgresMarketplaceConnectionRepository` | `clearWebhookIngressTokenHash` |
| `commerce-integrations.controller.js` | Two handlers |
| `marketplace-connection.schemas.js` | Response schema for issue |
| `toMarketplaceConnectionDto` | Unchanged (never expose hash or token) |

## Tests required before merge

### Unit

- `generateWebhookIngressToken` length/charset satisfies ingress param schema (16–128).
- `hashWebhookIngressToken` stable for known input (golden hash, no secret material in fixture).

### Integration (mirror `webhooks-marketplace.test.js`)

1. Upsert connection → issue token via **new HTTP route** (not repository direct).
2. Assert GET connection JSON does not contain token or hash.
3. POST webhook to `/api/v1/inbound/marketplace-webhooks/{token}` with Noon fixture envelope → 200 enqueued.
4. Rotate token → old token 401, new token 200.
5. Revoke → 401 for former token.
6. Cross-tenant: user B cannot issue/revoke on user A's channel (403/404).

### Architecture

- `module-routes-layout.test.js` registers new paths.

## Operator workflow (after approval)

1. Upsert Noon marketplace connection (credentials encrypted).
2. `POST …/webhook-ingress-token` → copy full HTTPS URL once into Noon Event Notifications (`FBPI::ORDER_SYNC`).
3. Run worker + public HTTPS ingress.
4. Rotate by re-POST issue; update Noon URL.

## Out of scope

- Automatic token on upsert (optional v2).
- Storing Noon-side notification secrets in Wasl (Noon adapter does not require them today).

## References

- ADR-031, `docs/marketplaces/webhook-ingestion.md`
- `src/modules/webhooks/marketplace/services/webhook-ingress-token.js`
- `0047_marketplace_webhook_ingress.sql`
