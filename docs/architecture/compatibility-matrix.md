# Compatibility Matrix

**Status:** Phase 5 — scope locked ([ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md))  
**Last updated:** 2026-09-22

This matrix tracks external contract support in Nexora's provider-neutral compatibility adapter (`src/modules/compatibility/`). External terminology belongs here and at the `/api/v2` presentation/mapper boundary only.

## Contract verification sources

| Source | URL |
| ------ | --- |
| Merchant API OpenAPI | `https://docs-new.channelengine.net/api/openapi/merchant.json` |
| Channel API OpenAPI | `https://docs-new.channelengine.net/api/openapi/channel.json` |

**OQ-CE-001:** Resolved — `/api/v2` initial scope is **Merchant-compatible** only. Channel ingestion is separate future scope.

## Scope legend

| Label | Meaning |
| ----- | ------- |
| **Initial Phase 5** | In scope for first Merchant-compatible implementation wave |
| **Future Merchant** | Merchant contract endpoint; later Phase 5+ step |
| **Separate Channel scope** | Channel API contract; requires explicit future product decision |
| **N/A** | Not applicable to current Nexora scope |

## Phase 5 endpoint scope (orders and related)

Nexora routes are prefixed `/api/v2/...` (e.g. external `GET /v2/orders/new` → `GET /api/v2/orders/new`).

| External contract | External endpoint | Nexora route | Scope | Core contract | Status |
| ----------------- | ----------------- | ------------ | ----- | ------------- | ------ |
| Merchant | GET /v2/orders | GET /api/v2/orders | Initial Phase 5 | OrderQueryService.listOrders | **Implemented** — see filter notes below |
| Merchant | GET /v2/orders/new | GET /api/v2/orders/new | Initial Phase 5 | OrderQueryService.listOrders | **Implemented** — see audit notes below |
| Merchant | POST /v2/orders/acknowledge | POST /api/v2/orders/acknowledge | Initial Phase 5 | OrderCommandService.acknowledgeOrder | **Implemented** — see acknowledge notes below |
| Merchant | POST /v2/shipments | POST /api/v2/shipments | Initial Phase 5 | ShipmentCommandService.createShipment | **Implemented** — see shipment notes below |
| Merchant | PUT /v2/shipments/{merchantShipmentNo} | PUT /api/v2/shipments/:merchantShipmentNo | Phase 7.4 | ShipmentCommandService.updateShipmentTracking | **Implemented** — see shipment tracking notes below |
| Merchant | POST /v2/cancellations | POST /api/v2/cancellations | Initial Phase 5 | CancellationCommandService.createCancellation | **Implemented** — see cancellation notes below |
| Merchant | POST /v2/returns/merchant | POST /api/v2/returns | Initial Phase 5 | ReturnCommandService.createReturn | **Implemented** — see return notes below |
| Merchant | PUT /v2/returns | PUT /api/v2/returns | Phase 7.4 | ReturnCommandService.processReturnReceive | **Implemented** — see return receive notes below |
| Merchant | POST /v2/returns/merchant/acknowledge | POST /api/v2/returns/merchant/acknowledge | Phase 7.4 | ReturnCommandService.acknowledgeReturn | **Implemented** — see return acknowledge notes below |
| Merchant | GET /v2/shipments/merchant | GET /api/v2/shipments/merchant | Initial Phase 5 | ShipmentQueryService.listShipments | **Implemented** — see shipment read notes below |
| Merchant | GET /v2/cancellations/merchant | GET /api/v2/cancellations/merchant | Initial Phase 5 | CancellationQueryService.listCancellations | **Implemented** — see cancellation read notes below |
| Merchant | GET /v2/returns/merchant | GET /api/v2/returns/merchant | Initial Phase 5 | ReturnQueryService.listReturns | **Implemented** — see return read notes below |
| Merchant | GET /v2/returns/merchant/new | GET /api/v2/returns/merchant/new | Initial Phase 5 | ReturnQueryService.listReturns | **Implemented** — see return read notes below |
| Merchant | GET /v2/returns/merchant/{merchantOrderNo} | GET /api/v2/returns/merchant/:merchantOrderNo | Initial Phase 5 | ReturnQueryService.listReturns | **Implemented** — see return read notes below |
| Merchant | GET /v2/returns/{merchantReturnNo} | — | **N/A** | — | **Not in Merchant OpenAPI — verified path is by merchant order number** |
| Merchant | POST /v2/orders | — | **N/A** | — | **Not in Merchant contract — do not implement** |
| Channel | POST /v2/orders | POST /api/v2/orders | Phase 7.2 | OrderCommandService.createChannelOrder | **Implemented** — see channel create notes below |
| Channel | POST /v2/orders/channel-fulfilled | POST /api/v2/orders/channel-fulfilled | Phase 7.3 | OrderCommandService.createChannelFulfilledOrder | **Implemented** — see channel-fulfilled notes below |

