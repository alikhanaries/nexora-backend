export function buildAmazonOrderChangeNotification(overrides = {}) {
    return {
        NotificationVersion: '1.0',
        NotificationType: 'ORDER_CHANGE',
        PayloadVersion: '1.0',
        EventTime: '2023-10-03T01:35:06.382Z',
        Payload: {
            OrderChangeNotification: {
                NotificationLevel: 'OrderLevel',
                SellerId: 'SELLER123',
                AmazonOrderId: '123-4567890-1234567',
                OrderChangeType: 'OrderStatusChange',
                OrderChangeTrigger: {
                    TimeOfOrderChange: '2023-10-03T01:35:01.000Z',
                    ChangeReason: 'Order Status Change',
                },
                Summary: {
                    MarketplaceId: 'ATVPDKIKX0DER',
                    OrderStatus: 'Unshipped',
                    PurchaseDate: '2023-10-03T01:03:44.106Z',
                    OrderItems: [{
                        OrderItemId: '12345207241',
                        SellerSKU: 'SKU123',
                        Quantity: 2,
                    }],
                },
            },
        },
        NotificationMetadata: {
            NotificationId: 'e9b0f384-aaaa-bbbb-cccc-dddddddddddd',
            PublishTime: '2023-10-03T01:35:07.931Z',
        },
        ...overrides,
    };
}

export function wrapAmazonNotificationInSns(message) {
    return JSON.stringify({
        Type: 'Notification',
        MessageId: 'sns-msg-001',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:sp-api-notifications',
        Message: JSON.stringify(message),
        Timestamp: '2023-10-03T01:35:08.000Z',
    });
}
