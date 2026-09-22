# Compatibility Mutation Idempotency Convention

**Status:** Phase 5.1 — convention locked for future `/api/v2` mutations  
**Last updated:** 2026-09-21

Merchant-compatible mutations (`POST /api/v2/orders/acknowledge`, shipments, cancellations, returns) must reuse Nexora's existing PostgreSQL idempotency ledger — **never** a compatibility-specific store.

## Flow

```text
HTTP compatibility request
        ↓
validate external request (compatibility presentation)
        ↓
map to core public command input (compatibility mapper)
        ↓
shared idempotency.execute(...) with useTransaction: true
        ↓
core command service inside the same DB transaction
        ↓
idempotency markCompletedInTransaction (same tx)
        ↓
audit + outbox (existing core behavior)
        ↓
map result to external response (compatibility mapper)
```

## Rules

1. **Single ledger** — `idempotency_records` via `PostgresIdempotencyService` only.
2. **Transactional completion** — mutations that change business state must use `useTransaction: true` so a successful command cannot be replayed if completion fails.
3. **Route identity** — `routeId` uses the Nexora compatibility route (e.g. `POST /api/v2/shipments`), not an external path alias.
4. **Principal fingerprint** — reuse `actorFingerprint(actor)` from `shared/http/actor-fingerprint.js`.
5. **Request fingerprint** — hash the mapped **core command input**, not the raw external body, so semantically identical requests replay correctly.
6. **Idempotency-Key header** — required for compatibility mutations (same as `/api/v1` fulfillment routes).
7. **No compatibility duplicate prevention** — do not add Redis or compatibility-layer deduplication.

## Phase 4 reference implementations

| Native route | Pattern |
| ------------ | ------- |
| `POST /api/v1/orders/:orderId/shipments` | `idempotency.execute` + `createShipment.execute({ transaction: tx })` |
| Cancellation / return routes | Same transactional idempotency pattern |

## Retry semantics

| Existing record status | Same fingerprint | Behavior |
| ---------------------- | ---------------- | -------- |
| `completed` | yes | Replay stored response |
| `processing` | yes | `IdempotentRequestInProgressError` (409) |
| `failed` | yes | CAS retry — reclaim and re-execute |
| any | different | `IdempotencyConflictError` (409) |

## Compatibility adapter responsibility

Future compatibility mutation handlers should:

1. Authenticate and authorize (existing HTTP plugins + core command permissions).
2. Apply compatibility rate limits (`COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`).
3. Map external body → core command.
4. Call `idempotency.execute(..., { useTransaction: true })` delegating to the appropriate **public command service**.
5. Map core result → external envelope.

Command services must remain idempotency-agnostic; the HTTP/compatibility boundary owns the ledger interaction (same as native routes today).
