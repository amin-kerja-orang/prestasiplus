/**
 * Client rules and helpers of the CSV import 44-F3 (FR-GUR-44-12): `.csv` only, 2 MB, 500 data rows, the result
 * line, and the error file `ralat-import-{yyyymmdd}.csv` built from `errors[{row, message}]` plus the uploaded text.
 */
import type { ImportFailure } from '../../api/types'

export const CSV_LIMITS = { bytes: 2 * 1024 * 1024, rows: 500 } as const

export const CSV_MESSAGES = {
  noFile: 'Sila pilih fail.',
  fileType: 'Jenis fail tidak disokong. Format dibenarkan: CSV.',
  fileSize: 'Fail melebihi saiz maksimum 2 MB.',
  tooManyRows: 'Fail melebihi 500 baris.',
} as const

/** The template file name when the response carries none (44-F3). */
export const TEMPLATE_FALLBACK_NAME = 'templat-soalan.csv'

/** The error of a chosen file before it is read (`null` = valid): none, not `.csv`, over 2 MB. */
export function validateCsvFile(file: { name: string; size: number } | null): string | null {
  if (file === null) return CSV_MESSAGES.noFile
  if (!/\.csv$/i.test(file.name)) return CSV_MESSAGES.fileType
  if (file.size > CSV_LIMITS.bytes) return CSV_MESSAGES.fileSize
  return null
}

export interface CsvRecord {
  /** 1-based file line where the record starts (the header is line 1), as the server numbers rows. */
  line: number
  /** The record exactly as uploaded (quotes and line breaks kept). */
  raw: string
  cells: string[]
}

/** Splits CSV text into records; quoted fields may hold commas, `""` and line breaks; a blank line is no record. */
export function parseCsvRecords(text: string): CsvRecord[] {
  const src = text.replace(/^﻿/, '')
  const records: CsvRecord[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let startLine = 1
  let startIndex = 0
  let touched = false

  const endRecord = (end: number): void => {
    cells.push(cell.trim())
    cell = ''
    if (touched && cells.some((c) => c !== '')) {
      records.push({ line: startLine, raw: src.slice(startIndex, end), cells })
    }
    cells = []
    touched = false
  }
  const begin = (i: number): void => {
    if (!touched) {
      startLine = line
      startIndex = i
    }
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else {
        if (ch === '\n') line++
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      begin(i)
      touched = true
      cell = ''
      quoted = true
    } else if (ch === ',') {
      begin(i)
      touched = true
      cells.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      const end = i
      if (ch === '\r' && src[i + 1] === '\n') i++
      endRecord(end)
      line++
    } else {
      begin(i)
      if (ch.trim() !== '') touched = true
      cell += ch
    }
  }
  if (touched || cell !== '' || cells.length > 0) endRecord(src.length)
  return records
}

/** Data rows of a CSV text (every record after the header). */
export const countDataRows = (text: string): number => Math.max(0, parseCsvRecords(text).length - 1)

/** "Fail melebihi 500 baris." when the text has more than 500 data rows, else `null`. */
export const validateCsvRows = (text: string): string | null =>
  countDataRows(text) > CSV_LIMITS.rows ? CSV_MESSAGES.tooManyRows : null

const cell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

/** `ralat-import-{yyyymmdd}.csv` for a date (local time). */
export function errorFileName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `ralat-import-${String(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}.csv`
}

/**
 * The error file: columns Baris, Sebab, then the original columns. Each failed row keeps its uploaded text; a row
 * the text does not hold gets empty original cells.
 */
export function buildErrorCsv(text: string, errors: readonly ImportFailure[]): string {
  const records = parseCsvRecords(text)
  const header = records[0]
  const byLine = new Map(records.map((r) => [r.line, r]))
  const lines = [`Baris,Sebab,${header ? header.raw : ''}`.replace(/,$/, '')]
  for (const e of errors) {
    const rec = byLine.get(e.row)
    lines.push(`${String(e.row)},${cell(e.message)}${rec ? `,${rec.raw}` : ''}`)
  }
  return `﻿${lines.join('\r\n')}\r\n`
}
