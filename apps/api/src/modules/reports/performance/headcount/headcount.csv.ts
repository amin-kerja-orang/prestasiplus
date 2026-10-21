/**
 * The CSV of S23 (the export route). UTF-8 with a BOM and CRLF line ends. Text cells that a spreadsheet would read as a
 * formula (a leading `=`, `+`, `-`, `@`, TAB or CR) get a leading `'` (CSV injection, OWASP). Pupil names are free text.
 */
import { round } from '../domain/rules'
import { gradeOrNull } from './headcount.rules'
import type { HeadcountDetail } from './headcount.views'

const BOM = String.fromCharCode(0xfeff)
const FORMULA_START = /^[=+\-@\t\r]/

export type CsvValue = string | number | null

/** One CSV field: numbers with at most 2 decimals, text neutralised against formula injection and quoted when needed. */
export function csvCell(v: CsvValue): string {
  if (v === null) return ''
  let s = typeof v === 'number' ? String(round(v, 2)) : v
  if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** `Bil, Nama, TOV (%), Gred TOV, then per OTR target / AR with their grades, ETR (%), Gred ETR`; shown pupils, then "Purata Kelas". */
export function csvOf(d: HeadcountDetail): string {
  const head: string[] = ['Bil', 'Nama', 'TOV (%)', 'Gred TOV']
  for (let i = 1; i <= d.config.activeOtrs; i++) {
    head.push(`OTR${String(i)} (%)`, `Gred OTR${String(i)}`, `AR${String(i)} (%)`, `Gred AR${String(i)}`)
  }
  head.push('ETR (%)', 'Gred ETR')
  const lines: CsvValue[][] = [head]
  d.rows
    .filter((r) => !r.dropped)
    .forEach((r, i) => {
      const line: CsvValue[] = [i + 1, r.name, r.tov, r.tovGrade]
      for (const cell of r.cells) line.push(cell.target, cell.targetGrade, cell.ar, cell.arGrade)
      line.push(r.etr, r.etrGrade)
      lines.push(line)
    })
  const avg: CsvValue[] = ['', 'Purata Kelas', d.averages.tov, gradeOrNull(d.averages.tov)]
  d.averages.otrs.forEach((t, i) => {
    const a = d.averages.ars[i] ?? null
    avg.push(t, gradeOrNull(t), a, gradeOrNull(a))
  })
  avg.push(d.averages.etr, gradeOrNull(d.averages.etr))
  lines.push(avg)
  return `${BOM}${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}\r\n`
}
