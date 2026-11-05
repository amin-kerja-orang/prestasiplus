import {
  QUESTION_COGNITIVE_LEVELS,
  QUESTION_IMPORT_GURU_MAX_ROWS,
  QUESTION_IMPORT_GURU_REQUIRED_COLUMNS,
  QUESTION_IMPORT_GURU_ROW_MESSAGES as MSG,
  type QuestionCognitiveLevel,
  type QuestionImportFailure,
} from '@pp/contract'

import type { GuruRowInput } from '../../../intake/files/guru-submissions.service'
import { parseCsv } from './csv'

/**
 * Pure planning of the teacher's CSV (API-GUR-19, 44-F3): columns by NAME, one reason per bad row, valid rows kept. No database, no clock.
 * The curriculum references (subject, Tingkatan, Bab, SP) are resolved by the caller in two steps: `readGuruCsv` first (which Subjek +
 * Tingkatan pairs occur), then `planGuruRows` with the Bab and SP lists of those pairs.
 */

export interface GuruCsvRow {
  /** 1-based line of the file where the record starts (the header is line 1). */
  line: number
  get: (column: string) => string
}

export interface GuruCsvRead {
  /** Required columns the file lacks (non-empty refuses the file). */
  missingColumns: string[]
  rows: GuruCsvRow[]
  /** The file has more data rows than the teacher cap. */
  tooMany: boolean
}

export function readGuruCsv(text: string): GuruCsvRead {
  const [header, ...data] = parseCsv(text)
  if (!header) return { missingColumns: [...QUESTION_IMPORT_GURU_REQUIRED_COLUMNS], rows: [], tooMany: false }
  const index = new Map<string, number>()
  header.cells.forEach((name, i) => {
    const key = name.trim().toLowerCase()
    if (!index.has(key)) index.set(key, i)
  })
  const missingColumns = QUESTION_IMPORT_GURU_REQUIRED_COLUMNS.filter((c) => !index.has(c))
  const rows = data.map<GuruCsvRow>((rec) => ({
    line: rec.line,
    get: (column) => {
      const i = index.get(column)
      return i === undefined ? '' : (rec.cells[i] ?? '')
    },
  }))
  return { missingColumns, rows, tooMany: rows.length > QUESTION_IMPORT_GURU_MAX_ROWS }
}

export interface GuruSubjectRef {
  id: string
  code: string
  name: string
}
export interface GuruLevelRef {
  id: string
  code: string
}
export interface GuruChapterRef {
  id: string
  number: number | null
  name: string | null
}
export interface GuruSpRef {
  id: string
  code: string
}

export interface GuruCsvLookups {
  subjects: readonly GuruSubjectRef[]
  /** Tingkatan 1 to 5 by number. */
  levels: ReadonlyMap<number, GuruLevelRef>
  /** Active chapters and SP nodes of one Subjek + Tingkatan (key `${subjectId}:${levelId}`). */
  refs: ReadonlyMap<string, { chapters: readonly GuruChapterRef[]; sps: readonly GuruSpRef[] }>
}

export const guruPairKey = (subjectId: string, levelId: string): string => `${subjectId}:${levelId}`

/** The Subjek of a row (BM name, or its code, trimmed and case-insensitive), or null. */
export function guruSubjectOf(subjects: readonly GuruSubjectRef[], cell: string): GuruSubjectRef | null {
  const key = cell.trim().toLowerCase()
  if (key === '') return null
  return subjects.find((s) => s.name.trim().toLowerCase() === key) ?? subjects.find((s) => s.code.toLowerCase() === key) ?? null
}

/** The Tingkatan 1 to 5 of a row, or null. */
export function guruLevelOf(levels: ReadonlyMap<number, GuruLevelRef>, cell: string): GuruLevelRef | null {
  const t = cell.trim()
  return /^[1-5]$/.test(t) ? (levels.get(Number(t)) ?? null) : null
}

const COGNITIVE = new Set<string>(QUESTION_COGNITIVE_LEVELS)
const LETTERS = ['A', 'B', 'C', 'D'] as const

