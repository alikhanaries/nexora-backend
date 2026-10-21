/**
 * Maps HTTP create-order address payloads into application input.
 * @param {object | null | undefined} address
 */
export function mapAddressInput(address) {
  if (address === undefined || address === null) {
    return null;
  }
  return {
    line1: address.line1 ?? null,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    region: address.region ?? null,
    postalCode: address.postalCode ?? null,
    countryCode: address.countryCode ?? null,
  };
}

/**
 * Maps HTTP create-order customer payloads into application input.
 * @param {object} customer
 */
export function mapCustomerInput(customer) {
  return {
    ...(customer.externalCustomerReference === undefined
      ? {}
      : { externalCustomerReference: customer.externalCustomerReference ?? null }),
    ...(customer.firstName === undefined ? {} : { firstName: customer.firstName ?? null }),
    ...(customer.lastName === undefined ? {} : { lastName: customer.lastName ?? null }),
    ...(customer.email === undefined ? {} : { email: customer.email ?? null }),
    ...(customer.phone === undefined ? {} : { phone: customer.phone ?? null }),
    ...(customer.companyName === undefined ? {} : { companyName: customer.companyName ?? null }),
    ...(customer.billingAddress === undefined
      ? {}
      : { billingAddress: mapAddressInput(customer.billingAddress) }),
    ...(customer.shippingAddress === undefined
      ? {}
      : { shippingAddress: mapAddressInput(customer.shippingAddress) }),
    ...(customer.metadata === undefined ? {} : { metadata: customer.metadata }),
  };
}
