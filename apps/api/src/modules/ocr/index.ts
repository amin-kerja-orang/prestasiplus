export { encodeImage, cropImage, loadCanvas, OcrImageService } from './images'
export type { EncodedImage, EncodeOptions, FractionBox } from './images'
export { DisabledOcrEngine, TesseractEngine, createOcrEngine, tesseractUnavailableReason } from './ocr-engine'
export { OcrConfig } from './ocr.config'
export { OcrError, type OcrErrorCode } from './ocr.error'
export { OcrModule } from './ocr.module'
export {
  OCR_ENGINE,
  OCR_MIN_TEXT_CHARS,
  PDF_ENGINE,
  isScannedPage,
  type OcrEngine,
  type OcrResult,
  type PageExtraction,
  type PdfEngine,
  type PdfInspection,
  type RenderedPage,
  type TextBlock,
} from './ocr.types'
export { PdfjsEngine } from './pdfjs.engine'
