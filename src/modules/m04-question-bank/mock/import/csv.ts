/**
 * CSV parsing and row planning of the S5 question import (SRS BR-M04-10, FR-M04-56, §6.12). Pure
 * functions, no store access.
 *
 * BR-M04-10 (OBSERVED copy / INFERRED parsing): UTF-8; first row = header; comma separator; `"`
 * quoting with doubled `""` inside quotes; `correct_answer` letter A–D (any case) → index 0–3;
 * `option_c` / `option_d` may be empty; `difficulty_level` 1–5 from the column, else the form
 * default; `marks` → `pointsValue` (default 1); `subject_id` / `education_level_id` from the column
 * or the default (DV-M04-07). An invalid row is skipped and counted as failed.
 *
 * INFERRED here (no live copy): a quoted field may span lines; blank lines are ignored; row numbers
 * are 1-based file lines (the header is line 1) so they match what the admin sees in an editor; the
 * required header columns; and every failure message except the two seeded ones ("Baris tidak
 * lengkap.", "Jawapan betul mesti A, B, C atau D.").
 */

import { curriculum } from '@/modules/m03-curriculum/mock'

import type { QuestionInput } from '../repository/questions'

/** The template header (AC-M04-13.6). */
export const IMPORT_HEADER = [
  'question_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'subject_id',
  'education_level_id',
  'difficulty_level',
  'marks',
  'explanation',
  // Optional last column (v2): 1, 2 or 3, empty = none. The mock only carries it; it is not stored.
  'kertas',
] as const

/** Columns the file must have (subject and level may come from the form defaults). */
export const IMPORT_REQUIRED_COLUMNS = [
  'question_text',
  'option_a',
  'option_b',
  'correct_answer',
] as const

/**
 * V2 positional layout (Pariti M04, 2026-11-11; V2 import.blade.php:106-118): the template header. A file whose first row is not a named
 * `question_text` header is read by position (0 body, 1-4 options, 5 correct, 6 difficulty, optional 7 kertas); row 1 is skipped.
 */
export const IMPORT_V2_HEADER = ['body', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'difficulty'] as const
/** V2 `(int) ($row[6] ?? 3) ?: 3`: a missing, empty or 0 difficulty cell is 3. */
export const IMPORT_V2_DEFAULT_DIFFICULTY = 3

/** FR-M04-57 / §6.12: the template file (V2 header + 2 sample rows; the optional kertas is accepted on import only). */
export const IMPORT_TEMPLATE_CSV = [
  IMPORT_V2_HEADER.join(','),
  '"Berapakah hasil tambah dua dan tiga?",4,5,6,7,B,2',
  '"Apakah ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,A,3',
  '',
].join('\r\n')

export const MSG_INCOMPLETE = 'Baris tidak lengkap.'
export const MSG_ANSWER = 'Jawapan betul mesti A, B, C atau D.'
export const MSG_ANSWER_EMPTY_OPTION = 'Jawapan betul merujuk pilihan yang kosong.'
export const MSG_SUBJECT = 'Subjek tidak sah.'
export const MSG_LEVEL = 'Tahap pendidikan tidak sah.'
export const MSG_DIFFICULTY = 'Tahap kesukaran mesti 1 hingga 5.'
export const MSG_MARKS = 'Markah mesti nombor bulat sekurang-kurangnya 1.'
export const MSG_KERTAS = 'Kertas tidak sah.'

export interface CsvRecord {
  /** 1-based line of the file where the record starts. */
  line: number
  cells: string[]
}

/** Splits CSV text into records; quoted fields may contain commas, `""` and line breaks. */
export function parseCsv(text: string): CsvRecord[] {
  const src = text.replace(/^﻿/, '')
  const records: CsvRecord[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let startLine = 1
  let touched = false

  const endCell = () => {
    cells.push(cell.trim())
    cell = ''
  }
  const endRecord = () => {
    endCell()
    // A line with no text at all (also ",,,,", as spreadsheets export blank rows) is not a record.
    if (touched && cells.some((c) => c !== '')) records.push({ line: startLine, cells })
    cells = []
    touched = false
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        if (ch === '\n') line++
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      if (!touched) startLine = line
      touched = true
      cell = ''
      quoted = true
    } else if (ch === ',') {
      if (!touched) startLine = line
      touched = true
      endCell()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      endRecord()
      line++
    } else {
      if (!touched) startLine = line
      if (ch.trim() !== '') touched = true
      cell += ch
    }
  }
  if (touched || cell !== '' || cells.length > 0) endRecord()
  return records
}

export interface ImportDefaults {
  subjectId: number | null
  educationLevelId: number | null
  difficultyLevel: number | null
}

export interface ImportLookups {
  subjectExists(id: number): boolean
  levelExists(id: number): boolean
}

export interface PlannedRow {
  line: number
  input: QuestionInput
}

export interface ImportPlan {
  /** Required header columns the file lacks (a non-empty list refuses the file). */
  missingColumns: string[]
  rows: PlannedRow[]
  failures: { row: number; message: string }[]
  /** Data records seen (planned + failed). */
  dataRows: number
}

function toInt(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null
}

/** No form defaults (a teacher import: every column must come from the file, except marks). */
export const NO_IMPORT_DEFAULTS: ImportDefaults = {
  subjectId: null,
  educationLevelId: null,
  difficultyLevel: null,
}

/** Default lookups: the M03 subjects and education levels (read at call time). */
export const CURRICULUM_LOOKUPS: ImportLookups = {
  subjectExists: (id) => curriculum.subject(id) !== undefined,
  levelExists: (id) => curriculum.level(id) !== undefined,
}

