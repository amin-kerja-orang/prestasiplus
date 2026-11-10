/**
 * Client helpers of the Import Pelajar page (R1-AS-51): the file checks that need no server, the rows of a file (to name
 * the failed rows of the result), the template and the error file. The server stays the authority on every rule.
 */

export const IMPORT_EXTENSIONS = ['csv', 'txt'] as const
export const IMPORT_MAX_MB = 2
export const IMPORT_MAX_ROWS = 1000
/** Preview title of the dry run (20 R1-AS-51 FR-AS-51-4; allow-list P-07 of 40 AC-X2-3: this folder only). */
export const importPreviewTitle = (rows: number): string => `Pratonton · semua ${rows} baris`
export const IMPORT_TEMPLATE_NAME = 'templat-pelajar.csv'
/** The header and one fictitious row of the template (PRD-20 R1-AS-51). */
export const IMPORT_TEMPLATE = 'nama,email,kelas\nMurid Contoh,murid.contoh@example.org,5 Bestari\n'

export interface ImportFileRow {
  /** 1-based line of the file (the header is line 1). */
  line: number
  name: string
  email: string
  kelas: string
}

/** ERR-REQ-04 for a file that is not `.csv` or `.txt`. */
export function importTypeError(file: File): string | null {
  const ext = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? ''
  return (IMPORT_EXTENSIONS as readonly string[]).includes(ext) ? null : 'Jenis fail tidak disokong. Format dibenarkan: CSV, TXT.'
}

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i)
    if (quoted) {
      if (ch === '"' && line.charAt(i + 1) === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    } else if (ch === delimiter) {
      out.push(cell.trim())
      cell = ''
    } else cell += ch
  }
  out.push(cell.trim())
  return out
}

/** The data rows of `nama,email,kelas` text (comma or semicolon from the header; blank lines skipped, line numbers kept). */
export function importRowsOf(text: string): ImportFileRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/)
  const first = lines.findIndex((l) => l.trim() !== '')
  if (first < 0) return []
  const head = lines[first] ?? ''
  const delimiter = head.split(';').length > head.split(',').length ? ';' : ','
  const columns = splitLine(head, delimiter).map((c) => c.toLowerCase())
  const at = (cells: string[], name: string): string => {
    const i = columns.indexOf(name)
    return i < 0 ? '' : (cells[i] ?? '')
  }
  const rows: ImportFileRow[] = []
  lines.forEach((raw, i) => {
    if (i <= first || raw.trim() === '') return
    const cells = splitLine(raw, delimiter)
    rows.push({ line: i + 1, name: at(cells, 'nama'), email: at(cells, 'email'), kelas: at(cells, 'kelas') })
  })
  return rows
}

const cell = (v: string | number): string => {
  const t = String(v)
  const safe = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** `ralat-import-pelajar-{yyyymmdd}.csv`: Baris, Sebab, nama, email, kelas (ERR-IMP-01). */
export function errorFileOf(errors: readonly { row: number; message: string }[], rows: readonly ImportFileRow[]): string {
  const byLine = new Map(rows.map((r) => [r.line, r]))
  const lines = errors.map((e) => {
    const r = byLine.get(e.row)
    return [e.row, e.message, r?.name ?? '', r?.email ?? '', r?.kelas ?? ''].map(cell).join(',')
  })
  return `﻿${['Baris,Sebab,nama,email,kelas', ...lines].join('\n')}\n`
}

export function errorFileName(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `ralat-import-pelajar-${String(now.getFullYear())}${p(now.getMonth() + 1)}${p(now.getDate())}.csv`
}