## Public contract gap analysis

Only documented gaps — no speculative contracts.

| Public contract | Current state | Merchant compatibility need |
| --------------- | ------------- | ----------------------------- |
| **OrderQueryService** | Exists — single-order reads (`getOrderById`, `getOrderLines`, `findOrderById`) | **Insufficient for list endpoints** — needs tenant-scoped list/filter (status, dates, external refs, channel) without importing `ListOrders` use case directly |
| **OrderCommandService** | `createOrder`, **`acknowledgeOrder`** | Acknowledge maps to `AcknowledgeOrder` → `ConfirmOrder` (`NEW`/`CONFIRMED` idempotent) |
| **ShipmentQueryService** | **`listShipments`** added | Merchant shipment list reads |
| **ShipmentCommandService** | **`createShipment`** | Merchant shipment creation maps to `CreateShipment` + order fulfillment |
| **CancellationQueryService** | **`listCancellations`** added | Merchant cancellation list reads |
| **CancellationCommandService** | **`createCancellation`** | Merchant cancellation creation maps to `CreateCancellation` + order fulfillment |
| **ReturnQueryService** | **`listReturns`** added | Merchant return list reads |
| **ReturnCommandService** | **`createReturn`** | Merchant return creation maps to `CreateReturn` |
| **ProductQueryService** | Exists | Sufficient for product/SKU resolution in mappers |
| **ChannelQueryService** | Exists | Sufficient for channel metadata in order responses |
| **InventoryService** | Exists | Sufficient where stock fields appear in external responses |
| **PricingService** | Exists | Sufficient for price resolution in mappers |
| **OfferQueryService** | Exists | Sufficient for offer-related reads |

### Mapping gaps (document, do not bypass boundary)

| Topic | Gap |
| ----- | --- |
| Pagination | Merchant API uses `Page`; Nexora lists use cursor internally — adapter required at compatibility boundary |
| Order status values | External `OrderStatusViewModel` ≠ Nexora `OrderStatus` enum — mapper required |
| Identifiers | External integer `Id` vs Nexora UUID — mapper required |
| Money | External decimal incl. VAT vs Nexora minor units — converted via `shared/money.minorUnitsToDecimal` (ISO 4217 exponents; default 2). **VAT-inclusive labelling** may exceed Nexora tax fields — see audit notes |
| NEW order semantics | Native `/api/v1/orders` creates `CONFIRMED`; endpoint returns only Nexora `NEW` — see audit notes |
| Integer IDs | External `Id` / `ChannelId` omitted — no persistent external identifier model |
| ChannelProductNo | Only `merchantSku` on order lines; channel-specific SKU not stored separately |
| Product references | External `MerchantProductNo` / `ChannelProductNo` vs Nexora UUID `productId` — lookup via ProductQueryService |
| `GET /v2/orders/new` data shape | Merchant response includes lines, customer, addresses, channel metadata — OrderQueryService must expose enough data or list contract must return detail DTOs |

## `GET /api/v2/orders/new` — implemented audit notes (2026-09-21)

**Status mapping:** External `NEW` ↔ Nexora `OrderStatus.NEW` only. This is intentional — mapping `CONFIRMED` to external `NEW` would be semantically incorrect (`CONFIRMED` maps to external `IN_PROGRESS`).

**Native order creation gap:** `CreateOrder` / `Order.create()` defaults to `CONFIRMED`. No current API creates orders in `NEW`. Therefore this endpoint returns an empty list for orders created only through `/api/v1/orders` unless they are explicitly placed in `NEW` (e.g. a future import/ingestion flow or manual correction). This is a **product/domain gap**, not a mapper bug.

**Money:** Amounts convert from Nexora integer minor units using ISO 4217 exponents (`shared/money/minorUnitsToDecimal`). Fields labelled `*InclVat` in the external contract are populated from Nexora totals that may not include line-level VAT breakdown — treat as a representation gap until tax modelling matures.

**Identifiers:** External integer `Id`, `ChannelId`, and line `Id` are omitted. The external schema does not require order `Id` (only `Email`, `CurrencyCode`, `OrderDate`). Acknowledge flows needing integer IDs remain blocked until a persistent external-identifier strategy is decided.

**Product identifiers:** Both `MerchantProductNo` and `ChannelProductNo` map to the order line's snapshotted `merchantSku`. Nexora does not store a separate channel-specific SKU on the line; `product.externalReference` and `offer.externalReference` exist but are not channel-listing SKUs.

**Pagination:** `Page` and `ItemsPerPage` are supported at the compatibility boundary (not listed in external OpenAPI for `/new`, but required for collection semantics). Native `/api/v1` cursor pagination is unchanged.

