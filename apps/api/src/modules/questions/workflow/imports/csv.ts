import {
  QUESTION_IMPORT_REQUIRED_COLUMNS,
  QUESTION_IMPORT_ROW_MESSAGES as MSG,
  neutraliseQuestionImportCsvCell,
  type QuestionImportFailure,
} from '@pp/contract'

import type { ImportedQuestionInput } from '../ports'

/**
 * CSV parsing and row planning of the question import (mock `m04-question-bank/mock/import/csv.ts`
 * and `m10-teacher-class/mock/handlers/csv.ts`). Pure functions: no database, no clock.
 */

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
      } else if (ch === '\n' || ch === '\r') {
        // CRLF (files made on Windows) and a lone CR both become one LF inside a cell.
        if (ch === '\r' && src[i + 1] === '\n') i++
        line++
        cell += '\n'
      } else {
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

/** Form defaults of the admin import (ids are decimal strings on the wire). */
export interface ImportDefaults {
  subjectId: string | null
  educationLevelId: string | null
  difficultyLevel: number | null
}

export const NO_IMPORT_DEFAULTS: ImportDefaults = { subjectId: null, educationLevelId: null, difficultyLevel: null }

/** The ids that exist in the curriculum tables. */
export interface ImportLookups {
  subjectIds: ReadonlySet<string>
  levelIds: ReadonlySet<string>
}

/** The Guru caps (SRS M10 S22): question text up to 2000, each option up to 500 characters. */
export interface ImportCaps {
  textMax: number
  optionMax: number
}
export const GURU_IMPORT_CAPS: ImportCaps = { textMax: 2000, optionMax: 500 }

export interface PlannedRow {
  line: number
  input: Omit<ImportedQuestionInput, 'createdById' | 'status'>
}

export interface ImportPlan {
  /** Required header columns the file lacks (a non-empty list refuses the file). */
  missingColumns: string[]
  rows: PlannedRow[]
  failures: QuestionImportFailure[]
  /** Data records seen (planned + failed). */
  dataRows: number
}

const toInt = (value: string): number | null => (/^\d{1,9}$/.test(value) ? Number(value) : null)
/** A positive decimal id without leading zeros trouble: "007" is the same id as "7". */
const toId = (value: string): string | null => (/^\d{1,18}$/.test(value) ? String(BigInt(value)) : null)

/** BE-09 stores MCQs with 3 to 8 options (contract `QuestionLeafPart`), so a row with fewer is a failed row, not a rolled-back import. */
const MIN_OPTIONS = 3
/** BE-09 has no text for this rule (its contract uses the generic schema message); this copy is the lead's fallback. */
export const MIN_OPTIONS_MESSAGE = 'Pilihan jawapan mesti sekurang-kurangnya 3.'

export function planImport(
  text: string,
  lookups: ImportLookups,
  defaults: ImportDefaults = NO_IMPORT_DEFAULTS,
  caps: ImportCaps | null = null,
): ImportPlan {
  const [header, ...data] = parseCsv(text)
  const plan: ImportPlan = { missingColumns: [], rows: [], failures: [], dataRows: 0 }
  if (!header) {
    plan.missingColumns = [...QUESTION_IMPORT_REQUIRED_COLUMNS]
    return plan
  }
  const index = new Map<string, number>()
  header.cells.forEach((name, i) => {
    const key = name.trim().toLowerCase()
    if (!index.has(key)) index.set(key, i)
  })
  plan.missingColumns = QUESTION_IMPORT_REQUIRED_COLUMNS.filter((c) => !index.has(c))
  if (plan.missingColumns.length > 0) return plan

  for (const rec of data) {
    plan.dataRows++
    const get = (col: string): string => {
      const i = index.get(col)
      return i === undefined ? '' : (rec.cells[i] ?? '')
    }
    const fail = (message: string) => plan.failures.push({ row: rec.line, message })

    const stemMs = get('question_text')
    const a = get('option_a')
    const b = get('option_b')
    const answer = get('correct_answer')
    if (stemMs === '' || a === '' || b === '' || answer === '') {
      fail(MSG.incomplete)
      continue
    }
    const letter = answer.toUpperCase()
    if (!/^[A-D]$/.test(letter)) {
      fail(MSG.answer)
      continue
    }
    const texts = [a, b, get('option_c'), get('option_d')]
    const correct = letter.charCodeAt(0) - 65
    if ((texts[correct] as string) === '') {
      fail(MSG.answerEmptyOption)
      continue
    }

    const subjectCell = get('subject_id')
    const subjectId = subjectCell === '' ? defaults.subjectId : toId(subjectCell)
    if (subjectId === null || !lookups.subjectIds.has(subjectId)) {
      fail(MSG.subject)
      continue
    }
    const levelCell = get('education_level_id')
    const levelId = levelCell === '' ? defaults.educationLevelId : toId(levelCell)
    if (levelId === null || !lookups.levelIds.has(levelId)) {
      fail(MSG.level)
      continue
    }
    const difficultyCell = get('difficulty_level')
    const difficulty = difficultyCell === '' ? defaults.difficultyLevel : toInt(difficultyCell)
    if (difficulty === null || difficulty < 1 || difficulty > 5) {
      fail(MSG.difficulty)
      continue
    }
    const marksCell = get('marks')
    const marks = marksCell === '' ? 1 : toInt(marksCell)
    if (marks === null || marks < 1) {
      fail(MSG.marks)
      continue
    }
    if (texts.filter((t) => t !== '').length < MIN_OPTIONS) {
      fail(MIN_OPTIONS_MESSAGE)
      continue
    }
    if (caps && [...stemMs].length > caps.textMax) {
      fail(MSG.textTooLong)
      continue
    }
    if (caps && texts.some((o) => [...o].length > caps.optionMax)) {
      fail(MSG.optionTooLong)
      continue
    }
    const explanation = get('explanation')
    plan.rows.push({
      line: rec.line,
      input: {
        stemMs,
        options: texts.flatMap((t, i) => (t === '' ? [] : [{ label: String.fromCharCode(65 + i), text: t }])),
        correctLabel: letter,
        subjectId,
        educationLevelId: levelId,
        difficultyLevel: difficulty,
        explanation: explanation === '' ? null : explanation,
        sourceType: 'excel',
        sourceSet: null,
        marks,
      },
    })
  }
  return plan
}

/** One CSV cell of a generated file: formula neutralised (`=`, `+`, `-`, `@`), quoted when needed. */
export function csvCell(value: string): string {
  const safe = neutraliseQuestionImportCsvCell(value)
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** A CSV text with CRLF line ends and a trailing CRLF; every cell is neutralised. */
export function buildCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
