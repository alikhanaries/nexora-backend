/**
 * Reads authoritative available quantity for a single stock location from
 * `InventoryService.getAvailability` output.
 *
 * @param {{ locations: Array<{ stockLocationId: string, available: number }> }} availability
 * @param {string} stockLocationId
 */
export function readAvailableQuantityAtLocation(availability, stockLocationId) {
    const location = availability.locations.find((entry) => entry.stockLocationId === stockLocationId);
    return location === undefined ? 0 : location.available;
}
