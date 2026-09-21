import type { ReturnLine } from '../domain/return-line.js';
import type { Return } from '../domain/return.js';
import type { ReturnStatus } from '../domain/return-status.js';

export interface ReturnLineDto {
  readonly id: string;
  readonly tenantId: string;
  readonly returnId: string;
  readonly orderLineId: string;
  readonly quantity: number;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ReturnDto {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly shipmentId: string | null;
  readonly status: ReturnStatus;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly receivedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface ReturnDetailDto extends ReturnDto {
  readonly lines: readonly ReturnLineDto[];
}

export function toReturnDto(returnEntity: Return): ReturnDto {
  return {
    id: returnEntity.id,
    tenantId: returnEntity.tenantId,
    orderId: returnEntity.orderId,
    shipmentId: returnEntity.shipmentId,
    status: returnEntity.status,
    reason: returnEntity.reason,
    createdAt: returnEntity.createdAt,
    updatedAt: returnEntity.updatedAt,
    receivedAt: returnEntity.receivedAt,
    completedAt: returnEntity.completedAt,
  };
}

export function toReturnLineDto(line: ReturnLine): ReturnLineDto {
  return {
    id: line.id,
    tenantId: line.tenantId,
    returnId: line.returnId,
    orderLineId: line.orderLineId,
    quantity: line.quantity,
    reason: line.reason,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
  };
}

export function toReturnDetailDto(
  returnEntity: Return,
  lines: readonly ReturnLine[],
): ReturnDetailDto {
  return {
    ...toReturnDto(returnEntity),
    lines: lines.map(toReturnLineDto),
  };
}