## `GET /api/v2/orders` — implemented filter notes (2026-09-21)

**Supported query parameters (mapped safely):**

| External parameter | Nexora mapping |
| ------------------ | -------------- |
| `Page`, `ItemsPerPage` | Compatibility pagination → `listOrders` page/pageSize |
| `Statuses` | External status vocabulary → Nexora status set (see mapper) |
| `MerchantOrderNos` | `orderNumbers[]` |
| `ChannelOrderNos` | `externalOrderReferences[]` |
| `FromDate`, `ToDate` | `createdAfter` / `createdBefore` (inclusive/exclusive on `created_at`) |
| `FromCreatedAtDate`, `ToCreatedAtDate` | Same as above; combined with order-date bounds when both provided |
| `FromUpdatedAtDate`, `ToUpdatedAtDate` | `updatedAfter` / `updatedBefore` on `updated_at` |

**Intentionally unsupported (documented gaps):**

| External parameter | Reason |
| ------------------ | ------ |
| `EmailAddresses` | Requires customer join filter not exposed on `OrderQueryService` |
| `CommercialOrderNos` | No Nexora field |
| `ChannelIds`, `StockLocationIds` | External integer IDs vs Nexora UUIDs |
| `ExcludeMarketplaceFulfilledOrdersAndLines`, `FulfillmentType` | No marketplace-fulfillment model |
| `OnlyWithCancellationRequests` | No acknowledgement/cancellation-request flag on orders |
| `IsAcknowledged` | No acknowledgement state |
| `FromAcknowledgedDate`, `ToAcknowledgedDate`, `FromClosedAtDate`, `ToClosedAtDate` | No compatible persisted fields |

External statuses with **no Nexora equivalent** (`AWAITING_PAYMENT`, `IN_BACKORDER`, `MANCO`, `IN_COMBI`, `REQUIRES_CORRECTION`) yield an empty collection when requested alone.

## `POST /api/v2/shipments` — implemented notes (2026-09-21)

**External operation:** `POST /v2/shipments` — marks an order fully or partially shipped (single shipment object, not a batch array).

**Request mapping:**

| External field | Nexora mapping |
| -------------- | -------------- |
| `MerchantOrderNo` | `orders.order_number` (lookup key) |
| `MerchantShipmentNo` | `shipments.external_reference` (tenant-unique when set) |
| `Lines[].MerchantProductNo` | Order line `merchantSku` (allocation across matching lines when SKU repeats) |
| `Lines[].Quantity` | Shipment line quantity (passed to `CreateShipment`; core validates shippable quantity) |
| `Lines[].OrderLineId` | Accepted but **not used** — Nexora has no external integer order-line ID |
| `Method` | `shipments.carrier` |
| `TrackTraceNo` | `shipments.tracking_number` |

**Intentionally unsupported (documented gaps):**

| External field | Reason |
| -------------- | ------ |
| `TrackTraceUrl`, `ReturnTrackTraceNo` | No shipment URL/return-tracking fields in Nexora |
| `ExtraData` | No generic shipment metadata store |
| `ShippedFromCountryCode` | No shipment origin country field |
| `ShippedFromStockLocationId` | External integer stock location ID vs Nexora UUID |

**Behavior:** Maps to existing `CreateShipment` → `OrderFulfillmentService.applyShipmentQuantities` + `evaluateOrderShipmentState`. Creates a Nexora shipment in `CREATED` status and increments order-line shipped quantities. Does **not** call `ShipShipment` (external create ≠ separate dispatch transition).

**Quantity semantics:** Over-shipment is rejected by core `BusinessRuleError` (422) — quantities are never silently clamped at the compatibility boundary.

**Authorization:** `shipments.create`. Authentication via Bearer JWT or API key.

**Shipment identity:** External contract describes `MerchantShipmentNo` as the merchant's unique shipment reference; it is the path key for `PUT /v2/shipments/{merchantShipmentNo}` and list filters. Persisted as provider-neutral `shipments.external_reference` with PostgreSQL uniqueness on `(tenant_id, external_reference)`.

**Duplicate `MerchantShipmentNo` behavior (distinct from HTTP idempotency):**

| Scenario | Behavior |
| -------- | -------- |
| Same `Idempotency-Key` + same payload | HTTP idempotency replay (201) |
| Same `Idempotency-Key` + different payload | HTTP idempotency conflict (409) |
| Different keys + same `MerchantShipmentNo` + equivalent payload | Business identity replay — existing shipment returned (201), no duplicate fulfillment side effects |
| Different keys + same `MerchantShipmentNo` + different payload | Conflict (409) — no merge/overwrite |
| Same reference on a different order | Conflict (409) |

