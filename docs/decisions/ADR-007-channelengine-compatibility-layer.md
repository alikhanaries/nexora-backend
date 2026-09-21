# ADR-007: ChannelEngine Compatibility Layer

## Status

Accepted — deferred to post-foundation phase.

## Context

Nexora must expose ChannelEngine-compatible endpoints under `/api/v2` without coupling native modules to ChannelEngine DTOs or error envelopes.

## Decision

Build a dedicated compatibility facade module that translates between ChannelEngine contracts and native application interfaces. Native API remains under `/api/v1` with the Nexora error envelope.

## Consequences

- Phase 1 implements no `/api/v2` routes.
- Dependency-cruiser blocks compatibility code from touching repositories directly.
- Compatibility behaviour is verified against a matrix before implementation.
