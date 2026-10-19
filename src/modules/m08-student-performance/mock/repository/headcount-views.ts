/**
 * Presentation read models of the headcount endpoints (SRS M08 v1.12 §4 BR-M08-08/22/23/24/32/33,
 * §7 #12–#17, #24, #25, #29). Pure functions over the headcount repository and the owners' public
 * entries (M01 users, M02 schools, M03 curriculum, M10 classes). Every unobserved rule is INFERRED
 * where it is used.
 *
 * The roster of a config = the active members of its class plus the pupils that hold an entry (a
 * config of another level or school may hold pupils that are not members). Dropped pupils stay in the
 * #25 rows (flagged, so "Kembalikan" can restore them) but leave every count and average (INFERRED).
 */

import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  ConfidenceLabel,
  HeadcountDashboardConfig,
  HeadcountDetail,
  HeadcountGrade,
  HeadcountListItem,
  HeadcountRow,
  HeadcountSection,
  HeadcountSort,
  HeadcountStudent,
  HeadcountSummary,
  PairStatus,
  PredictionVerdict,
  ProjectionVariant,
  RowTone,
  TrendLabel,
} from '../../api/headcount-types'
import { headcountRepo, entryView } from './headcount'
import { bandStatus, latestAr, pairStatus, type HeadcountEntryView } from './headcount-port'
import type { HeadcountConfigRow, HeadcountEntryRow } from './headcount-types'
import { gradeOfPercent, round } from './rules'

const blank = (n: number): (number | null)[] => Array.from({ length: n }, () => null)

const subjectName = (id: number): string => curriculum.subject(id)?.name ?? `Subjek ${String(id)}`
export const levelNameOf = (id: number): string =>
  curriculum.level(id)?.name ?? `Tahap ${String(id)}`
export const classNameOf = (c: HeadcountConfigRow): string =>
  classrooms.get('classroom', c.classroomId)?.name ?? ''
const nameOf = (userId: number): string => users.get(userId)?.name ?? `Murid ${String(userId)}`
const gradeOrNull = (v: number | null): HeadcountGrade | null =>
  v === null ? null : gradeOfPercent(v)

/** The school a config belongs to: its class's school, else its teacher's (INFERRED, §9 school admin scope). */
export function configSchoolId(c: HeadcountConfigRow): number | null {
  return (
    classrooms.get('classroom', c.classroomId)?.schoolId ?? users.get(c.teacherId)?.schoolId ?? null
  )
}

/** One roster line: the pupil and the entry (a blank one for a member without an entry). */
export interface RosterLine {
  studentId: number
  entry: HeadcountEntryRow | undefined
  /** The marks as a port view (blank slots when there is no entry). */
  view: HeadcountEntryView
  dropped: boolean
}

export function rosterOf(c: HeadcountConfigRow): RosterLine[] {
  const entries = new Map(headcountRepo.entriesOf(c.id).map((e) => [e.studentId, e]))
  const ids = new Set<number>([
    ...classrooms.memberIds('classroom', c.classroomId),
    ...entries.keys(),
  ])
  return [...ids]
    .sort((a, b) => a - b)
    .map((studentId) => {
      const entry = entries.get(studentId)
      const row: HeadcountEntryRow = entry ?? {
        id: 0,
        configId: c.id,
        studentId,
        tov: null,
        targets: blank(c.activeOtrs),
        actuals: blank(c.activeOtrs),
        etr: null,
        rs: null,
        rsRecordedAt: null,
        dropped: false,
      }
      return { studentId, entry, view: entryView(c, row), dropped: row.dropped }
    })
}

const live = (lines: readonly RosterLine[]): RosterLine[] => lines.filter((l) => !l.dropped)

function mean(values: readonly (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null)
  return v.length === 0 ? null : round(v.reduce((a, b) => a + b, 0) / v.length, 1)
}

// ---------------------------------------------------------------------------------------------
// #12 list, #13 dashboard
// ---------------------------------------------------------------------------------------------