**Idempotency:** Required `Idempotency-Key` header; transactional ledger via `PostgresIdempotencyService` (`useTransaction: true`). Fingerprint includes `merchantShipmentNo`, mapped order/lines, carrier, and tracking number.

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 201, Message: null }` — no fabricated integer IDs or shipment payload.

## `PUT /api/v2/shipments/:merchantShipmentNo` — implemented notes (2026-09-22)

**External operation:** `PUT /v2/shipments/{merchantShipmentNo}` — update shipment tracking and carrier.

**Request mapping:**

| External field | Nexora mapping |
| -------------- | -------------- |
| Path `merchantShipmentNo` | `shipments.external_reference` (tenant-unique lookup key) |
| `Method` | `shipments.carrier` |
| `TrackTraceNo` | `shipments.tracking_number` |

**Intentionally unsupported (documented gaps):**

| External field | Reason |
| -------------- | ------ |
| `ReturnTrackTraceNo`, `TrackTraceUrl`, `ShippedFromCountryCode`, `ReturnMethod` | No compatible persisted fields on Nexora shipments |

**Behavior:** Maps to `ShipmentCommandService.updateShipmentTracking` → `UpdateShipmentTracking`. Shipments in `CREATED` or `READY_TO_SHIP` transition to `SHIPPED` and emit `shipment.status_changed` + `shipment.shipped`. Already-shipped shipments update carrier/tracking only (no duplicate status events when unchanged).

**Authorization:** `shipments.update`. Authentication via Bearer JWT or API key.

**Idempotency:** Required `Idempotency-Key` header; transactional ledger via `PostgresIdempotencyService` (`useTransaction: true`, `routeId=PUT /api/v2/shipments/:merchantShipmentNo`).

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 200, Message: null }`.

## `POST /api/v2/returns` — implemented notes (2026-09-22)

**External operation:** `POST /v2/returns/merchant` — marks an order fully or partially returned (single return object). Nexora exposes this as `POST /api/v2/returns`.

**Request mapping:**

| External field | Nexora mapping |
| -------------- | -------------- |
| `MerchantOrderNo` | `orders.order_number` (lookup key) |
| `MerchantReturnNo` | `returns.external_reference` (tenant-unique when set) |
| `Lines[].MerchantProductNo` | Order line `merchantSku` (allocation across matching lines when SKU repeats) |
| `Lines[].Quantity` | Return line quantity (passed to `CreateReturn`; core validates eligible shipped quantity) |
| `Lines[].OrderLineId` | Accepted but **not used** — Nexora has no external integer order-line ID |
| `MerchantComment` / `CustomerComment` / `Reason` | `returns.reason` (MerchantComment preferred, then CustomerComment, then Reason enum string) |

**Intentionally unsupported (documented gaps):**

| External field | Reason |
| -------------- | ------ |
| `Id` | External ChannelEngine integer ID — not persisted or verified |
| `TrackTraceNo` | No return tracking field on Nexora returns |
| `RefundInclVat` / `RefundExclVat` | No refund amount fields on returns |
| `ReturnDate` | No separate source-created timestamp field |
| `ExtraData` / line `ExtraData` | No generic return metadata store |
| `Rma` | No RMA field on returns |
**Behavior (create):** Maps to existing `CreateReturn`. Creates a Nexora return in `REQUESTED` status. Does **not** receive inventory or increment `returnedQuantity` — use `PUT /api/v2/returns` receive compatibility or native `ReceiveReturn`.

**Quantity semantics:** Eligible quantity = `shippedQuantity - returnedQuantity - pendingReturnQuantity`. Over-return rejected by core `BusinessRuleError` (422). Unshipped orders cannot be returned (422).

**Authorization:** `returns.create`. Authentication via Bearer JWT or API key.

**Return identity:** External contract describes `MerchantReturnNo` as the merchant's unique return reference; it appears in list filters (`MerchantReturnNos`). Persisted as provider-neutral `returns.external_reference` with PostgreSQL uniqueness on `(tenant_id, external_reference)`.

**Duplicate `MerchantReturnNo` behavior (distinct from HTTP idempotency):**

| Scenario | Behavior |
| -------- | -------- |
| Same `Idempotency-Key` + same payload | HTTP idempotency replay (201) |
| Same `Idempotency-Key` + different payload | HTTP idempotency conflict (409) |
| Different keys + same `MerchantReturnNo` + equivalent payload | Business identity replay — existing return returned (201), no duplicate side effects |
| Different keys + same `MerchantReturnNo` + different payload | Conflict (409) — no merge/overwrite |
| Same reference on a different order | Conflict (409) |

