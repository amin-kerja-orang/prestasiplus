import {
  QUESTION_COGNITIVE_LEVELS,
  QUESTION_IMPORT_CODE_REQUIRED_COLUMNS,
  QUESTION_IMPORT_GURU_MAX_ROWS,
  QUESTION_IMPORT_GURU_REQUIRED_COLUMNS,
  QUESTION_IMPORT_GURU_ROW_MESSAGES as MSG,
  QUESTION_IMPORT_REQUIRED_COLUMNS,
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
  /** The legacy header names the subject and the level by DATABASE id; the BM and code headers by name, code or number. */
  idMode: boolean
}

/**
 * The three header formats the Guru route accepts (S6-T06 ruling). Every one is mapped onto the columns of the BM format, so one row model, one
 * set of PRD row reasons and one intake item shape serve all of them:
 *  - `bm`: `subjek,tingkatan,bab,sp,tp,aras,kesukaran,soalan,pilihan_a..d,jawapan,penerangan` (44-F3);
 *  - `code`: the D115 header (#704): `subject_code`, `tingkatan`, `bab_kod`, `sp_kod`, `tp`, `aras`, `difficulty`, `prompt_ms`, `option_a..d`, `correct`, `explanation`;
 *  - `legacy`: the positional header: `question_text`, `option_a..d`, `correct_answer`, `subject_id`, `education_level_id`, `difficulty_level`, `explanation`.
 */
type GuruFormat = 'bm' | 'code' | 'legacy'

/** BM column -> the column(s) of the other formats it is read from (first non-empty wins). */
const MAPPED: Record<Exclude<GuruFormat, 'bm'>, Readonly<Record<string, readonly string[]>>> = {
  code: {
    subjek: ['subject_code'],
    tingkatan: ['tingkatan'],
    bab: ['bab_kod'],
    sp: ['sp_kod'],
    tp: ['tp'],
    aras: ['aras'],
    kesukaran: ['difficulty', 'difficulty_level'],
    soalan: ['prompt_ms'],
    pilihan_a: ['option_a'],
    pilihan_b: ['option_b'],
    pilihan_c: ['option_c'],
    pilihan_d: ['option_d'],
    jawapan: ['correct'],
    penerangan: ['explanation'],
    jenis: ['type'],
  },
  legacy: {
    subjek: ['subject_id'],
    tingkatan: ['education_level_id'],
    kesukaran: ['difficulty_level'],
    soalan: ['question_text'],
    pilihan_a: ['option_a'],
    pilihan_b: ['option_b'],
    pilihan_c: ['option_c'],
    pilihan_d: ['option_d'],
    jawapan: ['correct_answer'],
    penerangan: ['explanation'],
  },
}

const formatOf = (names: ReadonlySet<string>): GuruFormat => (names.has('subjek') ? 'bm' : names.has('question_key') ? 'code' : names.has('question_text') ? 'legacy' : 'bm')

export function readGuruCsv(text: string): GuruCsvRead {
  // Header + cap + 1 records at most: a file over the cap is detected without building every record.
  const [header, ...data] = parseCsv(text, QUESTION_IMPORT_GURU_MAX_ROWS + 2)
  if (!header) return { missingColumns: [...QUESTION_IMPORT_GURU_REQUIRED_COLUMNS], rows: [], tooMany: false, idMode: false }
  const index = new Map<string, number>()
  header.cells.forEach((name, i) => {
    const key = name.trim().toLowerCase()
    if (!index.has(key)) index.set(key, i)
  })
  const format = formatOf(new Set(index.keys()))
  const required: readonly string[] = format === 'bm' ? QUESTION_IMPORT_GURU_REQUIRED_COLUMNS : format === 'code' ? QUESTION_IMPORT_CODE_REQUIRED_COLUMNS : QUESTION_IMPORT_REQUIRED_COLUMNS
  const missingColumns = required.filter((c) => !index.has(c))
  const idMode = format === 'legacy'
  if (data.length > QUESTION_IMPORT_GURU_MAX_ROWS) return { missingColumns, rows: [], tooMany: true, idMode }
  const rows = data.map<GuruCsvRow>((rec) => ({
    line: rec.line,
    get: (column) => {
      const sources = format === 'bm' ? [column] : (MAPPED[format][column] ?? [])
      for (const s of sources) {
        const i = index.get(s)
        const v = i === undefined ? '' : (rec.cells[i] ?? '')
        if (v !== '') return v
      }
      return ''
    },
  }))
  return { missingColumns, rows, tooMany: false, idMode }
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
export function guruSubjectOf(subjects: readonly GuruSubjectRef[], cell: string, idMode = false): GuruSubjectRef | null {
  const key = cell.trim().toLowerCase()
  if (key === '') return null
  if (idMode) return subjects.find((s) => s.id === key) ?? null
  return subjects.find((s) => s.name.trim().toLowerCase() === key) ?? subjects.find((s) => s.code.toLowerCase() === key) ?? null
}

/** The Tingkatan 1 to 5 of a row, or null. */
export function guruLevelOf(levels: ReadonlyMap<number, GuruLevelRef>, cell: string, idMode = false): GuruLevelRef | null {
  const t = cell.trim()
  if (idMode) return [...levels.values()].find((l) => l.id === t) ?? null
  const m = /^T?([1-5])$/i.exec(t)
  return m ? (levels.get(Number(m[1])) ?? null) : null
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

/** A cell value echoed in a row reason: cut to 50 characters so a long cell cannot bloat the response. */
const echo = (value: string): string => ([...value].length > 50 ? [...value].slice(0, 50).join('') : value)

const intIn = (cell: string, min: number, max: number): number | null => {
  const t = cell.trim()
  if (!/^\d{1,3}$/.test(t)) return null
  const n = Number(t)
  return n >= min && n <= max ? n : null
}

/** One reason per bad row, in the order of the 44-F3 list; the valid rows come back as intake submissions. */
export function planGuruRows(rows: readonly GuruCsvRow[], lookups: GuruCsvLookups, idMode = false): { valid: GuruRowInput[]; errors: QuestionImportFailure[] } {
  const valid: GuruRowInput[] = []
  const errors: QuestionImportFailure[] = []
  for (const r of rows) {
    const reason = ((): GuruRowInput | string => {
      const subject = guruSubjectOf(lookups.subjects, r.get('subjek'), idMode)
      if (!subject) return MSG.subject
      const level = guruLevelOf(lookups.levels, r.get('tingkatan'), idMode)
      if (!level) return MSG.level
      // The code header carries a `type`; the teacher route takes objective questions only (other types are authored in the Studio).
      const kind = r.get('jenis').trim().toLowerCase()
      if (kind !== '' && kind !== 'mcq') return MSG.mcqOnly

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
        if (!chapter) return MSG.chapterNotFound(echo(babCell))
        chapterId = chapter.id
      }
      const spCell = r.get('sp').trim()
      let sp: GuruSpRef | null = null
      if (spCell !== '') {
        sp = refs.sps.find((s) => s.code === spCell) ?? null
        if (!sp) return MSG.spNotFound(echo(spCell))
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