export function listItem(c: HeadcountConfigRow): HeadcountListItem {
  return {
    id: c.id,
    className: classNameOf(c),
    subjectName: subjectName(c.subjectId),
    levelName: levelNameOf(c.educationLevelId),
    year: c.academicYear,
    mode: c.mode,
    activeOtrs: c.activeOtrs,
    students: live(rosterOf(c)).length,
  }
}

export function dashboardItem(c: HeadcountConfigRow): HeadcountDashboardConfig {
  const lines = live(rosterOf(c))
  let on = 0
  let off = 0
  let none = 0
  for (const l of lines) {
    const s = pairStatus(l.view)
    if (s === 'on') on++
    else if (s === 'below') off++
    else none++
  }
  const otrs = Array.from({ length: c.activeOtrs }, (_, i) => i)
  return {
    id: c.id,
    level: c.educationLevelId,
    levelName: levelNameOf(c.educationLevelId),
    className: classNameOf(c),
    subjectName: subjectName(c.subjectId),
    year: c.academicYear,
    onTrack: on,
    offTrack: off,
    noData: none,
    totalStudents: lines.length,
    chart: {
      labels: otrs.map((i) => `OTR${String(i + 1)}`),
      target: otrs.map((i) => mean(lines.map((l) => l.view.targets[i] ?? null))),
      actual: otrs.map((i) => mean(lines.map((l) => l.view.actuals[i] ?? null))),
    },
  }
}

// ---------------------------------------------------------------------------------------------
// #24 summary, #25 detail
// ---------------------------------------------------------------------------------------------

export function summaryOf(c: HeadcountConfigRow): HeadcountSummary {
  const lines = live(rosterOf(c))
  const otrs = Array.from({ length: c.activeOtrs }, (_, i) => {
    const out = { n: i + 1, above: 0, onTrack: 0, below: 0, na: 0 }
    for (const l of lines) {
      const s = bandStatus(l.view.actuals[i] ?? null, l.view.targets[i] ?? null)
      if (s === 'above') out.above++
      else if (s === 'on') out.onTrack++
      else if (s === 'below') out.below++
      else out.na++
    }
    return out
  })
  return {
    config: {
      id: c.id,
      subject: subjectName(c.subjectId),
      className: classNameOf(c),
      levelName: levelNameOf(c.educationLevelId),
      year: c.academicYear,
      activeOtrs: c.activeOtrs,
    },
    students: lines.length,
    avgTov: mean(lines.map((l) => l.view.tov)),
    avgEtr: mean(lines.map((l) => l.view.etr)),
    otrs,
  }
}

export function detailOf(c: HeadcountConfigRow, sort: HeadcountSort): HeadcountDetail {
  const lines = rosterOf(c)
  const items = lines.map((l) => {
    const v = l.view
    const cells = Array.from({ length: c.activeOtrs }, (_, i) => {
      const ar = v.actuals[i] ?? null
      const target = v.targets[i] ?? null
      const band = bandStatus(ar, target)
      return {
        target,
        targetGrade: gradeOrNull(target),
        ar,
        arGrade: gradeOrNull(ar),
        tone: band,
      }
    })
    const row: HeadcountRow = {
      userId: l.studentId,
      name: nameOf(l.studentId),
      tov: v.tov,
      tovGrade: gradeOrNull(v.tov),
      cells,
      etr: v.etr,
      etrGrade: gradeOrNull(v.etr),
      dropped: l.dropped,
    }
    return { row, latest: latestAr(v)?.ar ?? null }
  })
  items.sort((a, b) => {
    if (sort === 'name') return a.row.name.localeCompare(b.row.name) || a.row.userId - b.row.userId
    // ranking: latest AR descending (no AR last), ties by name (FR-M08-138, INFERRED)
    if (a.latest === null && b.latest !== null) return 1
    if (a.latest !== null && b.latest === null) return -1
    return (
      (b.latest ?? 0) - (a.latest ?? 0) ||
      a.row.name.localeCompare(b.row.name) ||
      a.row.userId - b.row.userId
    )
  })
  const rows = items.map((i) => i.row)
  const shown = rows.filter((r) => !r.dropped)
  let onTrack = 0
  let below = 0
  let empty = 0
  for (const l of live(lines)) {
    const last = latestAr(l.view)
    const band = last === null ? 'na' : bandStatus(last.ar, last.target)
    if (band === 'above' || band === 'on') onTrack++
    else if (band === 'below') below++
    else empty++
  }
  return {
    config: {
      id: c.id,
      subject: subjectName(c.subjectId),
      className: classNameOf(c),
      levelName: levelNameOf(c.educationLevelId),
      year: c.academicYear,
      teacherName: nameOf(c.teacherId),
      status: 'active',
      activeOtrs: c.activeOtrs,
    },
    chips: { onTrack, below, empty, total: shown.length },
    rows,
    averages: {
      tov: mean(shown.map((r) => r.tov)),
      otrs: Array.from({ length: c.activeOtrs }, (_, i) =>
        mean(shown.map((r) => r.cells[i]?.target ?? null)),
      ),
      ars: Array.from({ length: c.activeOtrs }, (_, i) =>
        mean(shown.map((r) => r.cells[i]?.ar ?? null)),
      ),
      etr: mean(shown.map((r) => r.etr)),
    },
  }
}