**Idempotency:** Required `Idempotency-Key` header; transactional ledger via `PostgresIdempotencyService` (`useTransaction: true`). Fingerprint includes `merchantReturnNo`, mapped order/lines, and reason.

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 201, Message: null }` — no fabricated integer IDs or return payload.

## `PUT /api/v2/returns` — implemented notes (2026-09-22)

**External operation:** `PUT /v2/returns` — marks a marketplace return as accepted or rejected.

**Request mapping:**

| External field | Nexora mapping |
| -------------- | -------------- |
| `ReturnId` | Accepted for contract compliance; **not persisted or used as lookup key** (same integer-ID policy as order acknowledge) |
| `Lines[].MerchantProductNo` | Order line `merchantSku` for return resolution and validation |
| `Lines[].AcceptedQuantity` | Full accept path → `ProcessReturnReceive` → `ReceiveReturn` |
| `Lines[].RejectedQuantity` | Full reject path → `ProcessReturnReceive` → `RejectReturn` |

**Return resolution:** Because Nexora does not persist external integer return IDs, the compatibility layer resolves the target return by matching line SKUs and quantities against a **unique** tenant-scoped return in `REQUESTED` or `APPROVED` status. Ambiguous matches return `409`; no match returns `404`.

**Limitations:**

| Scenario | Behavior |
| -------- | -------- |
| Partial accept + reject on the same line | Rejected (`422`) |
| Mixed accept/reject across lines on one return | Rejected (`422`) |
| Lookup by external integer `ReturnId` alone | Not supported — line-based resolution required |

**Behavior:** Maps to `ReturnCommandService.processReturnReceive`. Auto-approves `REQUESTED` returns before receive/reject. Receive restores inventory and increments `returnedQuantity`.

**Authorization:** `returns.update`. Authentication via Bearer JWT or API key.

**Idempotency:** Required `Idempotency-Key` header; transactional ledger (`routeId=PUT /api/v2/returns`).

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 200, Message: null }`.

## `POST /api/v2/returns/merchant/acknowledge` — implemented notes (2026-09-22)

**External operation:** `POST /v2/returns/merchant/acknowledge` — acknowledges a return registration.

**Request mapping:**

| External field | Nexora mapping |
| -------------- | -------------- |
| `MerchantReturnNo` | `returns.external_reference` (lookup key) |
| `ReturnId` | Accepted for contract compliance; not persisted or used as lookup key |

**Behavior:** Maps to `ReturnCommandService.acknowledgeReturn` → `AcknowledgeReturn`. Transitions `REQUESTED → APPROVED` (idempotent when already approved/received/completed). Emits `return.status_changed` on transition.

**Authorization:** `returns.update`. Authentication via Bearer JWT or API key.

**Idempotency:** Required `Idempotency-Key` header; transactional ledger (`routeId=POST /api/v2/returns/merchant/acknowledge`).

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 200, Message: null }`.

**Acknowledgement state:** Nexora has no separate `IsAcknowledged` persisted flag; acknowledgement is represented by `APPROVED` status (or later terminal receive states).

## `POST /api/v2/cancellations` — implemented notes (2026-09-22)

**External operation:** `POST /v2/cancellations` — marks an order fully or partially cancelled (single cancellation object, not a batch array).

**Request mapping:**

| External field | Nexora mapping |
| -------------- | -------------- |
| `MerchantOrderNo` | `orders.order_number` (lookup key) |
| `MerchantCancellationNo` | `cancellations.external_reference` (tenant-unique when set) |
| `Lines[].MerchantProductNo` | Order line `merchantSku` (allocation across matching lines when SKU repeats) |
| `Lines[].Quantity` | Cancellation line quantity (passed to `CreateCancellation`; core validates cancellable quantity) |
| `Lines[].OrderLineId` | Accepted but **not used** — Nexora has no external integer order-line ID |
| `Reason` | `cancellations.reason` |

**Intentionally unsupported (documented gaps):**

| External field | Reason |
| -------------- | ------ |
| `ReasonCode` | No structured cancellation reason-code field in Nexora |
| `IsMerchantCreator` | No creator-origin metadata on cancellations |

**Behavior:** Maps to existing `CreateCancellation` → `OrderFulfillmentService.applyCancellation`. Creates a Nexora cancellation that immediately completes (`REQUESTED → COMPLETED`), increments order-line cancelled quantities, releases inventory, and may transition the order to `CANCELLED` when all lines are fully cancelled.

**Quantity semantics:** Over-cancellation is rejected by core `BusinessRuleError` (422) — quantities are never silently clamped at the compatibility boundary.

**Authorization:** `cancellations.create`. Authentication via Bearer JWT or API key.

**Cancellation identity:** External contract describes `MerchantCancellationNo` as the merchant's unique cancellation reference; it appears in list filters (`MerchantCancellationNos`). Persisted as provider-neutral `cancellations.external_reference` with PostgreSQL uniqueness on `(tenant_id, external_reference)`.

**Duplicate `MerchantCancellationNo` behavior (distinct from HTTP idempotency):**

| Scenario | Behavior |
| -------- | -------- |
| Same `Idempotency-Key` + same payload | HTTP idempotency replay (201) |
| Same `Idempotency-Key` + different payload | HTTP idempotency conflict (409) |
| Different keys + same `MerchantCancellationNo` + equivalent payload | Business identity replay — existing cancellation returned (201), no duplicate fulfillment side effects |
| Different keys + same `MerchantCancellationNo` + different payload | Conflict (409) — no merge/overwrite |
| Same reference on a different order | Conflict (409) |

**Idempotency:** Required `Idempotency-Key` header; transactional ledger via `PostgresIdempotencyService` (`useTransaction: true`). Fingerprint includes `merchantCancellationNo`, mapped order/lines, and reason.

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 201, Message: null }` — no fabricated integer IDs or cancellation payload.

