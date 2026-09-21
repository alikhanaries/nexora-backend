# ADR-001: Modular Monolith

**Status:** Accepted  
**Date:** 2025-09-01

## Context

Nexora is a greenfield commerce platform with multiple bounded contexts (orders, products, channels, inventory). Team size and operational maturity do not yet justify running many independently deployed microservices.

We need a structure that:

- Keeps related code cohesive
- Allows independent module evolution
- Can extract hot modules into services later without rewrite

## Decision

Build Nexora Backend as a **modular monolith**:

- One deployable API and one worker process (Phase 1)
- Business logic organised in `src/modules/<name>/` with domain, application, infrastructure, and presentation layers
- Cross-module access only through public module interfaces
- Architecture boundaries enforced by dependency-cruiser

## Consequences

**Positive**

- Single deployment pipeline and simpler local development
- ACID transactions across modules remain possible
- Clear extraction path when a module's scale or team ownership warrants a separate service

**Negative**

- Entire application scales together unless modules are extracted
- Requires discipline — boundaries are conventional without tooling enforcement (mitigated by `arch:check`)

**Neutral**

- Module folders are empty in Phase 1; rules activate when first module lands

## Related

- [module-boundaries.md](../architecture/module-boundaries.md)
- `.dependency-cruiser.cjs`
