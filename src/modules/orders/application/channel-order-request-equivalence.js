/**
 * @param {object} existingOrder
 * @param {object[]} existingLines
 * @param {object|null} existingCustomer
 * @param {object} input
 * @param {object[]} resolvedLines
 */
export function isEquivalentChannelOrderRequest(existingOrder, existingLines, existingCustomer, input, resolvedLines) {
    if (existingOrder.channelId !== input.channelId) {
        return false;
    }
    if (existingOrder.currency !== input.currency) {
        return false;
    }
    const discountMinor = input.discountMinor ?? 0;
    const taxMinor = input.taxMinor ?? 0;
    const shippingMinor = input.shippingMinor ?? 0;
    if (existingOrder.discountMinor !== discountMinor
        || existingOrder.taxMinor !== taxMinor
        || existingOrder.shippingMinor !== shippingMinor) {
        return false;
    }
    const existingLineSnapshot = normalizeLines(existingLines.map((line) => ({
        productId: line.productId,
        stockLocationId: line.stockLocationId,
        quantity: line.quantity,
        offerId: line.offerId,
    })));
    const requestedLineSnapshot = normalizeLines(resolvedLines.map((line) => ({
        productId: line.productId,
        stockLocationId: line.input.stockLocationId,
        quantity: line.input.quantity,
        offerId: line.offerId,
    })));
    if (existingLineSnapshot.length !== requestedLineSnapshot.length) {
        return false;
    }
    return existingLineSnapshot.every((line, index) => (
        line.productId === requestedLineSnapshot[index].productId
        && line.stockLocationId === requestedLineSnapshot[index].stockLocationId
        && line.quantity === requestedLineSnapshot[index].quantity
        && line.offerId === requestedLineSnapshot[index].offerId
    )) && isEquivalentCustomer(existingCustomer, input.customer ?? {});
}

/**
 * @param {Array<{ productId: string, stockLocationId: string, quantity: number, offerId: string|null }>} lines
 */
function normalizeLines(lines) {
    return [...lines].sort((a, b) => {
        const productCompare = a.productId.localeCompare(b.productId);
        if (productCompare !== 0) {
            return productCompare;
        }
        const locationCompare = a.stockLocationId.localeCompare(b.stockLocationId);
        if (locationCompare !== 0) {
            return locationCompare;
        }
        return a.quantity - b.quantity;
    });
}

/**
 * @param {object|null} existingCustomer
 * @param {object} customerInput
 */
function isEquivalentCustomer(existingCustomer, customerInput) {
    const normalizedExisting = normalizeCustomerSnapshot(existingCustomer);
    const normalizedRequested = normalizeCustomerInput(customerInput);
    return JSON.stringify(normalizedExisting) === JSON.stringify(normalizedRequested);
}

/**
 * @param {object|null} customer
 */
function normalizeCustomerSnapshot(customer) {
    if (customer === null) {
        return normalizeCustomerInput({});
    }
    return {
        externalCustomerReference: customer.externalCustomerReference ?? null,
        firstName: customer.firstName ?? null,
        lastName: customer.lastName ?? null,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        companyName: customer.companyName ?? null,
        billingAddress: customer.billingAddress ?? null,
        shippingAddress: customer.shippingAddress ?? null,
        metadata: customer.metadata ?? {},
    };
}

/**
 * @param {object} customerInput
 */
function normalizeCustomerInput(customerInput) {
    return {
        externalCustomerReference: trimOrNull(customerInput.externalCustomerReference),
        firstName: trimOrNull(customerInput.firstName),
        lastName: trimOrNull(customerInput.lastName),
        email: trimOrNull(customerInput.email),
        phone: trimOrNull(customerInput.phone),
        companyName: trimOrNull(customerInput.companyName),
        billingAddress: customerInput.billingAddress ?? null,
        shippingAddress: customerInput.shippingAddress ?? null,
        metadata: customerInput.metadata ?? {},
    };
}

/**
 * @param {string|null|undefined} value
 */
function trimOrNull(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
