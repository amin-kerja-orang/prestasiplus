/**
 * Wire shapes and pure mappers of the intake routes (BE-37 files/OCR, `packages/contract/src/intake/files.ts`).
 * The wire types are the contract's `z.infer` types (type-only imports from `@pp/contract`).
 *
 * The backend submission is a declaration plus PDF files and their OCR pages. The extracted
 * questions (BE-38 items) have no controller yet, so a mapped batch carries no questions.
 */
import type {
  IntakeBatchDetail,
  IntakeBatchStatus,
  IntakeBatchSummary,
  IntakeFileSummary,
  IntakePageInfo,
  IntakePaperType,
} from '@pp/contract'

import type { IntakeBatch, IntakeStatus, IntakeSummary, PageText } from '../admin/intake/types'

export type WireBatchStatus = IntakeBatchStatus
export type WireFile = IntakeFileSummary
export type WireBatchSummary = IntakeBatchSummary
export type WireBatchDetail = IntakeBatchDetail
export type WirePage = IntakePageInfo

/** UI paper type label to the wire code (and back). */
export const PAPER_TYPE_CODES: Record<string, IntakePaperType> = {
  'Percubaan SPM': 'trial',
  'Soalan Umum': 'general',
  'Peperiksaan Sebenar': 'exam',
  'Buku Latihan': 'exercise_book',
  'Lain-lain': 'other',
}
const PAPER_TYPE_LABELS = Object.fromEntries(
  Object.entries(PAPER_TYPE_CODES).map(([label, code]) => [code, label]),
)

export function paperTypeToWire(label: string): IntakePaperType {
  return PAPER_TYPE_CODES[label] ?? 'other'
}
export function paperTypeFromWire(code: string): string {
  return PAPER_TYPE_LABELS[code] ?? 'Lain-lain'
}

/**
 * The UI knows two states: Draf (editable) and Semakan (submitted, read-only). The backend batch
 * is a processing state; only a cancelled/failed one is closed. Editing is unavailable anyway
 * (no items route), so every batch is shown as Draf.
 */
export function statusFromWire(): IntakeStatus {
  return 'draf'
}

const ms = (iso: string): number => Date.parse(iso)

export function summaryFromWire(
  b: WireBatchSummary,
  subjectName: (code: string) => string,
): IntakeSummary {
  const name = subjectName(b.subject)
  return {
    id: b.id,
    title: `${name} Kertas ${b.kertas} ${b.year}`,
    subject: b.subject,
    subjectName: name,
    kertas: b.kertas,
    year: b.year,
    status: statusFromWire(),
    sourceKind: 'pdf',
    fileName: `${b.fileCount} fail · ${b.statusLabel}`,
    questionCount: 0,
    groupCount: 0,
    lowCount: 0,
    marks: 0,
    updatedAt: ms(b.updatedAt),
  }
}

/** Pages of all files, numbered continuously across the batch (the UI has one page counter). */
export function pagesFromWire(
  lists: { pages: Pick<IntakePageInfo, 'pageNo' | 'textSource' | 'text' | 'ocrConfidence'>[] }[],
): PageText[] {
  const out: PageText[] = []
  let offset = 0
  for (const list of lists) {
    for (const p of list.pages) {
      out.push({
        page: offset + p.pageNo,
        text: p.text ?? '',
        source: p.textSource === 'ocr' ? 'ocr' : 'text-layer',
        ...(p.ocrConfidence !== null ? { confidence: p.ocrConfidence } : {}),
      })
    }
    offset += list.pages.length
  }
  return out
}

export function batchFromWire(b: WireBatchDetail, pages: PageText[]): IntakeBatch {
  const first = b.files[0]
  return {
    id: b.id,
    subject: b.subject,
    kertas: b.kertas,
    year: b.year,
    paperType: paperTypeFromWire(b.paperType),
    source: b.source,
    copyright: b.copyright,
    notes: b.notes ?? '',
    fileName: first?.originalName ?? '',
    fileHash: '',
    pageCount: b.pageCount,
    sourceKind: 'pdf',
    userId: 0,
    status: statusFromWire(),
    createdAt: ms(b.createdAt),
    updatedAt: ms(b.updatedAt),
    ...(b.submittedAt ? { submittedAt: ms(b.submittedAt) } : {}),
    provider: 'server',
    model: '-',
    questions: [],
    stimuli: [],
    unmatched: [],
    pages,
    itemsUnavailable: true,
  }
}
