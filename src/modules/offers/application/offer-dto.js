export function toOfferDto(offer) {
    return {
        id: offer.id,
        tenantId: offer.tenantId,
        productId: offer.productId,
        channelId: offer.channelId,
        status: offer.status,
        externalReference: offer.externalReference,
        priceReference: offer.priceReference,
        listingStatus: offer.listingStatus,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
    };
}
