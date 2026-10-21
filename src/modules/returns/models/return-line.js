/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   returnId: string,
 *   orderLineId: string,
 *   quantity: number,
 *   reason: string | null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} ReturnLine
 */

/**
 * @param {Omit<ReturnLine, 'createdAt' | 'updatedAt'> & { createdAt?: Date, updatedAt?: Date }} props
 * @returns {ReturnLine}
 */
export function createReturnLineEntity(props) {
    const now = props.createdAt ?? new Date();
    return {
        id: props.id,
        tenantId: props.tenantId,
        returnId: props.returnId,
        orderLineId: props.orderLineId,
        quantity: props.quantity,
        reason: props.reason,
        createdAt: now,
        updatedAt: props.updatedAt ?? now,
    };
}

/**
 * @param {ReturnLine} props
 * @returns {ReturnLine}
 */
export function reconstituteReturnLine(props) {
    return { ...props };
}
