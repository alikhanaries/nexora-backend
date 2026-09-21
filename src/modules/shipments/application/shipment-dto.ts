import type { ShipmentLine } from '../domain/shipment-line.js';
import type { Shipment } from '../domain/shipment.js';

export interface ShipmentLineDto {
  readonly id: string;
  readonly tenantId: string;
  readonly shipmentId: string;
  readonly orderLineId: string;
  readonly quantity: number;
  readonly createdAt: Date;
}

export interface ShipmentDto {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly carrier: string | null;
  readonly service: string | null;
  readonly trackingNumber: string | null;
  readonly status: string;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ShipmentDetailDto extends ShipmentDto {
  readonly lines: readonly ShipmentLineDto[];
}

export function toShipmentDto(shipment: Shipment): ShipmentDto {
  return {
    id: shipment.id,
    tenantId: shipment.tenantId,
    orderId: shipment.orderId,
    carrier: shipment.carrier,
    service: shipment.service,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

export function toShipmentLineDto(line: ShipmentLine): ShipmentLineDto {
  return {
    id: line.id,
    tenantId: line.tenantId,
    shipmentId: line.shipmentId,
    orderLineId: line.orderLineId,
    quantity: line.quantity,
    createdAt: line.createdAt,
  };
}

export function toShipmentDetailDto(
  shipment: Shipment,
  lines: readonly ShipmentLine[],
): ShipmentDetailDto {
  return {
    ...toShipmentDto(shipment),
    lines: lines.map(toShipmentLineDto),
  };
}