// ---------------------------------------------------------------------------------------------
// #29 CSV
// ---------------------------------------------------------------------------------------------

const BOM = String.fromCharCode(0xfeff)

const csvCell = (v: string | number | null): string => {
  if (v === null) return ''
  const s = typeof v === 'number' ? String(round(v, 2)) : v
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * The CSV of S23 (UNVERIFIED columns "as S23", L-12): `Bil, Nama, TOV (%), Gred TOV, then per OTR
 * target / AR with their grades, ETR (%), Gred ETR`, one line per shown pupil in the chosen order and
 * the "Purata Kelas" line. UTF-8 with a BOM and CRLF line ends (opens in a spreadsheet).
 */
export function csvOf(c: HeadcountConfigRow, sort: HeadcountSort): string {
  const d = detailOf(c, sort)
  const head = ['Bil', 'Nama', 'TOV (%)', 'Gred TOV']
  for (let i = 1; i <= c.activeOtrs; i++) {
    head.push(
      `OTR${String(i)} (%)`,
      `Gred OTR${String(i)}`,
      `AR${String(i)} (%)`,
      `Gred AR${String(i)}`,
    )
  }
  head.push('ETR (%)', 'Gred ETR')
  const lines: (string | number | null)[][] = [head]
  d.rows
    .filter((r) => !r.dropped)
    .forEach((r, i) => {
      const line: (string | number | null)[] = [i + 1, r.name, r.tov, r.tovGrade]
      for (const cell of r.cells) line.push(cell.target, cell.targetGrade, cell.ar, cell.arGrade)
      line.push(r.etr, r.etrGrade)
      lines.push(line)
    })
  const avg: (string | number | null)[] = [
    '',
    'Purata Kelas',
    d.averages.tov,
    gradeOrNull(d.averages.tov),
  ]
  d.averages.otrs.forEach((t, i) => {
    const a = d.averages.ars[i] ?? null
    avg.push(t, gradeOrNull(t), a, gradeOrNull(a))
  })
  avg.push(d.averages.etr, gradeOrNull(d.averages.etr))
  lines.push(avg)
  return `${BOM}${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}\r\n`
}

// ---------------------------------------------------------------------------------------------
// #17 pupil sections (S15)
// ---------------------------------------------------------------------------------------------

/** BR-M08-24 (INFERRED): Unjuran = last AR + mean step, clamped 0–100; anchors keep their observed chips. */
function projectionOf(
  e: HeadcountEntryView,
  entry: HeadcountEntryRow,
): HeadcountSection['projection'] {
  const points = e.actuals.filter((v): v is number => v !== null)
  if (points.length === 0) return null
  const last = points[points.length - 1] as number
  const step = points.length < 2 ? 0 : (last - (points[0] as number)) / (points.length - 1)
  const value = Math.min(100, Math.max(0, round(last + step, 1)))
  const variant: ProjectionVariant = e.etr === null ? 'red' : value >= e.etr ? 'green' : 'amber'
  const delta = e.tov === null ? 0 : value - e.tov
  const trend: TrendLabel = delta > 3 ? 'Meningkat' : delta < -3 ? 'Menurun' : 'Stabil'
  const confidence: ConfidenceLabel =
    points.length >= 3 ? 'Tinggi' : points.length === 2 ? 'Sederhana' : 'Rendah'
  return {
    value,
    variant,
    trend: entry.trendOverride ?? trend,
    confidence: entry.confidenceOverride ?? confidence,
  }
}

/** BR-M08-33: d = RS − ETR (1 decimal); |d| ≤ 5 Tepat, ≤ 10 Hampir Tepat, else Selisih Besar. */
function predictionOf(e: HeadcountEntryView): HeadcountSection['prediction'] {
  if (e.etr === null || e.rs === null) return null
  const diff = round(e.rs - e.etr, 1)
  const abs = Math.abs(diff)
  const verdict: PredictionVerdict =
    abs <= 5 ? 'Ramalan Tepat' : abs <= 10 ? 'Hampir Tepat' : 'Selisih Besar'
  return { etr: e.etr, rs: e.rs, diff, verdict }
}

function sectionOf(
  c: HeadcountConfigRow,
  entry: HeadcountEntryRow,
  school: string | null,
): HeadcountSection {
  const e = entryView(c, entry)
  const rows = Array.from({ length: c.activeOtrs }, (_, i) => {
    const target = e.targets[i] ?? null
    const ar = e.actuals[i] ?? null
    const tone: RowTone =
      ar === null ? 'noAr' : target === null ? 'noTarget' : ar >= target ? 'on' : 'below'
    return {
      checkpoint: i + 1,
      target,
      targetGrade: gradeOrNull(target),
      ar,
      arGrade: gradeOrNull(ar),
      tone,
    }
  })
  const projection = projectionOf(e, entry)
  const last = latestAr(e)
  const labels = ['TOV', ...rows.map((r) => `OTR${String(r.checkpoint)}`), 'ETR']
  if (e.rs !== null) labels.push('RS')
  const pad = (values: (number | null)[]): (number | null)[] => {
    const out = [...values]
    while (out.length < labels.length) out.push(null)
    return out
  }
  const projSeries = labels.map((_, i) => {
    if (projection === null || last === null) return null
    if (i === last.n) return last.ar
    if (i === labels.indexOf('ETR')) return projection.value
    return null
  })
  const status: PairStatus = pairStatus(e)
  return {
    configId: c.id,
    subject: subjectName(c.subjectId),
    school,
    levelName: levelNameOf(c.educationLevelId),
    className: classNameOf(c),
    year: c.academicYear,
    status,
    tov: e.tov,
    etr: e.etr,
    rs: e.rs === null ? null : { value: e.rs, recordedAt: entry.rsRecordedAt },
    projection,
    rows,
    prediction: predictionOf(e),
    chart: {
      labels,
      target: pad([e.tov, ...rows.map((r) => r.target), e.etr]),
      actual: pad([e.tov, ...rows.map((r) => r.ar), null]),
      projection: projSeries,
      rs: e.rs,
    },
  }
}

/** S15 data of a pupil; `visible` filters the configs the viewer may see (config id ascending). */
export function studentOf(
  studentId: number,
  visible: (c: HeadcountConfigRow) => boolean,
): HeadcountStudent | undefined {
  const user = users.get(studentId)
  if (!user || user.role !== 'student') return undefined
  const school = user.schoolId === null ? null : (schools.get(user.schoolId)?.name ?? null)
  const sections: HeadcountSection[] = []
  for (const entry of headcountRepo.entriesOfStudent(studentId)) {
    if (entry.dropped) continue
    const c = headcountRepo.config(entry.configId)
    if (c && visible(c)) sections.push(sectionOf(c, entry, school))
  }
  sections.sort((a, b) => a.configId - b.configId)
  return { student: { id: user.id, name: user.name, school }, sections }
}
