/**
 * Every queue in the system, declared in one place.
 *
 * Queue names are metric labels and Redis key components, so they must be a
 * closed set of constants rather than ad-hoc strings.
 */
export const QueueName = {
  /** Integration events handed over by the outbox publisher. */
  INTEGRATION_EVENTS: 'integration-events',
} as const;

export type QueueNameValue = (typeof QueueName)[keyof typeof QueueName];

/** Job names within {@link QueueName.INTEGRATION_EVENTS}. */
export const JobName = {
  PUBLISH_INTEGRATION_EVENT: 'publish-integration-event',
} as const;

export type JobNameValue = (typeof JobName)[keyof typeof JobName];
