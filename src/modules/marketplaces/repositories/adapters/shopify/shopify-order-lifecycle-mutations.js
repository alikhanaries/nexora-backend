export const SHOPIFY_ORDER_CANCEL_MUTATION = `
mutation ShopifyOrderCancel($orderId: ID!, $reason: OrderCancelReason!, $restock: Boolean!, $notifyCustomer: Boolean, $refundMethod: OrderCancelRefundMethodInput!) {
  orderCancel(orderId: $orderId, reason: $reason, restock: $restock, notifyCustomer: $notifyCustomer, refundMethod: $refundMethod) {
    job { id done }
    orderCancelUserErrors { field message code }
    userErrors { field message }
  }
}`;

export const SHOPIFY_REFUND_CREATE_MUTATION = `
mutation ShopifyRefundCreate($input: RefundInput!) {
  refundCreate(input: $input) {
    refund { id }
    userErrors { field message }
  }
}`;

export const SHOPIFY_FULFILLMENT_ORDERS_QUERY = `
query ShopifyFulfillmentOrders($orderId: ID!) {
  order(id: $orderId) {
    id
    fulfillmentOrders(first: 10) {
      edges {
        node {
          id
          lineItems(first: 50) {
            edges {
              node {
                id
                remainingQuantity
                lineItem { id }
              }
            }
          }
        }
      }
    }
  }
}`;

export const SHOPIFY_FULFILLMENT_CREATE_MUTATION = `
mutation ShopifyFulfillmentCreate($fulfillment: FulfillmentInput!, $message: String) {
  fulfillmentCreate(fulfillment: $fulfillment, message: $message) {
    fulfillment { id status }
    userErrors { field message }
  }
}`;
