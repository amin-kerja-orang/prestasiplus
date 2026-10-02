/**
 * Text helpers of the M02 imports (SRS v1.28 BR-14, BR-15): CSV / paste parsing into records with
 * their 1-based line numbers, header detection and Title Case. Pure functions, no store access.
 *
 * INFERRED (URS OQ-2; live copy of the import result was not observed): blank lines are ignored,
 * fields are split on commas with optional double quotes ("a, b" and "" as an escaped quote), and a
 * UTF-8 byte-order mark is dropped. Line numbers count the original text (blank lines included), so
 * an `ImportResult.errors[].line` matches what the admin sees in the file or textarea.
 */

import { email } from '@/mock/define'

export interface ImportRecord {
  /** 1-based line number in the submitted text (the first line of a paste block). */
  line: number
  /** Trimmed fields (missing trailing fields are `''`). */
  cells: string[]
}

/** Splits a text into lines (LF, CRLF or CR) after dropping a leading BOM. */
export function textLines(text: string): string[] {
  return text.replace(/^﻿/, '').split(/\r\n|\r|\n/)
}

/** One CSV line into trimmed fields; double quotes protect commas ("" is a literal quote). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    } else if (ch === ',') {
      out.push(cell.trim())
      cell = ''
    } else {
      cell += ch
    }
  }
  out.push(cell.trim())
  return out
}

/** Every non-blank line as a record (comma-separated, BR-14 / BR-15 CSV). */
export function csvRecords(text: string): ImportRecord[] {
  const records: ImportRecord[] = []
  textLines(text).forEach((raw, index) => {
    if (raw.trim() === '') return
    records.push({ line: index + 1, cells: parseCsvLine(raw) })
  })
  return records
}

/**
 * The DELIMa paste format (BR-15): records are blocks separated by one or more blank lines; the
 * lines of a block are name, DELIMa e-mail, password and an optional IC number.
 */
export function pasteBlocks(text: string): ImportRecord[] {
  const records: ImportRecord[] = []
  let block: { line: number; cells: string[] } | null = null
  textLines(text).forEach((raw, index) => {
    if (raw.trim() === '') {
      if (block) records.push(block)
      block = null
      return
    }
    if (!block) block = { line: index + 1, cells: [] }
    block.cells.push(raw.trim())
  })
  if (block) records.push(block)
  return records
}

export function isEmail(value: string): boolean {
  return email().check(value, { field: 'email', input: {} }) === null
}

/**
 * INFERRED (BR-14): the first record is a header when its second column is not an e-mail. Returns
 * the records without that header.
 */
export function withoutHeader(records: ImportRecord[]): ImportRecord[] {
  const [first, ...rest] = records
  if (first && !isEmail(first.cells[1] ?? '')) return rest
  return records
}

/** Title Case: the first letter of each space-separated word upper-case, the rest lower-case. */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) =>
      word === '' ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ')
}

/** The text of an uploaded file (`Blob`/`File`) or of a string sent in a JSON body. */
export async function readImportFile(value: unknown): Promise<string | undefined> {
  if (typeof value === 'string') return value
  if (typeof Blob !== 'undefined' && value instanceof Blob) return await value.text()
  return undefined
}
