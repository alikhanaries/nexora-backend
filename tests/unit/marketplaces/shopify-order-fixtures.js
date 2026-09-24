function money(amount, currencyCode = 'USD') {
    return { shopMoney: { amount: String(amount), currencyCode } };
}

export function buildShopifyGraphqlOrder(overrides = {}) {
    return {
        id: 'gid://shopify/Order/1001',
        name: '#1001',
        cancelledAt: null,
        displayFinancialStatus: 'PAID',
        displayFulfillmentStatus: 'UNFULFILLED',
        currencyCode: 'USD',
        currentSubtotalPriceSet: money(20),
        currentTotalDiscountsSet: money(0),
        currentTotalTaxSet: money(2),
        totalShippingPriceSet: money(5),
        currentTotalPriceSet: money(27),
        customer: {
            id: 'gid://shopify/Customer/9',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
            phone: '+15551234567',
        },
        shippingAddress: {
            address1: '123 Main St',
            address2: null,
            city: 'Boston',
            provinceCode: 'MA',
            zip: '02101',
            countryCodeV2: 'US',
        },
        billingAddress: {
            address1: '123 Main St',
            address2: 'Suite 1',
            city: 'Boston',
            provinceCode: 'MA',
            zip: '02101',
            countryCodeV2: 'US',
        },
        lineItems: {
            edges: [{
                node: {
                    id: 'gid://shopify/LineItem/1',
                    sku: 'WIDGET-1',
                    quantity: 2,
                    variant: { id: 'gid://shopify/ProductVariant/55', sku: 'WIDGET-1' },
                    originalUnitPriceSet: money(10),
                },
            }],
        },
        ...overrides,
    };
}
