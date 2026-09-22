# ADR-007: ChannelEngine Compatibility Layer

## Status

Accepted — deferred to post-foundation phase. **Scope resolved in [ADR-018](ADR-018-phase-5-merchant-compatible-scope.md)** (Merchant-compatible `/api/v2` initial scope; Channel ingestion separate).

## Context

Nexora must expose ChannelEngine-compatible endpoints under `/api/v2` without coupling native modules to ChannelEngine DTOs or error envelopes.

## Decision

Build a dedicated provider-neutral compatibility module (`src/modules/compatibility/`) that translates verified external contracts and native application interfaces. Native API remains under `/api/v1` with the Nexora error envelope. Merchant and Channel external contracts are distinct — see ADR-018.

## Consequences

- Phase 1 implements no `/api/v2` routes.
- Dependency-cruiser blocks compatibility code from touching repositories directly.
- Compatibility behaviour is verified against a matrix before implementation.
