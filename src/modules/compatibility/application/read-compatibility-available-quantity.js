/**
 * Reads available quantity for a stock location from InventoryService.getAvailability output.
 *
 * @param {{ locations: Array<{ stockLocationId: string, available: number }> }} availability
 * @param {string} stockLocationId
 */
export function readCompatibilityAvailableQuantity(availability, stockLocationId) {
    const location = availability.locations.find((entry) => entry.stockLocationId === stockLocationId);
    return location === undefined ? 0 : location.available;
}
