# ChannelEngine Compatibility Layer

Nexora must support clients migrating from **ChannelEngine** without rewriting integrations immediately. That compatibility is delivered as a **facade module** behind `/api/v2`, separate from the native `/api/v1` API.

**Status:** Deferred — not implemented in Phase 1.

## Design intent

The compatibility layer is a **translation boundary**, not a second implementation of business logic.

```
ChannelEngine client
        │
        ▼
/api/v2/*  (presentation — channelengine-compatibility module)
        │  map request DTO → native command
        ▼
modules/*/application  (use cases)
        │
        ▼
modules/*/domain + infrastructure
```

### Rules

1. **No direct database access** from the compatibility module — enforced by `compatibility-no-direct-persistence` in dependency-cruiser.
2. **No duplicated business rules** — validation and invariants live in domain/application layers shared with `/api/v1`.
3. **Explicit mapping** — each ChannelEngine endpoint has a mapper file documenting field transformations.
4. **Status code fidelity** — HTTP status and error body shapes match ChannelEngine expectations where clients depend on them.

## Module location (future)

```
src/modules/channelengine-compatibility/
  presentation/     Route handlers for /api/v2
  mappers/          Request/response translation
  public/           Exported types for tests
```

Native routes remain in each business module's `presentation/` folder under `/api/v1`.

## Versioning note

ChannelEngine compatibility uses **`/api/v2`** as the URL prefix by convention. This is independent of a future native breaking version. The matrix and ADR-010 document this split explicitly to avoid confusion.

## Testing strategy (when implemented)

- **Contract tests** — golden files of ChannelEngine request/response samples.
- **Parity tests** — same operation via `/api/v1` and `/api/v2` yields equivalent persisted state.
- **Matrix-driven coverage** — every matrix row marked "supported" must have a contract test.

## Parity tracking

Endpoint-by-endpoint status lives in [channelengine-compatibility-matrix.md](channelengine-compatibility-matrix.md). Update the matrix when implementing or explicitly deferring each ChannelEngine operation.

## Phase 1 deliverable

Phase 1 documents the approach and enforces architectural rules. No `/api/v2` routes are registered. The first compatibility endpoints ship with the business module that owns the underlying use case (likely products or orders in Phase 2).
