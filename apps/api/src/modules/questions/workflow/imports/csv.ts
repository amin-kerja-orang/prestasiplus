import {
  QUESTION_COGNITIVE_LEVELS,
  QUESTION_IMPORT_CODE_ALIAS_COLUMNS,
  QUESTION_IMPORT_CODE_HEADER,
  QUESTION_IMPORT_CODE_REQUIRED_COLUMNS,
  QUESTION_IMPORT_CODE_ROW_MESSAGES as CODE_MSG,
  QUESTION_IMPORT_MAX_ROWS,
  QUESTION_IMPORT_MESSAGES,
  QUESTION_IMPORT_REQUIRED_COLUMNS,
  QUESTION_IMPORT_ROW_MESSAGES as MSG,
  QUESTION_KBAT_LEVELS,
  neutraliseQuestionImportCsvCell,
  questionImportRowPrefix,
  type QuestionImportErrorCode,
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
/** `limit`: stop once this many records were read (a caller that only needs to know the file is over its row cap does not build the rest). */
export function parseCsv(text: string, limit = Number.POSITIVE_INFINITY): CsvRecord[] {
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

  for (let i = 0; i < src.length && records.length < limit; i++) {
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
  if (records.length < limit && (touched || cell !== '' || cells.length > 0)) endRecord()
  return records
}

/** Form defaults of the admin import (ids are decimal strings on the wire). */
export interface ImportDefaults {
  subjectId: string | null
  educationLevelId: string | null
  difficultyLevel: number | null
}

export const NO_IMPORT_DEFAULTS: ImportDefaults = { subjectId: null, educationLevelId: null, difficultyLevel: null }

/** What the new header needs to know of ONE Subjek + Tingkatan (loaded read-only through `CurriculumRepository` by the service). */
export interface CurriculumFacts {
  subjectId: string
  levelId: string
  /** `curriculum_nodes` exist: unit, SP, TP and aras are then required on every row. */
  hasDskpNodes: boolean
  /** The subject is in the SPM catalogue and the level is Tingkatan 4 or 5: Kertas is then required. */
  spmBound: boolean
  /** Printed unit code to node ids (one code can exist in several editions). */
  units: ReadonlyMap<string, readonly string[]>
  /** Printed SP code to the nodes with that code and the unit nodes above each. */
  sps: ReadonlyMap<string, readonly { id: string; unitIds: ReadonlySet<string> }[]>
  /** Chapter number (`bab_kod`) to the chapter id and its topics by topic number (`topik_kod`). */
  chapters: ReadonlyMap<string, { id: string; topics: ReadonlyMap<string, string> }>
}

/** The code maps of the new header: subject code and level code to ids, and the facts of each Subjek + Tingkatan the file uses (key `subjectId:levelId`). */
export interface CodeLookups {
  subjectsByCode: ReadonlyMap<string, string>
  levelsByCode: ReadonlyMap<string, string>
  facts: ReadonlyMap<string, CurriculumFacts>
}

/** The ids that exist in the curriculum tables (and, for the new header, the code maps). */
export interface ImportLookups {
  subjectIds: ReadonlySet<string>
  levelIds: ReadonlySet<string>
  codes?: CodeLookups
}

/** The Guru caps (SRS M10 S22): question text up to 2000, each option up to 500 characters. */
export interface ImportCaps {
  textMax: number
  optionMax: number
}
export const GURU_IMPORT_CAPS: ImportCaps = { textMax: 2000, optionMax: 500 }

export interface PlannedRow {
  line: number
  /** New header only. */
  questionKey?: string
  input: Omit<ImportedQuestionInput, 'createdById' | 'status'>
}

export interface ImportPlan {
  /** Required header columns the file lacks (a non-empty list refuses the file). */
  missingColumns: string[]
  rows: PlannedRow[]
  failures: QuestionImportFailure[]
  /** Data records seen (planned + failed). */
  dataRows: number
  /** Questions skipped (the `m` of "{n} soalan diimport, {m} gagal."); a row of the new header can carry several failures. */
  failedQuestions: number
  /** More than `QUESTION_IMPORT_MAX_ROWS` data rows: the file is refused whole (nothing is planned). */
  rowLimitExceeded: boolean
  /** "Kolum {nama} tidak dikenali dan diabaikan." per unknown header cell (new header only). */
  warnings: string[]
  /** Which header the file uses. */
  format: 'legacy' | 'codes'
}

const toInt = (value: string): number | null => (/^\d{1,9}$/.test(value) ? Number(value) : null)
/** A positive decimal id without leading zeros trouble: "007" is the same id as "7". */
const toId = (value: string): string | null => (/^\d{1,18}$/.test(value) ? String(BigInt(value)) : null)

/** BE-09 stores MCQs with 3 to 8 options (contract `QuestionLeafPart`), so a row with fewer is a failed row, not a rolled-back import. */
/** 3..8 options: the contract and the S1-T05 card win over Q-11's "2 hingga 8" (deviation recorded in the PR). */
const MIN_OPTIONS = 3
/** BE-09 has no text for this rule (its contract uses the generic schema message); this copy is the lead's fallback. */
export const MIN_OPTIONS_MESSAGE = 'Pilihan jawapan mesti sekurang-kurangnya 3.'

/**
 * The legacy (positional) header starts with `question_text`; anything else is the new header (D115 rule a). A legacy file with its columns
 * in another order (the importer always matched columns by name, in any order) is still legacy: it has `question_text` and no `question_key`.
 */
export function isLegacyHeader(header: CsvRecord | undefined): boolean {
  if (header === undefined) return true
  const names = header.cells.map((c) => c.trim().toLowerCase())
  return names[0] === 'question_text' || (names.includes('question_text') && !names.includes('question_key'))
}

export function planImport(
  text: string | CsvRecord[],
  lookups: ImportLookups,
  defaults: ImportDefaults = NO_IMPORT_DEFAULTS,
  caps: ImportCaps | null = null,
): ImportPlan {
  const [header, ...data] = typeof text === 'string' ? parseCsv(text) : text
  const plan: ImportPlan = { missingColumns: [], rows: [], failures: [], dataRows: 0, failedQuestions: 0, rowLimitExceeded: false, warnings: [], format: 'legacy' }
  if (!header) {
    plan.missingColumns = [...QUESTION_IMPORT_REQUIRED_COLUMNS]
    return plan
  }
  const index = new Map<string, number>()
  header.cells.forEach((name, i) => {
    const key = name.trim().toLowerCase()
    if (!index.has(key)) index.set(key, i)
  })
  const legacy = isLegacyHeader(header)
  plan.format = legacy ? 'legacy' : 'codes'
  // The row cap comes first: an oversized file gets the 422 row-cap error whatever its columns.
  if (data.length > QUESTION_IMPORT_MAX_ROWS) {
    plan.rowLimitExceeded = true
    plan.dataRows = data.length
    return plan
  }
  plan.missingColumns = (legacy ? QUESTION_IMPORT_REQUIRED_COLUMNS : QUESTION_IMPORT_CODE_REQUIRED_COLUMNS).filter((c) => !index.has(c))
  if (plan.missingColumns.length > 0) return plan
  if (!legacy) {
    planCodeRows(header, data, index, lookups, defaults, caps, plan)
    return plan
  }

  for (const rec of data) {
    plan.dataRows++
    const get = (col: string): string => {
      const i = index.get(col)
      return i === undefined ? '' : (rec.cells[i] ?? '')
    }
    const fail = (message: string) => {
      plan.failures.push({ row: rec.line, message })
      plan.failedQuestions++
    }

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
    const kertasCell = get('kertas').trim()
    if (kertasCell !== '' && kertasCell !== '1' && kertasCell !== '2' && kertasCell !== '3') {
      fail(MSG.kertas)
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
        ...(kertasCell === '' ? {} : { kertas: kertasCell as '1' | '2' | '3' }),
      },
    })
  }
  return plan
}

