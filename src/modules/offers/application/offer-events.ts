import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { OfferDto } from './offer-dto.js';

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function offerPayload(offer: OfferDto): Readonly<Record<string, unknown>> {
  return {
    id: offer.id,
    tenantId: offer.tenantId,
    productId: offer.productId,
    channelId: offer.channelId,
    status: offer.status,
    externalReference: offer.externalReference,
    priceReference: offer.priceReference,
    listingStatus: offer.listingStatus,
  };
}

export function offerCreatedEvent(offer: OfferDto): NewIntegrationEvent {
  return {
    type: 'offer.created',
    version: 1,
    aggregateType: 'offer',
    aggregateId: offer.id,
    tenantId: offer.tenantId,
    payload: offerPayload(offer),
    correlationId: correlationId(),
  };
}

export function offerUpdatedEvent(
  offer: OfferDto,
  changes: Readonly<Record<string, unknown>>,
): NewIntegrationEvent {
  return {
    type: 'offer.updated',
    version: 1,
    aggregateType: 'offer',
    aggregateId: offer.id,
    tenantId: offer.tenantId,
    payload: {
      ...offerPayload(offer),
      changes,
    },
    correlationId: correlationId(),
  };
}

export function offerStatusChangedEvent(
  offer: OfferDto,
  previousStatus: string,
): NewIntegrationEvent {
  return {
    type: 'offer.status_changed',
    version: 1,
    aggregateType: 'offer',
    aggregateId: offer.id,
    tenantId: offer.tenantId,
    payload: {
      ...offerPayload(offer),
      previousStatus,
    },
    correlationId: correlationId(),
  };
}