/**
 * Parses the file text into planned questions and per-row failures. `defaults` (default: none) and
 * `lookups` (default: the M03 curriculum) are optional; the M04 S5 handler passes both, so its
 * output is unchanged.
 */
export function planImport(
  text: string,
  defaults: ImportDefaults = NO_IMPORT_DEFAULTS,
  lookups: ImportLookups = CURRICULUM_LOOKUPS,
): ImportPlan {
  const [header, ...data] = parseCsv(text)
  const plan: ImportPlan = { missingColumns: [], rows: [], failures: [], dataRows: 0 }
  if (!header) {
    plan.missingColumns = [...IMPORT_REQUIRED_COLUMNS]
    return plan
  }
  const index = new Map<string, number>()
  header.cells.forEach((name, i) => {
    const key = name.trim().toLowerCase()
    if (!index.has(key)) index.set(key, i)
  })
  // A named `question_text` header (or a Q-11 `question_key` one) keeps the named path; any other first row is the V2 positional layout.
  if (!index.has('question_text') && !index.has('question_key')) {
    planV2(data, defaults, lookups, plan)
    return plan
  }
  plan.missingColumns = IMPORT_REQUIRED_COLUMNS.filter((c) => !index.has(c))
  if (plan.missingColumns.length > 0) return plan

  for (const rec of data) {
    plan.dataRows++
    const get = (col: string): string => {
      const i = index.get(col)
      return i === undefined ? '' : (rec.cells[i] ?? '')
    }
    const fail = (message: string) => plan.failures.push({ row: rec.line, message })

    const questionText = get('question_text')
    const a = get('option_a')
    const b = get('option_b')
    const answer = get('correct_answer')
    if (questionText === '' || a === '' || b === '' || answer === '') {
      fail(MSG_INCOMPLETE)
      continue
    }
    const letter = answer.toUpperCase()
    if (!/^[A-D]$/.test(letter)) {
      fail(MSG_ANSWER)
      continue
    }
    const options = [a, b, get('option_c'), get('option_d')]
    const correctAnswer = letter.charCodeAt(0) - 65
    if ((options[correctAnswer] as string) === '') {
      fail(MSG_ANSWER_EMPTY_OPTION)
      continue
    }

    const subjectCell = get('subject_id')
    const subjectId = subjectCell === '' ? defaults.subjectId : toInt(subjectCell)
    if (subjectId === null || !lookups.subjectExists(subjectId)) {
      fail(MSG_SUBJECT)
      continue
    }
    const levelCell = get('education_level_id')
    const levelId = levelCell === '' ? defaults.educationLevelId : toInt(levelCell)
    if (levelId === null || !lookups.levelExists(levelId)) {
      fail(MSG_LEVEL)
      continue
    }
    const difficultyCell = get('difficulty_level')
    const difficulty = difficultyCell === '' ? defaults.difficultyLevel : toInt(difficultyCell)
    if (difficulty === null || difficulty < 1 || difficulty > 5) {
      fail(MSG_DIFFICULTY)
      continue
    }
    const marksCell = get('marks')
    const marks = marksCell === '' ? 1 : toInt(marksCell)
    if (marks === null || marks < 1) {
      fail(MSG_MARKS)
      continue
    }
    const explanation = get('explanation')
    plan.rows.push({
      line: rec.line,
      input: {
        subjectId,
        educationLevelId: levelId,
        difficultyLevel: difficulty,
        questionType: 'mcq',
        questionText,
        options,
        correctAnswer,
        explanation: explanation === '' ? null : explanation,
        pointsValue: marks,
      },
    })
  }
  return plan
}

/** V2 rows: subject and level from the dialog defaults only (none = the usual failure); the named-path row checks stay. */
function planV2(data: CsvRecord[], defaults: ImportDefaults, lookups: ImportLookups, plan: ImportPlan): void {
  for (const rec of data) {
    plan.dataRows++
    const cell = (i: number): string => rec.cells[i] ?? ''
    const fail = (message: string) => plan.failures.push({ row: rec.line, message })
    const questionText = cell(0)
    const a = cell(1)
    const b = cell(2)
    const answer = cell(5)
    if (questionText === '' || a === '' || b === '' || answer === '') {
      fail(MSG_INCOMPLETE)
      continue
    }
    const letter = answer.toUpperCase()
    if (!/^[A-D]$/.test(letter)) {
      fail(MSG_ANSWER)
      continue
    }
    const options = [a, b, cell(3), cell(4)]
    const correctAnswer = letter.charCodeAt(0) - 65
    if ((options[correctAnswer] as string) === '') {
      fail(MSG_ANSWER_EMPTY_OPTION)
      continue
    }
    const subjectId = defaults.subjectId
    if (subjectId === null || !lookups.subjectExists(subjectId)) {
      fail(MSG_SUBJECT)
      continue
    }
    const levelId = defaults.educationLevelId
    if (levelId === null || !lookups.levelExists(levelId)) {
      fail(MSG_LEVEL)
      continue
    }
    const difficultyCell = cell(6)
    const parsed = difficultyCell === '' ? IMPORT_V2_DEFAULT_DIFFICULTY : toInt(difficultyCell)
    if (parsed === null || parsed > 5) {
      fail(MSG_DIFFICULTY)
      continue
    }
    const kertas = cell(7)
    if (kertas !== '' && !['1', '2', '3', '4'].includes(kertas)) {
      fail(MSG_KERTAS)
      continue
    }
    plan.rows.push({
      line: rec.line,
      input: {
        subjectId,
        educationLevelId: levelId,
        difficultyLevel: parsed === 0 ? IMPORT_V2_DEFAULT_DIFFICULTY : parsed,
        questionType: 'mcq',
        questionText,
        options,
        correctAnswer,
        explanation: null,
        pointsValue: 1,
      },
    })
  }
}