## `POST /api/v2/orders` — implemented notes (2026-09-22)

**External operation:** `POST /v2/orders` — Channel API order ingestion (not Merchant create).

**Channel context (not in Channel request body):**

| Source | Nexora mapping |
| ------ | -------------- |
| Channel-scoped API key | `api_keys.channel_id` → `ChannelQueryService.verifyChannelUsable` |
| Bearer JWT (Nexora extension) | `X-Channel-Reference` header → `ChannelQueryService.getChannelByExternalReference` |

**Stock location (OQ-7-07):**

| Source | Nexora mapping |
| ------ | -------------- |
| `channels.configurationReference` | Must contain the Nexora stock location UUID applied to every ingested line |

When `configurationReference` is missing or not a UUID, ingest returns `422`. No default stock location is inferred.

**Request mapping (verified Channel OpenAPI):**

| External field | Nexora mapping |
| -------------- | -------------- |
| `ChannelOrderNo` | `orders.external_order_reference` |
| `CurrencyCode` | order currency |
| `ShippingCostsInclVat` | `shippingMinor` (decimal → minor units) |
| `Email`, `Phone` | customer snapshot |
| `BillingAddress`, `ShippingAddress` | customer billing/shipping addresses |
| `Lines[].MerchantProductNo` | SKU-first product resolution (`merchantSku`) |
| `Lines[].ChannelProductNo` | offer external reference when SKU lookup fails |
| `Lines[].Quantity` | line quantity |
| `Lines[].UnitPriceInclVat` | accepted for contract compliance; pricing comes from Nexora `PricingService` |

**Intentionally unsupported / ignored:**

| External field | Reason |
| -------------- | ------ |
| Integer `ChannelId` in body | Not present on Channel create request; channel comes from auth/context |
| Per-line stock location | Not in Channel create contract; resolved from channel configuration |
| `OrderDate`, `CommercialOrderNo`, service lines, fees | No persisted Nexora fields in Phase 7.2 scope |

**Behavior:** Maps to `OrderCommandService.createChannelOrder` — creates `NEW` orders, reserves inventory in the same transaction, emits `order.created` only (no `order.confirmed`).

**Authorization:** `orders.ingest`. Authentication via Bearer JWT or API key.

**Idempotency:** Required `Idempotency-Key` header; transactional ledger via `PostgresIdempotencyService` (`useTransaction: true`, `routeId=POST /api/v2/orders`). Business deduplication on `(tenant_id, channel_id, external_order_reference)`.

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 201, Content: <mapped order summary> }` with external status `NEW`, `MerchantOrderNo`, and `ChannelOrderNo`. Integer `Id` / `ChannelId` omitted per identifier policy.

## `POST /api/v2/orders/channel-fulfilled` — implemented notes (2026-09-22)

**External operation:** `POST /v2/orders/channel-fulfilled` — Channel API channel-fulfilled order ingestion.

**Channel context:** Same as `POST /api/v2/orders` — channel-scoped API key or Bearer `X-Channel-Reference`.

**Stock location:** Same as `POST /api/v2/orders` — `channels.configurationReference` must contain the Nexora stock location UUID.

**Request mapping:** Reuses the verified Channel create request schema (`ChannelOrderRequestModel`). Shipment metadata is derived from the order request:

| External field | Nexora mapping |
| -------------- | -------------- |
| `ChannelOrderNo` | `orders.external_order_reference` |
| `ShippingMethod` | shipment `carrier` |
| `ShippingServiceLevel` | shipment `service` |
| (derived) | shipment `externalReference` = `{ChannelOrderNo}-fulfillment` |

Line, customer, currency, and product resolution match `POST /api/v2/orders`.

**Behavior:** Maps to `OrderCommandService.createChannelFulfilledOrder` — creates `CONFIRMED` orders (no inventory reservation), auto-creates a shipment with full line quantities, ships via `ShipShipment`, and evaluates order shipment state. Final order status `SHIPPED`.

**Events (successful full fulfillment):** `order.created`, `order.confirmed`, `shipment.created`, `shipment.shipped`, `shipment.status_changed`, `order.status_changed` — each once via existing domain/application emission.

**Authorization:** `orders.ingest_channel_fulfilled` (distinct from `orders.ingest`). Authentication via Bearer JWT or API key.

**Idempotency:** Required `Idempotency-Key` header; transactional ledger via `PostgresIdempotencyService` (`useTransaction: true`, `routeId=POST /api/v2/orders/channel-fulfilled`). Business deduplication on `(tenant_id, channel_id, external_order_reference)` shared with standard channel ingest.

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 201, Content: <mapped order summary> }` with external status `SHIPPED`, `MerchantOrderNo`, and `ChannelOrderNo`.

