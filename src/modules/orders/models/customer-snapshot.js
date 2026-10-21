/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   orderId: string,
 *   externalCustomerReference: string | null,
 *   firstName: string | null,
 *   lastName: string | null,
 *   email: string | null,
 *   phone: string | null,
 *   companyName: string | null,
 *   billingAddress: object | null,
 *   shippingAddress: object | null,
 *   metadata: Record<string, unknown>,
 *   createdAt: Date,
 * }} CustomerSnapshot
 */

/**
 * @param {Omit<CustomerSnapshot, 'createdAt'> & { createdAt?: Date }} props
 * @returns {CustomerSnapshot}
 */
export function createCustomerSnapshotEntity(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        orderId: props.orderId,
        externalCustomerReference: props.externalCustomerReference,
        firstName: props.firstName,
        lastName: props.lastName,
        email: props.email,
        phone: props.phone,
        companyName: props.companyName,
        billingAddress: props.billingAddress,
        shippingAddress: props.shippingAddress,
        metadata: props.metadata,
        createdAt: props.createdAt ?? new Date(),
    };
}

/**
 * @param {CustomerSnapshot} props
 * @returns {CustomerSnapshot}
 */
export function reconstituteCustomerSnapshot(props) {
    return { ...props };
}
