export function optionalReferenceFields(input: {
  readonly referenceType?: string | undefined;
  readonly referenceId?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}) {
  return {
    ...(input.referenceType === undefined ? {} : { referenceType: input.referenceType }),
    ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
    ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };
}
