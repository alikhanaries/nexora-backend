import type {
  CancellationDetailDto,
  CancellationDto,
  CancellationLineDto,
} from '../application/cancellation-dto.js';
import type {
  cancellationLineResponseSchema,
  cancellationResponseSchema,
} from './cancellation.schemas.js';
import type { z } from 'zod';

export type CancellationLineResponse = z.infer<typeof cancellationLineResponseSchema>;
export type CancellationResponse = z.infer<typeof cancellationResponseSchema>;

function toCancellationLineResponse(line: CancellationLineDto): CancellationLineResponse {
  return {
    id: line.id,
    tenantId: line.tenantId,
    cancellationId: line.cancellationId,
    orderLineId: line.orderLineId,
    quantity: line.quantity,
    createdAt: line.createdAt.toISOString(),
  };
}

export function toCancellationResponse(cancellation: CancellationDto): CancellationResponse {
  return {
    id: cancellation.id,
    tenantId: cancellation.tenantId,
    orderId: cancellation.orderId,
    status: cancellation.status as CancellationResponse['status'],
    reason: cancellation.reason,
    createdAt: cancellation.createdAt.toISOString(),
    updatedAt: cancellation.updatedAt.toISOString(),
    completedAt: cancellation.completedAt?.toISOString() ?? null,
  };
}

export function toCancellationDetailResponse(
  cancellation: CancellationDetailDto,
): CancellationResponse {
  return {
    ...toCancellationResponse(cancellation),
    lines: cancellation.lines.map(toCancellationLineResponse),
  };
}
