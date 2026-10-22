/**
 * Wire shapes and pure mappers of the intake routes: BE-37 (files/OCR, `intake/files.ts`) and BE-38
 * (items, extraction run, review summary; `intake/{items,review,question}.ts`). The wire types are the
 * contract's `z.infer` types (type-only imports from `@pp/contract`).
 *
 * A wire batch is a declaration plus PDF files and their OCR pages (BE-37); its questions are the
 * BE-38 items. `IntakeItem` is the prototype `IntakeQuestion` flattened with review state, so the
 * editor binds to the same fields; `questionFromItem` keeps only the question fields.
 */
import type {
  IntakeBatchDetail,
  IntakeBatchReview,
  IntakeBatchStatus,
  IntakeBatchSummary,
  IntakeExtractionRun,
  IntakeFileSummary,
  IntakeIssue as WireIssue,
  IntakeItem,
  IntakeItemPatch,
  IntakePageInfo,
  IntakePaperType,
  IntakeStimulus as WireStimulus,
} from '@pp/contract'

import type {
  IntakeBatch,
  IntakeExtraction,
  IntakeIssue,
  IntakeQuestion,
  IntakeStatus,
  IntakeStimulus,
  IntakeSummary,
  PageText,
} from '../admin/intake/types'

export type WireBatchStatus = IntakeBatchStatus
export type WireFile = IntakeFileSummary
export type WireBatchSummary = IntakeBatchSummary
export type WireBatchDetail = IntakeBatchDetail
export type WirePage = IntakePageInfo
export type WireItem = IntakeItem
export type WireReview = IntakeBatchReview
export type WireRun = IntakeExtractionRun
export type { WireIssue, WireStimulus }

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
 * is a processing state with no submit step: items stay editable until a person accepts or
 * rejects them, so every batch is shown as Draf (Semakan is only shown for the session after
 * "Hantar untuk semakan").
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

/** What the batch screen needs beyond the declaration (all optional: a failed read degrades to none). */
export interface BatchExtras {
  items?: WireItem[]
  review?: WireReview
}

/** Run of the latest extraction (or none) and whether a new one may be requested now. */
export function extractionFromWire(
  b: Pick<WireBatchDetail, 'status' | 'files'>,
  run: WireRun | null,
): IntakeExtraction {
  const active = run !== null && (run.state === 'queued' || run.state === 'running')
  const fileReady = b.files.length > 0 && b.files.every((f) => f.status === 'done' || f.status === 'cancelled') && b.files.some((f) => f.status === 'done')
  const fileFailed = b.files.length > 0 && b.files.every((f) => f.status === 'failed' || f.status === 'cancelled')
  return {
    state: run ? run.state : 'none',
    ...(run?.reason ? { reason: run.reason.message } : {}),
    ...(run?.itemCount !== null && run?.itemCount !== undefined ? { itemCount: run.itemCount } : {}),
    // Extractable: files are read, no run is active or finished (a failed run may be retried).
    canExtract:
      !active &&
      run?.state !== 'succeeded' &&
      fileReady &&
      (b.status === 'ready_for_review' || b.status === 'failed'),
    processing: !fileReady && !fileFailed && (b.status === 'submitted' || b.status === 'processing'),
  }
}

export function batchFromWire(b: WireBatchDetail, pages: PageText[], extras: BatchExtras = {}): IntakeBatch {
  const first = b.files[0]
  const items = extras.items
  const review = extras.review
  const manual = b.files.length === 0
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
    sourceKind: manual ? 'manual' : 'pdf',
    userId: 0,
    status: statusFromWire(),
    createdAt: ms(b.createdAt),
    updatedAt: ms(b.updatedAt),
    ...(b.submittedAt ? { submittedAt: ms(b.submittedAt) } : {}),
    provider: review?.provider ?? (manual ? 'manual' : 'server'),
    model: review?.model ?? '-',
    questions: (items ?? []).filter((i) => i.state !== 'rejected').map(questionFromItem),
    stimuli: (review?.stimuli ?? []).map(stimulusFromWire),
    unmatched: review?.unmatched ?? [],
    pages,
    ...(items === undefined || review === undefined ? { itemsUnavailable: true } : {}),
    ...(review ? { extraction: extractionFromWire(b, review.extraction) } : {}),
  }
}

/* ----------------------------------------------------------------------------------- items */

const QUESTION_KEYS = [
  'id',
  'label',
  'type',
  'stem',
  'options',
  'marks',
  'mode',
  'unit',
  'wordRange',
  'parts',
  'scheme',
  'tag',
  'stimulusId',
  'page',
  'lowFields',
  'confirmed',
  'needsManual',
] as const

/** The question fields of an item (the review state, provenance and history are dropped). */
export function questionFromItem(item: WireItem): IntakeQuestion {
  const out: Record<string, unknown> = {}
  for (const k of QUESTION_KEYS) if (item[k] !== undefined) out[k] = item[k]
  return out as unknown as IntakeQuestion
}

/** `null` optional fields of the wire become absent (the editor tests presence). */
export function stimulusFromWire(s: WireStimulus): IntakeStimulus {
  const { figureId: _f, region: _r, ...rest } = s
  void _f
  void _r
  return rest
}

export function issuesFromWire(issues: readonly WireIssue[]): IntakeIssue[] {
  return issues.map((i) => ({
    ...(i.itemId !== undefined ? { questionId: i.itemId } : {}),
    where: i.where,
    message: i.message,
  }))
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * The PATCH body that turns `prev` (as the server last returned it) into `next` (what the editor
 * holds), or null when nothing a person may write changed. `lowFields` is server-owned; `needsManual`
 * can only go to false; an optional field that disappeared is cleared with null.
 */
export function itemPatch(prev: IntakeQuestion, next: IntakeQuestion): IntakeItemPatch | null {
  const out: Record<string, unknown> = {}
  for (const k of ['label', 'type', 'stem', 'options', 'marks', 'mode', 'parts', 'tag', 'page', 'confirmed'] as const) {
    if (!same(prev[k], next[k])) out[k] = next[k]
  }
  for (const k of ['unit', 'wordRange', 'scheme'] as const) {
    if (!same(prev[k], next[k])) out[k] = next[k] ?? null
  }
  if ((prev.stimulusId ?? null) !== (next.stimulusId || null)) out.stimulusId = next.stimulusId || null
  if (prev.needsManual === true && next.needsManual !== true) out.needsManual = false
  return Object.keys(out).length > 0 ? (out) : null
}

/** What the page must adopt after a save that created items or stimuli (local id to server id). */
export interface SaveIdMap {
  items: Record<string, string>
  stimuli: Record<string, string>
}
