# ChannelEngine Compatibility Matrix

**Status:** Placeholder — full parity analysis deferred to Phase 2+ when business modules exist.

This matrix tracks ChannelEngine API endpoint support in Nexora's `/api/v2` compatibility facade. Update it as endpoints are implemented or explicitly marked out of scope.

## Legend

| Symbol | Meaning                        |
| ------ | ------------------------------ |
| ⬜     | Not started                    |
| 🟡     | In progress                    |
| ✅     | Supported with tests           |
| ❌     | Out of scope (document reason) |
| 🔮     | Planned                        |

## Summary

| Area      | Total endpoints (est.) | ✅  | 🟡  | ⬜  |
| --------- | ---------------------- | --- | --- | --- |
| Products  | TBD                    | 0   | 0   | TBD |
| Orders    | TBD                    | 0   | 0   | TBD |
| Shipments | TBD                    | 0   | 0   | TBD |
| Returns   | TBD                    | 0   | 0   | TBD |
| Channels  | TBD                    | 0   | 0   | TBD |
| Stock     | TBD                    | 0   | 0   | TBD |

_Endpoint counts will be populated from ChannelEngine OpenAPI export during Phase 2 discovery._

## Product endpoints (placeholder)

| ChannelEngine operation | HTTP   | Nexora `/api/v2` route  | Status | Notes                        |
| ----------------------- | ------ | ----------------------- | ------ | ---------------------------- |
| Get products            | GET    | `/api/v2/products`      | ⬜     | Deferred — no product module |
| Create product          | POST   | `/api/v2/products`      | ⬜     | Deferred                     |
| Update product          | PUT    | `/api/v2/products/{id}` | ⬜     | Deferred                     |
| Delete product          | DELETE | `/api/v2/products/{id}` | ⬜     | Deferred                     |

## Order endpoints (placeholder)

| ChannelEngine operation | HTTP | Nexora `/api/v2` route            | Status | Notes    |
| ----------------------- | ---- | --------------------------------- | ------ | -------- |
| Get orders              | GET  | `/api/v2/orders`                  | ⬜     | Deferred |
| Acknowledge order       | POST | `/api/v2/orders/{id}/acknowledge` | ⬜     | Deferred |
| Ship order              | POST | `/api/v2/orders/{id}/ship`        | ⬜     | Deferred |

## Known intentional differences (to be confirmed)

Document behavioural differences that will **not** be masked by the facade:

| Topic       | ChannelEngine behaviour | Nexora behaviour         | Facade strategy                      |
| ----------- | ----------------------- | ------------------------ | ------------------------------------ |
| Pagination  | TBD                     | Cursor-based native      | Map cursors ↔ page numbers if needed |
| Idempotency | TBD                     | `Idempotency-Key` header | Accept CE headers if documented      |
| Error codes | TBD                     | Nexora error codes       | Map to CE error shapes               |

## Maintenance

1. When implementing a `/api/v2` route, change status to 🟡 then ✅.
2. Link PR and contract test file in Notes column.
3. If an endpoint is permanently unsupported, mark ❌ with stakeholder sign-off.

## Reference

- [channelengine-compatibility.md](channelengine-compatibility.md) — layer design
- [api-strategy.md](api-strategy.md) — versioning policy
