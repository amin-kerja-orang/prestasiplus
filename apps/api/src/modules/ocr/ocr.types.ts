/** Shared shapes of the OCR module (no DB access, no Nest imports). */
export interface PdfInspection {
  pageCount: number
  encrypted: boolean
}

export interface TextBlock {
  text: string
  /** Page fractions 0..1, y measured from the top of the page. */
  bbox: { x: number; y: number; w: number; h: number }
  /** 0..100 for OCR, null for a text layer. */
  confidence: number | null
}

export interface PageExtraction {
  pageNo: number
  text: string
  blocks: TextBlock[]
  charCount: number
  /** Page size in points. */
  width: number
  height: number
}

export interface RenderedPage {
  png: Buffer
  /** Pixels. */
  width: number
  height: number
}

export const PDF_ENGINE = Symbol('PDF_ENGINE')

export interface PdfEngine {
  inspect(bytes: Buffer, signal?: AbortSignal): Promise<PdfInspection>
  extractText(bytes: Buffer, pageNo: number, signal?: AbortSignal): Promise<PageExtraction>
  /** `null` = no canvas available on this host. */
  render(
    bytes: Buffer,
    pageNo: number,
    opts: { dpi: number; maxPixels: number },
    signal?: AbortSignal,
  ): Promise<RenderedPage | null>
}

export const OCR_ENGINE = Symbol('OCR_ENGINE')

export interface OcrResult {
  text: string
  confidence: number
  blocks: TextBlock[]
}

export interface OcrEngine {
  readonly available: boolean
  recognize(png: Buffer, signal?: AbortSignal): Promise<OcrResult>
}

/** Default minimum characters for a page to count as having a text layer (prototype MIN_TEXT_CHARS). */
export const OCR_MIN_TEXT_CHARS = 20

/** A page with too little text needs OCR. */
export function isScannedPage(e: Pick<PageExtraction, 'charCount'>, minChars = OCR_MIN_TEXT_CHARS): boolean {
  return e.charCount < minChars
}
