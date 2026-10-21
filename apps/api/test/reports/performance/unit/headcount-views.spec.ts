import { describe, expect, it } from 'vitest'

import {
  dashboardItem,
  detailOf,
  listItem,
  sectionOf,
  sortOf,
  summaryOf,
  type ConfigInfo,
  type RosterLine,
} from '../../../../src/modules/reports/performance/headcount/headcount.views'

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

const lines: RosterLine[] = [
  line('1', 'Aina', { tov: 50, targets: [60, 70], actuals: [65, 75], etr: 80 }),
  line('2', 'Budi', { targets: [60, 70], actuals: [50, null] }),
  line('3', 'Cahaya', { tov: 99, targets: [60, 60], actuals: [90, 90], etr: 99 }, true),
  line('4', 'Dewi'),
]

describe('list and dashboard', () => {
  it('counts live pupils only', () => {
    expect(listItem(info, lines)).toEqual({
      id: '7',
      className: '4 Amanah',
      subjectName: 'Matematik',
      levelName: 'Tingkatan 4',
      year: 2026,
      mode: 'auto',
      activeOtrs: 2,
      students: 3,
    })
  })

  it('buckets on track, off track and no data over the live pupils, and means the chart per OTR', () => {
    const d = dashboardItem(info, lines)
    expect(d).toMatchObject({ id: '7', level: '10', onTrack: 1, offTrack: 1, noData: 1, totalStudents: 3 })
    expect(d.chart).toEqual({ labels: ['OTR1', 'OTR2'], target: [60, 70], actual: [57.5, 75] })
  })

  it('an empty roster has null chart points', () => {
    expect(dashboardItem(info, []).chart).toEqual({ labels: ['OTR1', 'OTR2'], target: [null, null], actual: [null, null] })
  })
})

describe('summary', () => {
  it('band counts per OTR, means and live total; a dropped pupil is out', () => {
    const s = summaryOf(info, lines)
    expect(s.students).toBe(3)
    expect(s.avgTov).toBe(50)
    expect(s.avgEtr).toBe(80)
    expect(s.otrs).toEqual([
      { n: 1, above: 1, onTrack: 0, below: 1, na: 1 },
      { n: 2, above: 1, onTrack: 0, below: 0, na: 2 },
    ])
  })
})

describe('detail', () => {
  it('ranking sort: latest AR descending, no AR last; dropped pupils stay, flagged', () => {
    const d = detailOf(info, lines, 'ranking')
    expect(d.rows.map((r) => r.userId)).toEqual(['3', '1', '2', '4'])
    expect(d.rows[0]?.dropped).toBe(true)
    expect(d.config.teacherName).toBe('Guru Contoh')
  })

  it('name sort', () => {
    expect(detailOf(info, lines, 'name').rows.map((r) => r.name)).toEqual(['Aina', 'Budi', 'Cahaya', 'Dewi'])
  })

  it('chips and averages leave the dropped pupil out; total = shown rows', () => {
    const d = detailOf(info, lines, 'ranking')
    expect(d.chips).toEqual({ onTrack: 1, below: 1, empty: 1, total: 3 })
    expect(d.averages).toEqual({ tov: 50, otrs: [60, 70], ars: [57.5, 75], etr: 80 })
    expect(d.rows.filter((r) => !r.dropped)).toHaveLength(d.chips.total)
  })

  it('cells carry the band tone and grades', () => {
    const a = detailOf(info, lines, 'name').rows[0]
    expect(a?.cells[0]).toEqual({ target: 60, targetGrade: 'B', ar: 65, arGrade: 'B+', tone: 'above' })
  })

  it('unknown sort means ranking', () => {
    expect(sortOf('name')).toBe('name')
    expect(sortOf('x')).toBe('ranking')
    expect(sortOf(undefined)).toBe('ranking')
  })
})

describe('pupil section (S15)', () => {
  it('rows, status, projection series and prediction', () => {
    const l = line('1', 'Aina', { tov: 50, targets: [60, 70], actuals: [65, 75], etr: 80, rs: 78 })
    const s = sectionOf(info, { ...l, rsRecordedAt: new Date('2026-10-01T02:00:00Z') }, 'SMK Contoh')
    expect(s.status).toBe('on')
    expect(s.rows.map((r) => r.tone)).toEqual(['on', 'on'])
    expect(s.rs).toEqual({ value: 78, recordedAt: '2026-10-01T10:00:00.000+08:00' })
    expect(s.prediction).toEqual({ etr: 80, rs: 78, diff: -2, verdict: 'Ramalan Tepat' })
    expect(s.chart.labels).toEqual(['TOV', 'OTR1', 'OTR2', 'ETR', 'RS'])
    expect(s.chart.target).toEqual([50, 60, 70, 80, null])
    expect(s.chart.actual).toEqual([50, 65, 75, null, null])
    expect(s.chart.projection).toEqual([null, null, 75, 85, null])
    expect(s.projection).toMatchObject({ value: 85, variant: 'green' })
  })

  it('a pupil with no marks has no projection or prediction and status none', () => {
    const s = sectionOf(info, line('4', 'Dewi'), null)
    expect(s.status).toBe('none')
    expect(s.projection).toBeNull()
    expect(s.prediction).toBeNull()
    expect(s.rows.every((r) => r.tone === 'noAr')).toBe(true)
  })
})