// --- the new (code) header ---------------------------------------------------------------------

const KNOWN_CODE_COLUMNS: ReadonlySet<string> = new Set<string>([...QUESTION_IMPORT_CODE_HEADER, ...QUESTION_IMPORT_CODE_ALIAS_COLUMNS])
/** Types of the Q-11 list: only `mcq` is read in part 1, the rest go through the Studio wizard for now. */
const OTHER_Q11_TYPES: ReadonlySet<string> = new Set(['mcq_multi', 'true_false', 'match', 'short_answer', 'fill_blank', 'structured', 'working', 'essay', 'drawing', 'table_fill', 'essay_choice'])
const COGNITIVE: ReadonlySet<string> = new Set(QUESTION_COGNITIVE_LEVELS)
const KBAT: ReadonlySet<string> = new Set([...QUESTION_KBAT_LEVELS, 'bukan'])
const OPTION_LETTERS = 'ABCDEFGH'
const KEY_MAX = 40
/** Part 1 keeps the contract's Kertas 1..3 (S1-T03 widens it to 1..4). */
const KERTAS_VALUES: ReadonlySet<string> = new Set(['1', '2', '3'])

/** `bab_kod` / `topik_kod` cells compare as text, a number without leading zeros ("03" is "3"). */
export const numberKey = (value: string): string => (/^\d{1,9}$/.test(value) ? String(Number(value)) : value)
export const factsKey = (subjectId: string, levelId: string): string => `${subjectId}:${levelId}`

