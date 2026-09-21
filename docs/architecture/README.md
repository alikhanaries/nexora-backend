# Architecture Documentation

This folder describes how Nexora Backend is structured, why it is structured that way, and the constraints every contributor must follow.

## Documents

| Document                                                                       | Summary                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [phase-0-discovery.md](phase-0-discovery.md)                                   | Phase 0 approval pointer and gate status               |
| [requirements.md](requirements.md)                                             | Functional and non-functional requirements for Phase 1 |
| [overview.md](overview.md)                                                     | System context, major components, request flow         |
| [module-boundaries.md](module-boundaries.md)                                   | Layering rules and dependency-cruiser enforcement      |
| [database.md](database.md)                                                     | PostgreSQL schema strategy, migrations, RLS            |
| [security.md](security.md)                                                     | Security controls available in Phase 1                 |
| [scalability.md](scalability.md)                                               | Scaling model and known limits                         |
| [events.md](events.md)                                                         | Outbox, inbox, and integration event model             |
| [audit-logging.md](audit-logging.md)                                           | Audit trail approach (foundation hooks)                |
| [api-strategy.md](api-strategy.md)                                             | Native `/api/v1` vs ChannelEngine `/api/v2`            |
| [channelengine-compatibility.md](channelengine-compatibility.md)               | Compatibility layer design (deferred)                  |
| [channelengine-compatibility-matrix.md](channelengine-compatibility-matrix.md) | Endpoint parity matrix placeholder                     |
| [open-questions.md](open-questions.md)                                         | Unresolved design items                                |

## Related

- [Architecture Decision Records](../decisions/README.md)
- [Executable boundary rules](../../.dependency-cruiser.cjs)
- [Source layout](../../src/README.md)

## Conventions

- Diagrams use Mermaid where helpful; ASCII is fine for simple flows.
- "Phase 1" means foundation only — do not document unimplemented business behaviour as if it exists.
- When a decision is final, record it as an ADR rather than duplicating rationale across files.
