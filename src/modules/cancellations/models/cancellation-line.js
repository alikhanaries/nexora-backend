/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   cancellationId: string,
 *   orderLineId: string,
 *   quantity: number,
 *   createdAt: Date,
 * }} CancellationLine
 */

/**
 * @param {Omit<CancellationLine, 'createdAt'> & { createdAt?: Date }} props
 * @returns {CancellationLine}
 */
export function createCancellationLineEntity(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        cancellationId: props.cancellationId,
        orderLineId: props.orderLineId,
        quantity: props.quantity,
        createdAt: props.createdAt ?? new Date(),
    };
}

/**
 * @param {CancellationLine} props
 * @returns {CancellationLine}
 */
export function reconstituteCancellationLine(props) {
    return { ...props };
}
