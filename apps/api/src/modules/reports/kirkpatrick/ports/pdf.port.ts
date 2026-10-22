/**
 * PDF generation behind a port (card BE-20): the service builds the report lines, the adapter turns them into a
 * file. A richer renderer replaces the adapter without touching the service.
 */
export interface PdfPort {
  /** A PDF file: one titled page of text lines. An empty string is a blank line. */
  render(title: string, lines: readonly string[]): Uint8Array
}

export const PDF_PORT = Symbol('PDF_PORT')
