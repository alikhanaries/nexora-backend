/** Maps an internal price record shape into an API-safe PriceDto object (dates serialized where needed). */
export function toPriceDto(price) {
    return {
        id: price.id,
        tenantId: price.tenantId,
        productId: price.productId,
        channelId: price.channelId,
        currency: price.currency,
        amountMinor: price.amountMinor,
        validFrom: price.validFrom,
        validTo: price.validTo,
        status: price.status,
        createdAt: price.createdAt,
        updatedAt: price.updatedAt,
    };
}
