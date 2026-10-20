/**
 * Browser-side reading of a paper for the prototype: `pdfjs-dist` reads the text layer of a
 * digital-born PDF (its own Web Worker) and renders each page to an image; pages without a text
 * layer, and image files, go through `tesseract.js` (Malay + English, also a Web Worker). Both
 * libraries are loaded on demand so they never weigh on the rest of the app. Page images are kept
 * in memory only (the review screen shows them next to the extracted text).
 */
import type { PageImage, PageText } from '../types'

export type OcrPhase = 'baca' | 'imej' | 'ocr'

export interface OcrProgress {
  page: number
  total: number
  phase: OcrPhase
  /** 0-100 within the current phase of this page. */
  percent: number
}

export interface ReadResult {
  pages: PageText[]
  images: PageImage[]
  fileHash: string
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
/** A page with fewer characters than this has no usable text layer and is OCR'd. */
const MIN_TEXT_CHARS = 20

/** http mode: the server reads PDF only (BE-37), so other types are refused before the upload. */
export const PDF_ONLY_MESSAGE = 'Jenis fail tidak disokong. Gunakan PDF.'

export function checkFile(file: File, pdfOnly = false): string | null {
  if (pdfOnly && file.type !== 'application/pdf') return PDF_ONLY_MESSAGE
  if (!ACCEPTED_TYPES.includes(file.type))
    return 'Jenis fail tidak disokong. Gunakan PDF, PNG atau JPG.'
  if (file.size > MAX_FILE_BYTES) return 'Fail melebihi had 20 MB.'
  return null
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Group text items into lines by their baseline. */
function itemsToLines(
  items: { str: string; transform: number[]; hasEOL?: boolean }[],
): string {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = []
  for (const it of items) {
    if (!it.str) continue
    const y = Math.round(it.transform[5]!)
    const x = it.transform[4]!
    const row = rows.find((r) => Math.abs(r.y - y) <= 2)
    if (row) row.parts.push({ x, s: it.str })
    else rows.push({ y, parts: [{ x, s: it.str }] })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
}

function canvasToImage(canvas: HTMLCanvasElement, page: number): PageImage {
  return {
    page,
    dataUrl: canvas.toDataURL('image/jpeg', 0.6),
    width: canvas.width,
    height: canvas.height,
  }
}

type OcrWorker = {
  recognize: (img: HTMLCanvasElement | Blob) => Promise<{ data: { text: string; confidence: number } }>
  terminate: () => Promise<unknown>
}

async function makeOcrWorker(onPercent: (p: number) => void): Promise<OcrWorker> {
  const { createWorker } = await import('tesseract.js')
  const langPath = import.meta.env.VITE_OCR_LANG_PATH as string | undefined
  return await createWorker(['msa', 'eng'], 1, {
    ...(langPath ? { langPath } : {}),
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onPercent(Math.round(m.progress * 100))
    },
  })
}

export async function readPaper(
  file: File,
  onProgress: (p: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<ReadResult> {
  const buf = await file.arrayBuffer()
  const fileHash = await sha256(buf)
  const pages: PageText[] = []
  const images: PageImage[] = []
  let ocr: OcrWorker | null = null
  let currentPage = 1
  let total = 1
  const getOcr = async (): Promise<OcrWorker> => {
    ocr ??= await makeOcrWorker((percent) =>
      onProgress({ page: currentPage, total, phase: 'ocr', percent }),
    )
    return ocr
  }

  try {
    if (file.type.startsWith('image/')) {
      onProgress({ page: 1, total: 1, phase: 'ocr', percent: 0 })
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
      const worker = await getOcr()
      const res = await worker.recognize(canvas)
      pages.push({ page: 1, text: res.data.text, source: 'ocr', confidence: res.data.confidence })
      images.push(canvasToImage(canvas, 1))
      return { pages, images, fileHash }
    }

    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
    total = pdf.numPages
    for (let n = 1; n <= total; n++) {
      if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError')
      currentPage = n
      onProgress({ page: n, total, phase: 'baca', percent: 0 })
      const page = await pdf.getPage(n)
      const content = await page.getTextContent()
      const text = itemsToLines(
        content.items as { str: string; transform: number[]; hasEOL?: boolean }[],
      )

      onProgress({ page: n, total, phase: 'imej', percent: 30 })
      const viewport = page.getViewport({ scale: text.length >= MIN_TEXT_CHARS ? 1.1 : 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, canvas, viewport }).promise
      images.push(canvasToImage(canvas, n))

      if (text.length >= MIN_TEXT_CHARS) {
        pages.push({ page: n, text, source: 'text-layer' })
      } else {
        onProgress({ page: n, total, phase: 'ocr', percent: 0 })
        const worker = await getOcr()
        const res = await worker.recognize(canvas)
        pages.push({ page: n, text: res.data.text, source: 'ocr', confidence: res.data.confidence })
      }
      onProgress({ page: n, total, phase: 'ocr', percent: 100 })
    }
    return { pages, images, fileHash }
  } finally {
    if (ocr) await (ocr as OcrWorker).terminate()
  }
}
