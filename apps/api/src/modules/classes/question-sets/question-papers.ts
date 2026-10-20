import {
  QUESTION_SET_PAPER_FILE_PATTERN,
  QUESTION_SET_PAPER_MESSAGES,
  QuestionSetPaperFieldsSchema,
  QuestionSetPaperFilesSchema,
} from '@pp/contract'

import { invalid } from '../strict-body'
import type { PaperDeclaration } from './question-sets.ports'

/** The file parts the parser read, before any check. */
export interface RawPart {
  fieldname: string
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/** Field names of the form that carry files (the client sends `files[]`, the mock also reads `files`). */
const FILE_FIELDS = new Set(['files', 'files[]'])
export const paperPartsOf = (parts: readonly RawPart[] | undefined): RawPart[] => (parts ?? []).filter((p) => FILE_FIELDS.has(p.fieldname))

/** multer hands names over as latin1; restore UTF-8 names (strict decode, otherwise keep the name as is). */
export function displayName(name: string): string {
  if ([...name].some((c) => c.charCodeAt(0) > 255)) return name
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(name, 'latin1'))
  } catch {
    return name
  }
}

/**
 * The file name handed to the intake: the re-decoded name reduced to its last path part (no `/` or `\\` part),
 * with control characters removed. Never the raw `originalname`; "file" when nothing is left.
 */
export function cleanName(name: string): string {
  const base = displayName(name).split(/[\\/]/).filter((p) => p !== '' && p !== '.' && p !== '..').at(-1) ?? ''
  const cleaned = base.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()
  return cleaned === '' ? 'file' : cleaned
}

function wholeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined
  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : undefined
  }
  return undefined
}

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === ''

/** Text fields that may not carry a NUL (Postgres text rejects it) get the message of their own length rule. */
const NUL_MESSAGE: Record<string, string> = {
  subject: QUESTION_SET_PAPER_MESSAGES.subject,
  disediakanOleh: QUESTION_SET_PAPER_MESSAGES.author,
  catatan: QUESTION_SET_PAPER_MESSAGES.note,
}

export interface ValidatedPaper {
  declaration: PaperDeclaration
  /** The parts with `name` = the cleaned name (see `cleanName`). */
  files: (RawPart & { name: string })[]
}

/**
 * Validates the whole form at once with the contract schemas (every failing field is reported, first message
 * per field, in form order; the 422 message is the Laravel summary of the first one). `files` are the file
 * parts read from `files` and `files[]`. Throws the 422 `ApiError`.
 */
export function validatePaper(body: unknown, parts: readonly RawPart[] | undefined, currentYear: number): ValidatedPaper {
  const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
  const files = paperPartsOf(parts).map((f) => ({ ...f, name: cleanName(f.originalname) }))
  const fields: Record<string, string> = {}

  const parsed = QuestionSetPaperFieldsSchema.safeParse(input)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_')
      fields[key] ??= issue.message
    }
  }
  for (const [key, message] of Object.entries(NUL_MESSAGE)) {
    const v = input[key]
    if (typeof v === 'string' && v.includes('\u0000')) fields[key] ??= message
  }

  const described = files.map((f) => ({ name: f.name, size: f.size, type: f.mimetype }))
  const checked = QuestionSetPaperFilesSchema.safeParse(described)
  if (!checked.success) fields.files = checked.error.issues[0]?.message ?? QUESTION_SET_PAPER_MESSAGES.files
  else if (!described.every((f) => QUESTION_SET_PAPER_FILE_PATTERN.test(f.name))) {
    fields.files = QUESTION_SET_PAPER_MESSAGES.files
  }

  if (!parsed.success || Object.keys(fields).length > 0) {
    // Same key order as the form, files last.
    const order = ['jenisSoalan', 'subject', 'tingkatan', 'tahun', 'disediakanOleh', 'catatan', 'files']
    const sorted: Record<string, string> = {}
    for (const k of order) if (fields[k] !== undefined) sorted[k] = fields[k]
    for (const [k, v] of Object.entries(fields)) sorted[k] ??= v
    throw invalid(sorted)
  }
  const data = parsed.data

  const level = isEmpty(data.tingkatan) ? null : wholeNumber(typeof data.tingkatan === 'string' ? data.tingkatan.replace(/^T/i, '') : data.tingkatan)
  const year = isEmpty(data.tahun) ? currentYear : (wholeNumber(data.tahun) ?? currentYear)
  const note = data.catatan ?? ''
  return {
    declaration: {
      paperType: data.jenisSoalan,
      subjectText: data.subject,
      levelCode: level === null || level === undefined ? null : `T${String(level)}`,
      year,
      authorCredit: data.disediakanOleh ?? '',
      note: note === '' ? null : note,
    },
    files,
  }
}
