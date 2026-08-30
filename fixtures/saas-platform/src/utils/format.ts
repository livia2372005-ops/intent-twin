export function formatInvoiceHeader(id: string, dateStr: string): string {
  return `DOCUPAY INVOICE [${id.toUpperCase()}] - ISSUED: ${dateStr}`;
}
