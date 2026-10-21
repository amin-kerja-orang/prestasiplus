import { describe, expect, it } from 'vitest'

import { csvCell, csvOf } from '../../../../src/modules/reports/performance/headcount/headcount.csv'
import { detailOf, type ConfigInfo, type RosterLine } from '../../../../src/modules/reports/performance/headcount/headcount.views'

const info: ConfigInfo = {
  id: '7',
  className: '4 Amanah',
  subjectName: 'Matematik',
  levelId: '10',
  levelName: 'Tingkatan 4',
  year: 2026,
  mode: 'auto',
  activeOtrs: 2,
  teacherName: 'Guru Contoh',
}

const line = (studentId: string, name: string, over: Partial<RosterLine['marks']> = {}, dropped = false): RosterLine => ({
  studentId,
  name,
  marks: { tov: null, targets: [null, null], actuals: [null, null], etr: null, rs: null, ...over },
  rsRecordedAt: null,
  dropped,
})

describe('csv cell', () => {
  it.each([['=1+1'], ['+1'], ['-1'], ['@SUM(A1)'], ['\tx'], ['\rx']])('neutralises %j with a leading apostrophe', (value) => {
    expect(csvCell(value).replace(/^"/, '')).toMatch(/^'/)
  })

  it('leaves safe text alone, quotes commas, quotes and line breaks', () => {
    expect(csvCell('Aina')).toBe('Aina')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('a\nb')).toBe('"a\nb"')
  })

  it('numbers keep at most 2 decimals, null is empty', () => {
    expect(csvCell(72.456)).toBe('72.46')
    expect(csvCell(60)).toBe('60')
    expect(csvCell(null)).toBe('')
  })
})

describe('csv of the table', () => {
  const lines = [
    line('1', 'Aina', { tov: 50, targets: [60, 70], actuals: [65, 75], etr: 80 }),
    line('2', '=HYPERLINK("x")', { tov: 40, targets: [50, 60], actuals: [55, null], etr: 70 }),
    line('3', 'Gugur', { tov: 99 }, true),
  ]
  const csv = csvOf(detailOf(info, lines, 'ranking'))
  const rows = csv.slice(1).split('\r\n')

  it('starts with a BOM, ends with CRLF and has the header of S23', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(rows[0]).toBe('Bil,Nama,TOV (%),Gred TOV,OTR1 (%),Gred OTR1,AR1 (%),Gred AR1,OTR2 (%),Gred OTR2,AR2 (%),Gred AR2,ETR (%),Gred ETR')
  })

  it('lists the shown pupils only, in the chosen order, then the class average', () => {
    // header, 2 pupils, the average line and the empty tail after the final CRLF
    expect(rows).toHaveLength(1 + 2 + 1 + 1)
    expect(rows[1]).toBe('1,Aina,50,C,60,B,65,B+,70,A-,75,A-,80,A')
    expect(rows[3]).toMatch(/^,Purata Kelas,45,/)
    expect(csv).not.toContain('Gugur')
  })

  it('neutralises a formula in a name', () => {
    expect(rows[2]).toContain(`"'=HYPERLINK(""x"")"`)
  })
})