## `POST /api/v2/orders/acknowledge` — implemented notes (2026-09-21)

**Request mapping:**

| External field | Nexora mapping |
| -------------- | -------------- |
| `MerchantOrderNo` | `orders.order_number` (lookup key) |
| `OrderId` | Accepted because it is required by the external request schema, but Nexora resolves the order by `MerchantOrderNo`/`orderNumber` and does **not** persist or independently verify the external integer `OrderId` |

**Behavior:** Single order per request (external contract is not a batch array). Maps to existing `ConfirmOrder` domain operation via `OrderCommandService.acknowledgeOrder`.

**State transition:** `NEW → CONFIRMED` (or idempotent no-op when already `CONFIRMED`). Invalid states return `422`.

**Authorization:** `orders.update` (same as native confirm). Authentication via Bearer JWT or API key.

**Idempotency:** Required `Idempotency-Key` header; transactional ledger via `PostgresIdempotencyService` (`useTransaction: true`).

**Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.

**Response:** `{ Success: true, StatusCode: 201, Message: null }` — no fabricated integer IDs or order payload in response.

**OrderId limitation:** The external Merchant schema requires both fields on the request. Nexora uses `MerchantOrderNo` as the sole lookup key. `OrderId` is accepted for contract compliance (the external docs note it does not have to be saved) but is not stored, validated against a mapping, or echoed in the response. Clients that require strict `OrderId` correlation must retain it externally; `GET /api/v2/orders/new` does not return integer `OrderId`.

## `GET /api/v2/shipments/merchant` — implemented read notes (2026-09-22)

**External operation:** `GET /v2/shipments/merchant` — lists shipments oldest-first.

**Authorization:** `shipments.read`. **Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.read`.

**Pagination:** `Page` + `ItemsPerPage` (compatibility boundary; default page size 50, max 100) → `ShipmentQueryService.listShipments`.

**Supported filters:**

| External parameter | Nexora mapping |
| ------------------ | -------------- |
| `MerchantShipmentNos` | `externalReferences[]` on shipments |
| `MerchantOrderNos` | Join `orders.order_number` |
| `ChannelOrderNos` | Join `orders.external_order_reference` |
| `Method` | `shipments.carrier` |
| `FromShipmentDate` / `ToShipmentDate` | `shipped_at` inclusive/exclusive |
| `FromCreateDate` / `ToCreateDate` | `created_at` inclusive/exclusive |
| `FromUpdateDate` / `ToUpdateDate` | `updated_at` inclusive/exclusive |
| `FromDeliveredAt` / `ToDeliveredAt` | `delivered_at` inclusive/exclusive |

**Intentionally unsupported (omitted from schema — silently ignored if sent):**

| External parameter | Reason |
| ------------------ | ------ |
| `ShippedFromCountryCodes`, `FulfillmentType` | No persisted fields |
| `ChannelShipmentNos`, `ChannelId` | No channel shipment integer IDs |
| `ChannelExportStatus`, `ChannelExportAttempts` | No export pipeline state |

**Response mapping:** `MerchantShipmentNo` ← `externalReference`; lines map `MerchantProductNo` from order line `merchantSku`. Integer `Id`, `ChannelId`, `ChannelExportStatus`, and line integer IDs are **omitted** (not required by response schema).

**Tenant isolation:** All queries scoped by authenticated `tenantId`.

## `GET /api/v2/cancellations/merchant` — implemented read notes (2026-09-22)

**External operation:** `GET /v2/cancellations/merchant` — lists cancellations by creation date.

**Authorization:** `cancellations.read`. **Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.read`.

**Pagination:** `Page` + `ItemsPerPage` → `CancellationQueryService.listCancellations` (oldest-first).

**Supported filters:**

| External parameter | Nexora mapping |
| ------------------ | -------------- |
| `MerchantCancellationNos` | `externalReferences[]` |
| `MerchantOrderNos` | Join `orders.order_number` |
| `ChannelOrderNos` | Join `orders.external_order_reference` |
| `CreatedSince` / `CreatedTo` | `created_at` inclusive/exclusive |
| `UpdatedSince` / `UpdatedTo` | `updated_at` inclusive/exclusive |

