/**
 * The "Untuk Kegunaan Pemeriksa" grid of the cover (V2: columns Bhg, Soalan, Penuh, Diperoleh and a
 * Jumlah row; BIJAK-SPM-cloud.md section 1, cloud-student-mechanism 3.x). Soalan is the range of question
 * numbers of a Bahagian: the paper numbers its questions 1..n across the Bahagian in order, so the range is
 * derived from the cumulative `questionCount` (a choose-N Bahagian counts every question it offers).
 */
export interface GridSection {
  label: string
  marks: number
  questionCount: number
}

export interface GridRow {
  key: string
  bhg: string
  soalan: string
  penuh: number
  diperoleh: string
}

export const GRID_HEADERS = { bhg: 'Bhg', soalan: 'Soalan', penuh: 'Penuh', diperoleh: 'Diperoleh' } as const

const rangeOf = (from: number, count: number): string =>
  count <= 0 ? '' : count === 1 ? String(from) : `${String(from)}–${String(from + count - 1)}`

export function examinerGridRows(cover: { marks: number; sections: readonly GridSection[] }): GridRow[] {
  let next = 1
  const rows: GridRow[] = cover.sections.map((s) => {
    const row = { key: s.label, bhg: s.label, soalan: rangeOf(next, s.questionCount), penuh: s.marks, diperoleh: '' }
    next += s.questionCount
    return row
  })
  rows.push({
    key: 'jumlah',
    bhg: 'Jumlah',
    soalan: rangeOf(1, next - 1),
    penuh: cover.marks,
    diperoleh: '',
  })
  return rows
}
