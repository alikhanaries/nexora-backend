import type { CancellationLine } from '../domain/cancellation-line.js';
import type { Cancellation } from '../domain/cancellation.js';

export interface CancellationLineDto {
  readonly id: string;
  readonly tenantId: string;
  readonly cancellationId: string;
  readonly orderLineId: string;
  readonly quantity: number;
  readonly createdAt: Date;
}

export interface CancellationDto {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly status: string;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export interface CancellationDetailDto extends CancellationDto {
  readonly lines: readonly CancellationLineDto[];
}

export function toCancellationDto(cancellation: Cancellation): CancellationDto {
  return {
    id: cancellation.id,
    tenantId: cancellation.tenantId,
    orderId: cancellation.orderId,
    status: cancellation.status,
    reason: cancellation.reason,
    createdAt: cancellation.createdAt,
    updatedAt: cancellation.updatedAt,
    completedAt: cancellation.completedAt,
  };
}

export function toCancellationLineDto(line: CancellationLine): CancellationLineDto {
  return {
    id: line.id,
    tenantId: line.tenantId,
    cancellationId: line.cancellationId,
    orderLineId: line.orderLineId,
    quantity: line.quantity,
    createdAt: line.createdAt,
  };
}