**Response mapping:** Required fields `MerchantCancellationNo`, `MerchantOrderNo`, `Lines` mapped from core DTOs. Integer cancellation/line IDs **omitted**.

**Tenant isolation:** All queries scoped by authenticated `tenantId`.

## `GET /api/v2/returns/merchant` (+ `/new`, `/{merchantOrderNo}`) — implemented read notes (2026-09-22)

**Verified external paths:**

| External | Nexora |
| -------- | ------ |
| `GET /v2/returns/merchant` | `GET /api/v2/returns/merchant` |
| `GET /v2/returns/merchant/new` | `GET /api/v2/returns/merchant/new` |
| `GET /v2/returns/merchant/{merchantOrderNo}` | `GET /api/v2/returns/merchant/:merchantOrderNo` |

**Not in Merchant OpenAPI:** `GET /v2/returns/{merchantReturnNo}` — single-return lookup by merchant return number is **not implemented**. Use list filters or the by-order endpoint.

**Authorization:** `returns.read`. **Rate limit:** `COMPATIBILITY_RATE_LIMIT_POLICIES.read`.

**Pagination:** `Page` + `ItemsPerPage` on list endpoints; by-order endpoint returns all returns for the order (up to core max page size 100).

**`/merchant/new` semantics:** External docs describe status **In progress** (`ReturnStatus.IN_PROGRESS`). Mapped to Nexora `REQUESTED`, `APPROVED`, and `RECEIVED` — returns not yet terminal/handled. Merchant-created returns start as `REQUESTED` and appear here.

**Status mapping (response):**

| Nexora status | External status |
| ------------- | ----------------- |
| `REQUESTED`, `APPROVED`, `RECEIVED` | `IN_PROGRESS` |
| `COMPLETED` | `HANDLED` |
| `CANCELLED`, `REJECTED` | `CANCELLED` |

**Supported list filters:**

| External parameter | Nexora mapping |
| ------------------ | -------------- |
| `MerchantOrderNos` | Join `orders.order_number` |
| `ChannelOrderNos` | Join `orders.external_order_reference` |
| `Statuses` | External → Nexora status set (see mapper) |
| `Reasons` | `returns.reason` exact match |
| `FromDate` / `ToDate` | `created_at` inclusive/exclusive |
| `FromUpdateDate` / `ToUpdateDate` | `updated_at` inclusive/exclusive |

**Intentionally unsupported:**

| External parameter | Reason |
| ------------------ | ------ |
| `ChannelIds`, `FulfillmentType`, `IsAcknowledged` | No compatible persisted fields |
| `MerchantReturnNos` on this endpoint | Not present in verified OpenAPI for `GET /v2/returns/merchant` |

**By-order endpoint:** Resolves order by `MerchantOrderNo` (= Nexora `order_number`). Returns `404` when order missing. Cross-tenant order numbers are not accessible.

**Response mapping:** `MerchantReturnNo` ← `externalReference`; `ChannelName` from `ChannelQueryService`. Integer return/line IDs **omitted**.

**Tenant isolation:** All queries scoped by authenticated `tenantId`.

## Phase 5.1 security hardening (2026-09-21)

| Control | Status |
| ------- | ------ |
| API key create requires `api_keys.manage` | **Enforced** in `CreateApiKeyUseCase` |
| PostgreSQL RLS runtime role (`nexora_app`) | **Migration 0030** — see [postgres-rls.md](postgres-rls.md) |
| `/api/v2` rate limits | **`COMPATIBILITY_RATE_LIMIT_POLICIES`** — read + mutation categories |
| Mutation idempotency convention | Documented — [compatibility-idempotency.md](compatibility-idempotency.md) |
| Customer PII on order reads | **Open product decision** — `orders.read` exposes PII on v2 responses |
| Step-up on admin operations | **Backlog** — rotate only today; see Phase 5.1 report |

## Architectural rules (enforced)

| Rule | Enforcement |
| ---- | ----------- |
| Core → compatibility forbidden | `core-no-compatibility` |
| Compatibility → no direct persistence | `compatibility-no-direct-persistence` |
| Compatibility → public contracts only | `compatibility-no-module-index-imports`, `no-cross-module-internals` |
| No hybrid Merchant/Channel semantics | [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md) |

## Maintenance

1. Update this matrix when an endpoint moves from Planned → Implemented (link PR + contract test).
2. Do not implement Channel ingestion rows until explicit product sign-off.
3. Do not add `POST /api/v2/orders` as order creation on the Merchant surface.

## Reference

- [compatibility.md](compatibility.md) — layer design
- [module-boundaries.md](module-boundaries.md) — dependency rules
- [api-strategy.md](api-strategy.md) — versioning policy
- [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md)
