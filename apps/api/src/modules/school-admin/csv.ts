/** CSV writer for the school admin exports (RFC 4180, Excel-safe BOM, formula-injection hardening). */

const BOM = '﻿'
const FORMULA_PREFIX = /^[=+\-@\t\r]/

export type CsvCell = string | number | boolean | null | undefined

/** Neutralises a cell that a spreadsheet would run as a formula (leading `= + - @ TAB CR`) by prefixing a single quote. */
export function neutraliseCsvCell(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

/** One cell: neutralised, then quoted when it holds a comma, quote, CR or LF (quotes doubled). null/undefined are empty. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? neutraliseCsvCell(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** BOM + header + rows, every line (the last too) ended with the chosen line ending. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[], eol: 'LF' | 'CRLF' = 'LF'): string {
  const nl = eol === 'CRLF' ? '\r\n' : '\n'
  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(',')).join(nl) + nl
}
