/**
 * CSV of the S2 export (FR-M11-31, PROPOSED): quoted cells, formula-injection guard (a text cell that
 * starts with `=`, `+`, `-` or `@` — or a tab or carriage return — gets a leading `'`; the lone "-"
 * placeholder of a missing school code is left as is), and a UTF-8 BOM so spreadsheets read the
 * Malay text correctly.
 */

export const CSV_BOM = '﻿'

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: string | number | null): string {
  let text = String(value ?? '')
  if (typeof value === 'string' && text !== '-' && FORMULA_START.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function buildCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return CSV_BOM + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}
