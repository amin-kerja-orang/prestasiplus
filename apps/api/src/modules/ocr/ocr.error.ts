export type OcrErrorCode =
  | 'ENCRYPTED'
  | 'CORRUPT'
  | 'TOO_COMPLEX'
  | 'TOO_MANY_PAGES'
  | 'OCR_TIMEOUT'
  | 'OCR_FAILED'
  | 'OCR_UNAVAILABLE'
  | 'RENDER_FAILED'

/** A failure of PDF reading or OCR. Only the code is meaningful; the message never carries file content. */
export class OcrError extends Error {
  constructor(
    public readonly code: OcrErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'OcrError'
  }
}
