/**
 * Presentation read models of the headcount routes (SRS M08 §7 #12-#17, #24, #25), ported from the mock
 * `headcount-views.ts`. Pure functions over already loaded configs, rosters and names. Dropped pupils stay in
 * the detail rows (flagged) but leave every count and average.
 */
import type {
  PerformanceHeadcountDashboardSchema,
  PerformanceHeadcountDetailSchema,
  PerformanceHeadcountListItemSchema,
  PerformanceHeadcountStudentSchema,
  PerformanceHeadcountSummarySchema,
} from '@pp/contract'
import type { z } from 'zod'

import { toMytTimestamp } from '../../../../common/time/myt'
import type { HeadcountMode } from '../domain/headcount'
import { compareIds } from '../domain/rules'
import {
  bandStatus,
  gradeOrNull,
  latestAr,
  meanOrNull,
  pairStatus,
  predictionOf,
  projectionOf,
  rowTone,
  type HeadcountMarks,
} from './headcount.rules'

export type HeadcountListItem = z.infer<typeof PerformanceHeadcountListItemSchema>
export type HeadcountDashboardConfig = z.infer<typeof PerformanceHeadcountDashboardSchema>['configs'][number]
export type HeadcountSummary = z.infer<typeof PerformanceHeadcountSummarySchema>
export type HeadcountDetail = z.infer<typeof PerformanceHeadcountDetailSchema>
export type HeadcountStudent = z.infer<typeof PerformanceHeadcountStudentSchema>
export type HeadcountSection = HeadcountStudent['sections'][number]
export type HeadcountSort = 'ranking' | 'name'

/** A config with the display names resolved. */
export interface ConfigInfo {
  id: string
  className: string
  subjectName: string
  levelId: string
  levelName: string
  year: number
  mode: HeadcountMode
  activeOtrs: number
  teacherName: string
}

/** One roster line: the pupil, the name and the marks (blank slots when there is no entry). */
export interface RosterLine {
  studentId: string
  name: string
  marks: HeadcountMarks
  rsRecordedAt: Date | null
  dropped: boolean
}

export const sortOf = (raw: string | undefined): HeadcountSort => (raw === 'name' ? 'name' : 'ranking')

const collator = new Intl.Collator('ms')
const byName = (a: string, b: string): number => collator.compare(a, b)

export const live = (lines: readonly RosterLine[]): RosterLine[] => lines.filter((l) => !l.dropped)

export function listItem(c: ConfigInfo, lines: readonly RosterLine[]): HeadcountListItem {
  return {
    id: c.id,
    className: c.className,
    subjectName: c.subjectName,
    levelName: c.levelName,
    year: c.year,
    mode: c.mode,
    activeOtrs: c.activeOtrs,
    students: live(lines).length,
  }
}

export function dashboardItem(c: ConfigInfo, all: readonly RosterLine[]): HeadcountDashboardConfig {
  const lines = live(all)
  let on = 0
  let off = 0
  let none = 0
  for (const l of lines) {
    const s = pairStatus(l.marks)
    if (s === 'on') on++
    else if (s === 'below') off++
    else none++
  }
  const otrs = Array.from({ length: c.activeOtrs }, (_, i) => i)
  return {
    id: c.id,
    level: c.levelId,
    levelName: c.levelName,
    className: c.className,
    subjectName: c.subjectName,
    year: c.year,
    onTrack: on,
    offTrack: off,
    noData: none,
    totalStudents: lines.length,
    chart: {
      labels: otrs.map((i) => `OTR${String(i + 1)}`),
      target: otrs.map((i) => meanOrNull(lines.map((l) => l.marks.targets[i] ?? null))),
      actual: otrs.map((i) => meanOrNull(lines.map((l) => l.marks.actuals[i] ?? null))),
    },
  }
}

export function summaryOf(c: ConfigInfo, all: readonly RosterLine[]): HeadcountSummary {
  const lines = live(all)
  const otrs = Array.from({ length: c.activeOtrs }, (_, i) => {
    const out = { n: i + 1, above: 0, onTrack: 0, below: 0, na: 0 }
    for (const l of lines) {
      const s = bandStatus(l.marks.actuals[i] ?? null, l.marks.targets[i] ?? null)
      if (s === 'above') out.above++
      else if (s === 'on') out.onTrack++
      else if (s === 'below') out.below++
      else out.na++
    }
    return out
  })
  return {
    config: { id: c.id, subject: c.subjectName, className: c.className, levelName: c.levelName, year: c.year, activeOtrs: c.activeOtrs },
    students: lines.length,
    avgTov: meanOrNull(lines.map((l) => l.marks.tov)),
    avgEtr: meanOrNull(lines.map((l) => l.marks.etr)),
    otrs,
  }
}

