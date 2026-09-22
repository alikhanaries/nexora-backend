/**
 * ISO 4217 minor-unit exponents for currencies that differ from the common default (2).
 *
 * Nexora stores amounts as integer minor units per ISO 4217. Most currencies use 2 decimal
 * places; this table covers the exceptions Nexora must handle when converting to decimals.
 *
 * Unknown currencies default to exponent 2 — the same implicit convention used across pricing
 * and order flows today.
 */
const NON_DEFAULT_CURRENCY_EXPONENTS = {
    BHD: 3,
    CLP: 0,
    DJF: 0,
    GNF: 0,
    ISK: 0,
    IQD: 3,
    JOD: 3,
    JPY: 0,
    KMF: 0,
    KRW: 0,
    KWD: 3,
    LYD: 3,
    OMR: 3,
    PYG: 0,
    RWF: 0,
    TND: 3,
    UGX: 0,
    UYI: 0,
    VND: 0,
    VUV: 0,
    XAF: 0,
    XOF: 0,
    XPF: 0,
};

const DEFAULT_MINOR_UNIT_EXPONENT = 2;

/**
 * @param {string} currency Normalized ISO 4217 code.
 * @returns {number}
 */
export function getCurrencyMinorUnitExponent(currency) {
    return NON_DEFAULT_CURRENCY_EXPONENTS[currency] ?? DEFAULT_MINOR_UNIT_EXPONENT;
}