/** Subject id and level id a code row names (cell, else the form default), or null where it names none. Shared with the service's lookup loader. */
export function resolveSubjectLevel(
  get: (col: string) => string,
  codes: CodeLookups,
  defaults: ImportDefaults,
): { subjectId: string | null; levelId: string | null; subjectOk: boolean; levelOk: boolean } {
  const subjectCell = get('subject_code')
  const subjectId = subjectCell === '' ? defaults.subjectId : (codes.subjectsByCode.get(subjectCell.toUpperCase()) ?? null)
  const levelCell = get('tingkatan').toUpperCase()
  const levelCode = /^[1-5]$/.test(levelCell) ? `T${levelCell}` : /^T[1-5]$/.test(levelCell) ? levelCell : null
  const levelId = levelCell === '' ? defaults.educationLevelId : levelCode === null ? null : (codes.levelsByCode.get(levelCode) ?? null)
  return { subjectId, levelId, subjectOk: subjectId !== null, levelOk: levelId !== null }
}

function planCodeRows(
  header: CsvRecord,
  data: CsvRecord[],
  index: ReadonlyMap<string, number>,
  lookups: ImportLookups,
  defaults: ImportDefaults,
  caps: ImportCaps | null,
  plan: ImportPlan,
): void {
  const codes: CodeLookups = lookups.codes ?? { subjectsByCode: new Map(), levelsByCode: new Map(), facts: new Map() }
  const warned = new Set<string>()
  for (const name of header.cells) {
    const n = name.trim()
    const key = n.toLowerCase()
    if (n !== '' && !KNOWN_CODE_COLUMNS.has(key) && !warned.has(key)) {
      warned.add(key)
      plan.warnings.push(QUESTION_IMPORT_MESSAGES.unknownColumn(n))
    }
  }
  const textMax = caps?.textMax ?? 2000
  const optionMax = caps?.optionMax ?? 500
  const seenKeys = new Set<string>()
  let lastKey: string | null = null

  for (const rec of data) {
    plan.dataRows++
    const get = (col: string): string => {
      const i = index.get(col)
      return i === undefined ? '' : (rec.cells[i] ?? '')
    }
    const key = get('question_key')
    const errors: { field: string; code: QuestionImportErrorCode; message: string }[] = []
    const bad = (field: string, code: QuestionImportErrorCode, message: string) => errors.push({ field, code, message })

    // question_key: required; the rows of one question are consecutive (an MCQ is one row in part 1, so a repeat right after is a duplicate).
    if (key === '') bad('question_key', 'KEY_REQUIRED', CODE_MSG.keyRequired)
    else if (key === lastKey) bad('question_key', 'KEY_DUPLICATE', CODE_MSG.keyDuplicate(key))
    else if (seenKeys.has(key)) bad('question_key', 'KEY_NOT_CONSECUTIVE', CODE_MSG.keyNotConsecutive)
    if (key !== '') {
      seenKeys.add(key)
      lastKey = key
    } else lastKey = null

    const type = get('type').toLowerCase()
    if (type === '' || (type !== 'mcq' && !OTHER_Q11_TYPES.has(type))) bad('type', 'TYPE_INVALID', CODE_MSG.typeInvalid)
    else if (type !== 'mcq') bad('type', 'TYPE_STUDIO_ONLY', CODE_MSG.typeStudio)

    // Prompt, options, key, marks.
    const stem = get('prompt_ms')
    if ([...stem].length < 10) bad('prompt_ms', 'PROMPT_SHORT', CODE_MSG.promptShort)
    else if ([...stem].length > textMax) bad('prompt_ms', 'PROMPT_LONG', MSG.textTooLong)
    const texts = [...OPTION_LETTERS].map((l) => get(`option_${l.toLowerCase()}`))
    const filled = texts.findLastIndex((t) => t !== '') + 1
    if (texts[0] === '' || texts[1] === '' || texts.slice(0, filled).some((t) => t === '')) bad('option_a', 'OPTIONS_BLANK', CODE_MSG.optionsBlank)
    else if (filled < MIN_OPTIONS) bad('option_c', 'OPTIONS_MIN', MIN_OPTIONS_MESSAGE)
    if (texts.some((o) => [...o].length > optionMax)) bad('option_a', 'OPTION_LONG', MSG.optionTooLong)
    const correct = get('correct').toUpperCase()
    const correctAt = /^[A-H]$/.test(correct) ? correct.charCodeAt(0) - 65 : -1
    if (correctAt < 0 || correctAt >= filled || texts[correctAt] === '') bad('correct', 'CORRECT_REQUIRED', CODE_MSG.correctRequired)
    const marksCell = get('marks')
    const marks = toInt(marksCell)
    if (marks === null || marks < 1) bad('marks', 'MARKS_MIN', CODE_MSG.marksMin)
    else if (marks > 100) bad('marks', 'MARKS_MAX', CODE_MSG.marksMax)

    // Subjek, Tingkatan, language, script, number label, Kertas.
    const { subjectId, levelId } = resolveSubjectLevel(get, codes, defaults)
    if (subjectId === null) bad('subject_code', 'SUBJECT_UNKNOWN', CODE_MSG.subject)
    if (levelId === null) bad('tingkatan', 'TINGKATAN_INVALID', CODE_MSG.tingkatan)
    const bahasa = get('bahasa').toLowerCase()
    if (!['', 'ms', 'bm', 'en', 'ms+en'].includes(bahasa)) bad('bahasa', 'BAHASA_INVALID', CODE_MSG.bahasa)
    if (!['', 'rumi', 'arab', 'jawi', 'mixed'].includes(get('jenis_tulisan').toLowerCase())) bad('jenis_tulisan', 'SCRIPT_INVALID', CODE_MSG.jenisTulisan)
    const numberLabel = get('number_label')
    if (numberLabel !== '' && !/^[0-9]{1,3}[A-Za-z]?$/.test(numberLabel)) bad('number_label', 'NUMBER_LABEL_INVALID', CODE_MSG.numberLabel)
    const kertasCell = get('kertas')
    if (kertasCell !== '' && !KERTAS_VALUES.has(kertasCell)) bad('kertas', 'KERTAS_INVALID', MSG.kertas)

    const facts = subjectId !== null && levelId !== null ? codes.facts.get(factsKey(subjectId, levelId)) : undefined
    const known = subjectId !== null && levelId !== null
    if (kertasCell === '' && facts?.spmBound === true) bad('kertas', 'KERTAS_REQUIRED', CODE_MSG.kertasSpm)

    // DSKP columns. They are required once the Subjek + Tingkatan has DSKP nodes.
    const needDskp = facts?.hasDskpNodes === true
    // The messages wrap the label in brackets themselves: `(a)` is shown as `Bahagian (a)`.
    const label = (get('part_label') || '1').replace(/^\((.*)\)$/, '$1')
    let unitId: string | null = null
    const unitCell = get('unit_code')
    if (unitCell === '') {
      if (needDskp) bad('unit_code', 'UNIT_REQUIRED', CODE_MSG.unitRequired)
    } else if (known) {
      unitId = facts?.units.get(unitCell)?.[0] ?? null
      if (unitId === null) bad('unit_code', 'UNIT_UNKNOWN', CODE_MSG.unitUnknown)
    }
    const spCodes = [...new Set(get('sp_kod').split(';').map((c) => c.trim()).filter((c) => c !== ''))]
    const spIds: string[] = []
    if (spCodes.length === 0) {
      if (needDskp) bad('sp_kod', 'SP_REQUIRED', CODE_MSG.spRequired)
    } else if (spCodes.length > 3) {
      bad('sp_kod', 'SP_TOO_MANY', CODE_MSG.spTooMany)
    } else if (known) {
      for (const code of spCodes) {
        const candidates = facts?.sps.get(code) ?? []
        const hit = unitId === null ? candidates[0] : candidates.find((c) => c.unitIds.has(unitId as string))
        if (!hit) {
          bad('sp_kod', 'SP_UNKNOWN', CODE_MSG.spUnknown(code))
          break
        }
        spIds.push(hit.id)
      }
    }
    const tpCell = get('tp')
    let tp: number | null = null
    if (tpCell === '') {
      if (needDskp) bad('tp', 'TP_REQUIRED', CODE_MSG.tpMissing(label))
    } else {
      tp = toInt(tpCell)
      if (tp === null || tp < 1 || tp > 6) {
        bad('tp', 'TP_RANGE', CODE_MSG.tpRange)
        tp = null
      }
    }
    const arasCell = get('aras').toLowerCase()
    if (arasCell === '') {
      if (needDskp) bad('aras', 'ARAS_REQUIRED', CODE_MSG.arasMissing(label))
    } else if (!COGNITIVE.has(arasCell)) bad('aras', 'ARAS_INVALID', CODE_MSG.arasInvalid)
    const kbatCell = get('kbat').toLowerCase()
    if (kbatCell !== '' && !KBAT.has(kbatCell)) bad('kbat', 'KBAT_INVALID', CODE_MSG.kbatInvalid)

    // Bab and topic. A row without a Bab is a draft (60 API-Q-17); the publish gate asks for it later.
    let chapterId: string | null = null
    let topicId: string | null = null
    const babCell = get('bab_kod')
    if (babCell !== '' && !known) {
      // Subjek or Tingkatan is already reported: the Bab cannot be judged.
    } else if (babCell !== '') {
      const chapter = facts?.chapters.get(numberKey(babCell))
      if (!chapter) bad('bab_kod', 'CHAPTER_MISMATCH', CODE_MSG.chapterMismatch)
      else {
        chapterId = chapter.id
        const topicCell = get('topik_kod')
        if (topicCell !== '') {
          topicId = chapter.topics.get(numberKey(topicCell)) ?? null
          if (topicId === null) bad('topik_kod', 'TOPIC_INVALID', CODE_MSG.topicInvalid)
        }
      }
    } else if (get('topik_kod') !== '') bad('topik_kod', 'TOPIC_INVALID', CODE_MSG.topicInvalid)

    // Kesukaran: the cell, else the screen default, else min(5, tp).
    const diffCell = get('difficulty') || get('difficulty_level')
    const difficulty = diffCell === '' ? (defaults.difficultyLevel ?? (tp === null ? null : Math.min(5, tp))) : toInt(diffCell)
    if (difficulty === null || difficulty < 1 || difficulty > 5) bad('difficulty', 'DIFFICULTY_INVALID', CODE_MSG.difficulty)

    if (errors.length > 0) {
      plan.failedQuestions++
      for (const e of errors) {
        plan.failures.push({
          row: rec.line,
          message: questionImportRowPrefix(rec.line) + e.message,
          ...(key === '' ? {} : { questionKey: [...key].slice(0, KEY_MAX).join('') }),
          field: e.field,
          code: e.code,
        })
      }
      continue
    }

    const explanation = get('explanation')
    plan.rows.push({
      line: rec.line,
      questionKey: key.slice(0, KEY_MAX),
      input: {
        stemMs: stem,
        options: texts.slice(0, filled).map((t, i) => ({ label: OPTION_LETTERS.charAt(i), text: t })),
        correctLabel: correct,
        subjectId: subjectId as string,
        educationLevelId: levelId as string,
        difficultyLevel: difficulty as number,
        explanation: explanation === '' ? null : explanation,
        sourceType: 'excel',
        sourceSet: null,
        marks: marks as number,
        ...(kertasCell === '' ? {} : { kertas: kertasCell as '1' | '2' | '3' }),
        ...(unitId === null ? {} : { unitId }),
        ...(spIds.length === 0 ? {} : { spIds }),
        ...(tp === null ? {} : { tp }),
        ...(arasCell === '' ? {} : { cognitiveLevel: arasCell as (typeof QUESTION_COGNITIVE_LEVELS)[number] }),
        ...(kbatCell === '' ? {} : { kbat: kbatCell as (typeof QUESTION_KBAT_LEVELS)[number] | 'bukan' }),
        ...(chapterId === null ? {} : { chapterId }),
        ...(topicId === null ? {} : { topicId }),
        ...(numberLabel === '' ? {} : { numberLabel }),
        ...(bahasa === 'en' ? { language: 'en' as const } : {}),
      },
    })
  }
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
