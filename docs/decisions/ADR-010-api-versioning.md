# ADR-010: API Versioning Strategy

**Status:** Accepted  
**Date:** 2025-09-01

## Context

Nexora serves two client populations:

1. **Native integrations** — want a clean, evolving Nexora API
2. **ChannelEngine migrants** — expect ChannelEngine URL shapes, status codes, and payload formats

Breaking both groups with a single version line creates either migration pain or innovation paralysis.

## Decision

Use **URL path versioning** with two prefixes:

| Prefix    | Purpose                            | Phase 1                             |
| --------- | ---------------------------------- | ----------------------------------- |
| `/api/v1` | Native Nexora API                  | Foundation endpoints only           |
| `/api/v2` | ChannelEngine compatibility facade | **Deferred** — no routes registered |

Rules:

- Native breaking changes increment the native major version (future `/api/v2` native is distinct from CE facade — naming TBD if collision occurs)
- ChannelEngine compatibility lives exclusively in `channelengine-compatibility` module
- Operations endpoints (`/health`, `/metrics`) are unversioned

OpenAPI document describes native API only in Phase 1.

## Consequences

**Positive**

- Clear client expectations per prefix
- Compatibility code isolated — can be deprecated independently
- Native API not constrained by ChannelEngine legacy decisions

**Negative**

- Two surfaces to maintain during migration period
- Potential confusion between "native v2" and "CE v2" if not documented clearly (mitigated by this ADR and api-strategy.md)

## Related

- [api-strategy.md](../architecture/api-strategy.md)
- [channelengine-compatibility.md](../architecture/channelengine-compatibility.md)
- [channelengine-compatibility-matrix.md](../architecture/channelengine-compatibility-matrix.md)
