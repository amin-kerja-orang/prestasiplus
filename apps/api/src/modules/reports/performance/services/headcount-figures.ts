import { MIN_COHORT } from '../domain/constants'
import { GRADES, compareIds, gradeOfPercent, pct, round, type Grade } from '../domain/rules'
import { GRADE_POINTS, bandStatus, isGraded, latestAr, pairStatus } from '../headcount/headcount.rules'
import type { HeadcountEntryView } from './headcount-facts.types'

/** Pure figures over headcount entries (Part D). Dropped entries never count. */

export const GPS_BAR_BASE = 9.5

export const liveEntries = (entries: readonly HeadcountEntryView[]): HeadcountEntryView[] => entries.filter((e) => !e.dropped)

export type GpsBandName = 'Cemerlang' | 'Baik' | 'Sederhana' | 'Perlu Perhatian'

/** BR-M08-03. */
export function gpsBand(gps: number): GpsBandName {
  if (gps <= 2) return 'Cemerlang'
  if (gps <= 4) return 'Baik'
  if (gps <= 6) return 'Sederhana'
  return 'Perlu Perhatian'
}

/** Grade of a GPS value: the nearest grade point. */
export function gradeOfPoints(points: number): Grade {
  return GRADES[Math.min(9, Math.max(0, Math.floor(points + 0.5)))] as Grade
}

/** BR-M08-04 Pencapaian bar. */
export const achievementOf = (gps: number): number => Math.round(((GPS_BAR_BASE - gps) / GPS_BAR_BASE) * 100)

/** BR-M08-01: the grade of an entry is the grade of its latest AR; null without an AR. */
export function entryGrade(e: HeadcountEntryView): Grade | null {
  const l = latestAr(e)
  return l === null ? null : gradeOfPercent(l.ar)
}

/** GPS = sum of grade points / graded entries, 2 decimals. */
export function gpsOf(entries: readonly HeadcountEntryView[]): { value: number | null; entries: number } {
  let points = 0
  let n = 0
  for (const e of entries) {
    const g = entryGrade(e)
    if (g === null) continue
    points += GRADE_POINTS[g]
    n++
  }
  return { value: n === 0 ? null : round(points / n, 2), entries: n }
}

export const gradedEntries = (entries: readonly HeadcountEntryView[]): HeadcountEntryView[] => entries.filter((e) => isGraded(e))

export const distinctStudents = (entries: readonly HeadcountEntryView[]): number => new Set(entries.map((e) => e.studentId)).size

/**
 * The school GPS card shared by Prestasi sekolah (S1) and Analisa Item sekolah (S9, DV-M08-31): GPS and band over the graded
 * entries (BR-M08-01, 03). Non-staff get an empty card below MIN_COHORT graded pupils.
 */
export function schoolGps(entries: readonly HeadcountEntryView[], staff: boolean): { value: number | null; band: GpsBandName | null; entries: number } {
  const graded = gradedEntries(entries)
  const g = gpsOf(graded)
  if ((!staff && distinctStudents(graded) < MIN_COHORT) || g.value === null) return { value: null, band: null, entries: 0 }
  return { value: g.value, band: gpsBand(g.value), entries: g.entries }
}

/** The yearly headcount GPS of the same entries (S9 sparkline), oldest year first. Non-staff: a year below MIN_COHORT graded pupils is left out. */
export function gpsByYear(entries: readonly HeadcountEntryView[], staff: boolean): { year: number; gps: number }[] {
  const by = new Map<number, HeadcountEntryView[]>()
  for (const e of gradedEntries(entries)) by.set(e.academicYear, [...(by.get(e.academicYear) ?? []), e])
  return [...by]
    .sort(([a], [b]) => a - b)
    .flatMap(([year, list]) => {
      const g = gpsOf(list)
      return g.value === null || (!staff && distinctStudents(list) < MIN_COHORT) ? [] : [{ year, gps: g.value }]
    })
}

/** Per pupil: on when at least one pair is on, else below when at least one is below (BR-M08-08 rule 3). */
export function studentStatuses(entries: readonly HeadcountEntryView[]): { on: number; below: number } {
  const by = new Map<string, { on: boolean; below: boolean }>()
  for (const e of entries) {
    const s = by.get(e.studentId) ?? { on: false, below: false }
    const st = pairStatus(e)
    if (st === 'on') s.on = true
    else if (st === 'below') s.below = true
    by.set(e.studentId, s)
  }
  let on = 0
  let below = 0
  for (const s of by.values()) {
    if (s.on) on++
    else if (s.below) below++
  }
  return { on, below }
}

/** BR-M08-07: every pair counts; one without a target or an AR is below. */
export function pairCounts(entries: readonly HeadcountEntryView[]): { on: number; below: number; onPct: number } {
  let on = 0
  let below = 0
  for (const e of entries) {
    if (pairStatus(e) === 'on') on++
    else below++
  }
  return { on, below, onPct: Math.round(pct(on, on + below)) }
}

/** S5 badge: above and on track both read "on". */
export function classBadge(e: HeadcountEntryView | undefined): 'on' | 'below' | 'na' {
  if (!e) return 'na'
  const l = latestAr(e)
  const s = l === null ? 'na' : bandStatus(l.ar, l.target)
  return s === 'above' || s === 'on' ? 'on' : s === 'below' ? 'below' : 'na'
}

/** The most recently updated config among the entries (updatedAt, then id, both descending). */
export function newestConfigId(entries: readonly HeadcountEntryView[]): string | null {
  let best: HeadcountEntryView | null = null
  for (const e of entries) {
    if (best === null || e.configUpdatedAt > best.configUpdatedAt || (e.configUpdatedAt.getTime() === best.configUpdatedAt.getTime() && compareIds(e.configId, best.configId) > 0)) best = e
  }
  return best === null ? null : best.configId
}