export function detailOf(c: ConfigInfo, lines: readonly RosterLine[], sort: HeadcountSort): HeadcountDetail {
  const items = lines.map((l) => {
    const m = l.marks
    const cells = Array.from({ length: c.activeOtrs }, (_, i) => {
      const ar = m.actuals[i] ?? null
      const target = m.targets[i] ?? null
      return { target, targetGrade: gradeOrNull(target), ar, arGrade: gradeOrNull(ar), tone: bandStatus(ar, target) }
    })
    const row: HeadcountDetail['rows'][number] = {
      userId: l.studentId,
      name: l.name,
      tov: m.tov,
      tovGrade: gradeOrNull(m.tov),
      cells,
      etr: m.etr,
      etrGrade: gradeOrNull(m.etr),
      dropped: l.dropped,
    }
    return { row, latest: latestAr(m)?.ar ?? null }
  })
  items.sort((a, b) => {
    if (sort === 'name') return byName(a.row.name, b.row.name) || compareIds(a.row.userId, b.row.userId)
    // ranking: latest AR descending, no AR last, ties by name then id
    if (a.latest === null && b.latest !== null) return 1
    if (a.latest !== null && b.latest === null) return -1
    return (b.latest ?? 0) - (a.latest ?? 0) || byName(a.row.name, b.row.name) || compareIds(a.row.userId, b.row.userId)
  })
  const rows = items.map((i) => i.row)
  const shown = rows.filter((r) => !r.dropped)
  let onTrack = 0
  let below = 0
  let empty = 0
  for (const l of live(lines)) {
    const last = latestAr(l.marks)
    const band = last === null ? 'na' : bandStatus(last.ar, last.target)
    if (band === 'above' || band === 'on') onTrack++
    else if (band === 'below') below++
    else empty++
  }
  return {
    config: {
      id: c.id,
      subject: c.subjectName,
      className: c.className,
      levelName: c.levelName,
      year: c.year,
      teacherName: c.teacherName,
      status: 'active',
      activeOtrs: c.activeOtrs,
    },
    chips: { onTrack, below, empty, total: shown.length },
    rows,
    averages: {
      tov: meanOrNull(shown.map((r) => r.tov)),
      otrs: Array.from({ length: c.activeOtrs }, (_, i) => meanOrNull(shown.map((r) => r.cells[i]?.target ?? null))),
      ars: Array.from({ length: c.activeOtrs }, (_, i) => meanOrNull(shown.map((r) => r.cells[i]?.ar ?? null))),
      etr: meanOrNull(shown.map((r) => r.etr)),
    },
  }
}

/** One section of the pupil page (S15): a non-dropped entry of a visible config. */
export function sectionOf(c: ConfigInfo, line: RosterLine, school: string | null): HeadcountSection {
  const m = line.marks
  const rows = Array.from({ length: c.activeOtrs }, (_, i) => {
    const target = m.targets[i] ?? null
    const ar = m.actuals[i] ?? null
    return { checkpoint: i + 1, target, targetGrade: gradeOrNull(target), ar, arGrade: gradeOrNull(ar), tone: rowTone(ar, target) }
  })
  const projection = projectionOf(m)
  const last = latestAr(m)
  const labels = ['TOV', ...rows.map((r) => `OTR${String(r.checkpoint)}`), 'ETR']
  if (m.rs !== null) labels.push('RS')
  const pad = (values: (number | null)[]): (number | null)[] => {
    const out = [...values]
    while (out.length < labels.length) out.push(null)
    return out
  }
  const etrIndex = labels.indexOf('ETR')
  const projSeries = labels.map((_, i) => {
    if (projection === null || last === null) return null
    if (i === last.n) return last.ar
    if (i === etrIndex) return projection.value
    return null
  })
  return {
    configId: c.id,
    subject: c.subjectName,
    school,
    levelName: c.levelName,
    className: c.className,
    year: c.year,
    status: pairStatus(m),
    tov: m.tov,
    etr: m.etr,
    rs: m.rs === null ? null : { value: m.rs, recordedAt: line.rsRecordedAt === null ? null : toMytTimestamp(line.rsRecordedAt) },
    projection,
    rows,
    prediction: predictionOf(m),
    chart: {
      labels,
      target: pad([m.tov, ...rows.map((r) => r.target), m.etr]),
      actual: pad([m.tov, ...rows.map((r) => r.ar), null]),
      projection: projSeries,
      rs: m.rs,
    },
  }
}
