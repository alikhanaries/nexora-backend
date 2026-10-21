/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   shipmentId: string,
 *   orderLineId: string,
 *   quantity: number,
 *   createdAt: Date,
 * }} ShipmentLine
 */

/**
 * @param {Omit<ShipmentLine, 'createdAt'> & { createdAt?: Date }} props
 * @returns {ShipmentLine}
 */
export function createShipmentLineEntity(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        shipmentId: props.shipmentId,
        orderLineId: props.orderLineId,
        quantity: props.quantity,
        createdAt: props.createdAt ?? new Date(),
    };
}

/**
 * @param {ShipmentLine} props
 * @returns {ShipmentLine}
 */
export function reconstituteShipmentLine(props) {
    return { ...props };
}