/** "Bab 1", "1" or "1." = chapter number 1; anything else is compared with the name (or "n. name"), trimmed and case-insensitive. */
function chapterOf(chapters: readonly GuruChapterRef[], cell: string): GuruChapterRef | null {
  const t = cell.trim()
  const num = /^(?:bab\s*)?(\d{1,4})\.?$/i.exec(t)
  if (num) {
    const n = Number(num[1])
    const byNumber = chapters.find((c) => c.number === n)
    if (byNumber) return byNumber
  }
  const key = t.toLowerCase()
  return chapters.find((c) => (c.name ?? '').trim().toLowerCase() === key || (c.number !== null && `${String(c.number)}. ${(c.name ?? '').trim()}`.toLowerCase() === key)) ?? null
}

const intIn = (cell: string, min: number, max: number): number | null => {
  const t = cell.trim()
  if (!/^\d{1,3}$/.test(t)) return null
  const n = Number(t)
  return n >= min && n <= max ? n : null
}

/** One reason per bad row, in the order of the 44-F3 list; the valid rows come back as intake submissions. */
export function planGuruRows(rows: readonly GuruCsvRow[], lookups: GuruCsvLookups): { valid: GuruRowInput[]; errors: QuestionImportFailure[] } {
  const valid: GuruRowInput[] = []
  const errors: QuestionImportFailure[] = []
  for (const r of rows) {
    const reason = ((): GuruRowInput | string => {
      const subject = guruSubjectOf(lookups.subjects, r.get('subjek'))
      if (!subject) return MSG.subject
      const level = guruLevelOf(lookups.levels, r.get('tingkatan'))
      if (!level) return MSG.level

      const tpCell = r.get('tp')
      const tp = tpCell.trim() === '' ? null : intIn(tpCell, 1, 6)
      if (tpCell.trim() !== '' && tp === null) return MSG.tp
      const arasCell = r.get('aras').trim().toLowerCase()
      if (arasCell !== '' && !COGNITIVE.has(arasCell)) return MSG.cognitive
      const kesukaranCell = r.get('kesukaran')
      const difficulty = kesukaranCell.trim() === '' ? (tp === null ? null : Math.min(5, tp)) : intIn(kesukaranCell, 1, 5)
      if (difficulty === null) return MSG.difficulty
      const answer = r.get('jawapan').trim().toUpperCase()
      if (!/^[A-D]$/.test(answer)) return MSG.answer

      const refs = lookups.refs.get(guruPairKey(subject.id, level.id)) ?? { chapters: [], sps: [] }
      const babCell = r.get('bab').trim()
      let chapterId: string | null = null
      if (babCell !== '') {
        const chapter = chapterOf(refs.chapters, babCell)
        if (!chapter) return MSG.chapterNotFound(babCell)
        chapterId = chapter.id
      }
      const spCell = r.get('sp').trim()
      let sp: GuruSpRef | null = null
      if (spCell !== '') {
        sp = refs.sps.find((s) => s.code === spCell) ?? null
        if (!sp) return MSG.spNotFound(spCell)
      }

      const text = r.get('soalan').trim()
      if (text === '') return MSG.text
      const options = [r.get('pilihan_a'), r.get('pilihan_b'), r.get('pilihan_c'), r.get('pilihan_d')].map((o) => o.trim())
      const empty = options.findIndex((o) => o === '')
      if (empty >= 0) return MSG.option(LETTERS[empty] as string)
      if ([...text].length > 2000) return MSG.textTooLong
      const long = options.findIndex((o) => [...o].length > 500)
      if (long >= 0) return MSG.optionTooLong(LETTERS[long] as string)
      const explanation = r.get('penerangan').trim()
      if ([...explanation].length > 2000) return MSG.explanationTooLong

      return {
        subjectName: subject.name,
        codes: { subjectCode: subject.code, levelCode: level.code, spCodes: sp ? [sp.code] : [] },
        input: {
          subjectId: subject.id,
          educationLevelId: level.id,
          chapterId,
          spIds: sp ? [sp.id] : [],
          tp,
          cognitiveLevel: arasCell === '' ? null : (arasCell as QuestionCognitiveLevel),
          difficultyLevel: difficulty,
          correctIndex: LETTERS.indexOf(answer as (typeof LETTERS)[number]),
          explanation: explanation === '' ? null : explanation,
          questionText: text,
          options,
        },
      }
    })()
    if (typeof reason === 'string') errors.push({ row: r.line, message: reason })
    else valid.push(reason)
  }
  return { valid, errors }
}
