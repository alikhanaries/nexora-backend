/**
 * Product/catalog command ports wired at the composition root for CE catalog compatibility.
 * Use cases are passed from module factories — compatibility never imports other modules' application layers.
 *
 * @typedef {object} CompatibilityCatalogCommands
 * @property {{ execute: (input: object) => Promise<object> }} createProduct
 * @property {{ execute: (input: object) => Promise<object> }} deactivateProduct
 * @property {{ execute: (input: object) => Promise<object> }} upsertProductContent
 * @property {{ execute: (input: object) => Promise<object> }} getProductContent
 * @property {{ execute: (input: object) => Promise<object> }} createPrice
 * @property {{ execute: (input: object) => Promise<object> }} updatePrice
 * @property {{ execute: (input: object) => Promise<object> }} createOffer
 * @property {{ execute: (input: object) => Promise<object> }} activateOffer
 * @property {{ execute: (input: object) => Promise<object> }} suspendOffer
 * @property {{ execute: (input: object) => Promise<object> }} adjustInventory
 */

export {};
