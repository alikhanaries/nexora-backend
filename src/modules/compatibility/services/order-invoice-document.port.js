/**
 * Optional marketplace or document-service integration for order invoice PDFs.
 * Compatibility layer calls this before falling back to the built-in CE invoice PDF.
 *
 * @typedef {object} OrderInvoiceDocumentResult
 * @property {string} contentType
 * @property {Buffer} body
 *
 * @typedef {object} OrderInvoiceDocumentPort
 * @property {(input: { tenantId: string, order: object }) => Promise<OrderInvoiceDocumentResult|null>} fetchInvoicePdf
 */

export {};
