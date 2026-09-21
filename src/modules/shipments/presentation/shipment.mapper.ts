import type {
  ShipmentDetailDto,
  ShipmentDto,
  ShipmentLineDto,
} from '../application/shipment-dto.js';
import type { shipmentDetailResponseSchema, shipmentResponseSchema } from './shipment.schemas.js';
import type { z } from 'zod';

export type ShipmentResponse = z.infer<typeof shipmentResponseSchema>;
export type ShipmentDetailResponse = z.infer<typeof shipmentDetailResponseSchema>;

export function toShipmentResponse(shipment: ShipmentDto): ShipmentResponse {
  return {
    id: shipment.id,
    tenantId: shipment.tenantId,
    orderId: shipment.orderId,
    carrier: shipment.carrier,
    service: shipment.service,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status as ShipmentResponse['status'],
    shippedAt: shipment.shippedAt?.toISOString() ?? null,
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
  };
}

export function toShipmentLineResponse(
  line: ShipmentLineDto,
): ShipmentDetailResponse['lines'][number] {
  return {
    id: line.id,
    tenantId: line.tenantId,
    shipmentId: line.shipmentId,
    orderLineId: line.orderLineId,
    quantity: line.quantity,
    createdAt: line.createdAt.toISOString(),
  };
}

export function toShipmentDetailResponse(shipment: ShipmentDetailDto): ShipmentDetailResponse {
  return {
    ...toShipmentResponse(shipment),
    lines: shipment.lines.map(toShipmentLineResponse),
  };
}
