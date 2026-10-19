export function optionalReferenceFields(input) {
    return {
        ...(input.referenceType === undefined ? {} : { referenceType: input.referenceType }),
        ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
        ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    };
}
