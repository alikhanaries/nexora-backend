/** Shared GraphQL selection for Admin API Order (orders query + order query). */
export const SHOPIFY_ORDER_FIELDS = `
  id
  name
  cancelledAt
  displayFinancialStatus
  displayFulfillmentStatus
  currencyCode
  currentSubtotalPriceSet { shopMoney { amount currencyCode } }
  currentTotalDiscountsSet { shopMoney { amount currencyCode } }
  currentTotalTaxSet { shopMoney { amount currencyCode } }
  totalShippingPriceSet { shopMoney { amount currencyCode } }
  currentTotalPriceSet { shopMoney { amount currencyCode } }
  customer {
    id
    firstName
    lastName
    email
    phone
  }
  shippingAddress {
    address1
    address2
    city
    provinceCode
    zip
    countryCodeV2
  }
  billingAddress {
    address1
    address2
    city
    provinceCode
    zip
    countryCodeV2
  }
  lineItems(first: 100) {
    edges {
      node {
        id
        sku
        quantity
        variant {
          id
          sku
        }
        originalUnitPriceSet { shopMoney { amount currencyCode } }
      }
    }
  }
`;

export const SHOPIFY_ORDERS_LIST_QUERY = `
  query ShopifyOrdersList($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      edges {
        node {
          ${SHOPIFY_ORDER_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const SHOPIFY_ORDER_BY_ID_QUERY = `
  query ShopifyOrderById($id: ID!) {
    order(id: $id) {
      ${SHOPIFY_ORDER_FIELDS}
    }
  }
`;
