/**
 * Text helpers of the bulk imports (mock `m02-users-schools/mock/import/text.ts`, SRS BR-14, BR-15):
 * CSV / paste parsing into records with their 1-based line numbers, header detection and Title
 * Case. Pure functions, no database. BE-25 reuses them for the student import.
 *
 * Blank lines are ignored, fields are split on commas with optional double quotes ("a, b" and ""
 * as an escaped quote), a UTF-8 byte-order mark is dropped. Line numbers count the original text
 * (blank lines included), so an error line matches what the admin sees in the file.
 */

export interface ImportRecord {
  /** 1-based line number in the submitted text (the first line of a paste block). */
  line: number
  /** Trimmed fields (a missing trailing field is read as `''` by the caller). */
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
    const ch = line.charAt(i)
    if (quoted) {
      if (ch === '"' && line.charAt(i + 1) === '"') {
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

/** Every non-blank line as a record (comma-separated). */
export function csvRecords(text: string): ImportRecord[] {
  const records: ImportRecord[] = []
  textLines(text).forEach((raw, index) => {
    if (raw.trim() === '') return
    records.push({ line: index + 1, cells: parseCsvLine(raw) })
  })
  return records
}

/**
 * The DELIMa paste format (student import): records are blocks separated by one or more blank
 * lines; the lines of a block are the cells.
 */
export function pasteBlocks(text: string): ImportRecord[] {
  const records: ImportRecord[] = []
  let block: ImportRecord | null = null
  textLines(text).forEach((raw, index) => {
    if (raw.trim() === '') {
      if (block) records.push(block)
      block = null
      return
    }
    block ??= { line: index + 1, cells: [] }
    block.cells.push(raw.trim())
  })
  if (block) records.push(block)
  return records
}

/** WHATWG `type=email` syntax, as the mock's shared e-mail rule. */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/** Longest e-mail the `users.email` column of an account accepts through the forms (255). */
export const EMAIL_MAX = 255

export function isEmail(value: string): boolean {
  return value.length <= EMAIL_MAX && EMAIL_RE.test(value)
}

/**
 * The first record is a header when its second column is not an e-mail. Returns the records
 * without that header.
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
    .map((word) => (word === '' ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ')
}
