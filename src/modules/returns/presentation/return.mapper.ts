import type { ReturnDetailDto } from '../application/return-dto.js';
import type { returnResponseSchema } from './return.schemas.js';
import type { z } from 'zod';

export type ReturnResponse = z.infer<typeof returnResponseSchema>;

export function toReturnResponse(returnDetail: ReturnDetailDto): ReturnResponse {
  return {
    id: returnDetail.id,
    tenantId: returnDetail.tenantId,
    orderId: returnDetail.orderId,
    shipmentId: returnDetail.shipmentId,
    status: returnDetail.status,
    reason: returnDetail.reason,
    createdAt: returnDetail.createdAt.toISOString(),
    updatedAt: returnDetail.updatedAt.toISOString(),
    receivedAt: returnDetail.receivedAt?.toISOString() ?? null,
    completedAt: returnDetail.completedAt?.toISOString() ?? null,
    lines: returnDetail.lines.map((line) => ({
      id: line.id,
      tenantId: line.tenantId,
      returnId: line.returnId,
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      reason: line.reason,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    })),
  };
}
