/**
 * Builds a minimal PDF document for CE-compatible order invoice responses.
 *
 * Nexora does not yet store marketplace tax invoices; this generator produces a
 * readable PDF so StockConnect can parse invoice metadata (see ParseInvoice.js).
 * Marketplace-specific invoice providers can replace this via the invoice port later.
 */

/**
 * @param {object} input
 * @param {string} input.merchantOrderNo
 * @param {string} [input.channelOrderNo]
 * @param {Date|string} input.orderDate
 */
export function generateStockConnectCeInvoicePdf(input) {
    const merchantOrderNo = input.merchantOrderNo.trim();
    const invoiceNumber = `CE-${merchantOrderNo}`;
    const orderDate = input.orderDate instanceof Date ? input.orderDate : new Date(input.orderDate);
    const invoiceDate = formatInvoiceDate(orderDate);
    const channelOrderNo = input.channelOrderNo?.trim() ?? '';
    const textLines = [
        'Sales tax invoice',
        `Invoice number: ${invoiceNumber}`,
        `Invoice date: ${invoiceDate}`,
        `Merchant order: ${merchantOrderNo}`,
        ...(channelOrderNo.length > 0 ? [`Channel order: ${channelOrderNo}`] : []),
    ];
    return buildMinimalPdf(textLines.join('\n'));
}

function formatInvoiceDate(date) {
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString().slice(0, 10);
    }
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * @param {string} text
 * @returns {Buffer}
 */
function buildMinimalPdf(text) {
    const escaped = escapePdfString(text);
    const contentStream = `BT /F1 12 Tf 50 750 Td (${escaped}) Tj ET`;
    const contentLength = Buffer.byteLength(contentStream, 'utf8');
    const objects = [
        '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
        '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
        '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
        `4 0 obj<< /Length ${contentLength} >>stream\n${contentStream}\nendstream\nendobj`,
        '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
    ];
    let body = '';
    const offsets = [0];
    for (const object of objects) {
        offsets.push(Buffer.byteLength(body, 'utf8'));
        body += `${object}\n`;
    }
    const xrefOffset = Buffer.byteLength(body, 'utf8');
    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i += 1) {
        xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(`%PDF-1.4\n${body}${xref}${trailer}`, 'utf8');
}

function escapePdfString(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}
