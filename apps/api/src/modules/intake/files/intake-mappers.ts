import {
  INTAKE_BATCH_STATUS_LABELS,
  IntakeBboxSchema,
  IntakeFileErrorCodeSchema,
  IntakeTextBlockSchema,
  type IntakeBatchStatus,
  type IntakeBbox,
  type IntakeBatchSummary,
  type IntakeCopyright,
  type IntakeFileErrorCode,
  type IntakeFileProgress,
  type IntakeFileSummary,
  type IntakeFileStatus,
  type IntakePaperType,
  type IntakeTextBlock,
} from '@pp/contract'

import { idToString } from '../../../db/ids'
import { toMytTimestamp } from '../../../common/time/myt'

/** Wire rights code to the database code (and back). */
export const RIGHTS_TO_DB: Readonly<Record<IntakeCopyright, string>> = {
  sendiri: 'own',
  rasmi: 'official_lpm',
  'pihak-ketiga': 'third_party',
}
const RIGHTS_FROM_DB: Readonly<Record<string, IntakeCopyright>> = {
  own: 'sendiri',
  official_lpm: 'rasmi',
  third_party: 'pihak-ketiga',
}

export function rightsToWire(db: string): IntakeCopyright {
  const wire = RIGHTS_FROM_DB[db]
  if (!wire) throw new RangeError('Unknown rights status')
  return wire
}

export function errorCodeOrNull(code: string | null): IntakeFileErrorCode | null {
  const parsed = IntakeFileErrorCodeSchema.safeParse(code)
  return parsed.success ? parsed.data : null
}

export interface BatchRow {
  id: bigint
  status: string
  paperType: string
  subject: string
  kertas: number
  year: number
  sourceText: string
  rightsStatus: string
  note: string | null
  adminNotes: string | null
  createdAt: Date
  updatedAt: Date
  submittedAt: Date | null
  owner: { id: bigint; name: string } | null
  files: Array<{ pageCount: number | null }>
}

export function toBatchSummary(row: BatchRow): IntakeBatchSummary {
  return {
    id: idToString(row.id),
    status: row.status as IntakeBatchStatus,
    statusLabel: INTAKE_BATCH_STATUS_LABELS[row.status as IntakeBatchStatus],
    paperType: row.paperType as IntakePaperType,
    subject: row.subject,
    kertas: row.kertas === 2 ? 2 : 1,
    year: row.year,
    source: row.sourceText,
    copyright: rightsToWire(row.rightsStatus),
    notes: row.note,
    adminNotes: row.adminNotes,
    fileCount: row.files.length,
    pageCount: row.files.reduce((n, f) => n + (f.pageCount ?? 0), 0),
    owner: row.owner ? { id: idToString(row.owner.id), name: row.owner.name } : null,
    createdAt: toMytTimestamp(row.createdAt),
    updatedAt: toMytTimestamp(row.updatedAt),
    submittedAt: row.submittedAt ? toMytTimestamp(row.submittedAt) : null,
  }
}

export interface FileRow {
  id: bigint
  originalName: string
  sizeBytes: bigint
  pageCount: number | null
  status: string
  errorCode: string | null
}

export function toFileSummary(row: FileRow, progress: IntakeFileProgress): IntakeFileSummary {
  return {
    id: idToString(row.id),
    originalName: row.originalName,
    sizeBytes: Number(row.sizeBytes),
    pageCount: row.pageCount,
    status: row.status as IntakeFileStatus,
    errorCode: errorCodeOrNull(row.errorCode),
    progress,
  }
}

/** Stored blocks (JSON) to the wire shape; a malformed value gives an empty list rather than a 500. */
export function blocksFromJson(value: unknown): IntakeTextBlock[] {
  if (!Array.isArray(value)) return []
  const out: IntakeTextBlock[] = []
  for (const item of value) {
    const parsed = IntakeTextBlockSchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export function bboxFromJson(value: unknown): IntakeBbox {
  const parsed = IntakeBboxSchema.safeParse(value)
  return parsed.success ? parsed.data : { x: 0, y: 0, w: 1, h: 1 }
}

/** PostgreSQL text and jsonb cannot hold U+0000; engines can emit it for broken fonts. */
export const stripNul = (text: string): string => text.replaceAll('\u0000', '')

const unit = (n: number): number => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))

/** Engine blocks clamped to the wire bounds (fractions 0..1, confidence 0..100 or null) before they are stored. */
export function clampBlocks(blocks: ReadonlyArray<{ text: string; bbox: { x: number; y: number; w: number; h: number }; confidence: number | null }>): IntakeTextBlock[] {
  return blocks.map((b) => ({
    text: stripNul(b.text),
    bbox: { x: unit(b.bbox.x), y: unit(b.bbox.y), w: unit(b.bbox.w), h: unit(b.bbox.h) },
    confidence: b.confidence === null || !Number.isFinite(b.confidence) ? null : Math.min(100, Math.max(0, b.confidence)),
  }))
}
