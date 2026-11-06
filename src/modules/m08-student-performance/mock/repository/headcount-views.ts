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
} from '../../api/headcount-types'
import { projectionOfAr } from '../../lib/headcount/otr'
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
    teacherName: nameOf(c.teacherId),
    entryStatus:
      c.defaultEtr != null || live(rosterOf(c)).some((l) => l.view.etr !== null) ? 'active' : 'draft',
    statusReason: null,
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
    mode: c.mode,
    teacherName: nameOf(c.teacherId),
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

/** HC-4: the pupil status and, for "none", why (no ETR: Belum Ada Data; ETR without TOV: Belum Ada TOV). */
function statusOf(v: HeadcountEntryView): Pick<HeadcountRow, 'status' | 'statusReason' | 'entryStatus'> {
  const status = pairStatus(v)
  // FR-GUR-3-9: Active iff the pupil has an ETR (own or default), else Draft.
  const entryStatus = v.etr === null ? 'draft' : 'active'
  if (status !== 'none') return { status, statusReason: null, entryStatus }
  if (v.etr === null) return { status, statusReason: 'belum_ada_data', entryStatus }
  if (v.tov === null) return { status, statusReason: 'belum_ada_tov', entryStatus }
  return { status, statusReason: null, entryStatus }
}

/** HC-6 Unjuran of one pupil: the end value, its grade (whole-number rounding), trend and Keyakinan. */
function rowProjection(v: HeadcountEntryView): HeadcountRow['projection'] {
  const last = latestAr(v)
  const p = projectionOfAr({ tov: v.tov, etr: v.etr, ar: last?.ar ?? null })
  if (p === null) return null
  const variant: ProjectionVariant = v.etr === null ? 'red' : p.end >= v.etr ? 'green' : 'amber'
  return { value: p.end, variant, trend: p.trend, confidence: p.confidence }
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
      rs: v.rs,
      rsRecordedAt: l.entry?.rsRecordedAt ?? null,
      ...statusOf(v),
      projection: rowProjection(v),
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
    const s = pairStatus(l.view)
    if (s === 'on') onTrack++
    else if (s === 'below') below++
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
      mode: c.mode,
      defaultTov: c.defaultTov ?? null,
      defaultEtr: c.defaultEtr ?? null,
    },
    chips: {
      onTrack,
      below,
      empty,
      total: shown.length,
      onTrackPct: onTrack + below === 0 ? 0 : Math.round((onTrack / (onTrack + below)) * 100),
    },
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

/** HC-6 Unjuran of S15: end = ETR when AR >= TOV else AR; anchors keep their observed chips. */
function projectionOf(
  e: HeadcountEntryView,
  entry: HeadcountEntryRow,
): HeadcountSection['projection'] {
  const last = latestAr(e)
  const p = projectionOfAr({ tov: e.tov, etr: e.etr, ar: last?.ar ?? null })
  if (p === null) return null
  const variant: ProjectionVariant = e.etr === null ? 'red' : p.end >= e.etr ? 'green' : 'amber'
  return {
    value: p.end,
    variant,
    trend: entry.trendOverride ?? p.trend,
    confidence: entry.confidenceOverride ?? p.confidence,
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
    mode: c.mode,
    status,
    ...(({ statusReason, entryStatus }) => ({ statusReason, entryStatus }))(statusOf(e)),
    jurang: e.tov === null || e.etr === null ? null : round(e.etr - e.tov, 1),
    unjuran: projection?.value ?? null,
    keyakinan: projection?.confidence ?? null,
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

// ---------------------------------------------------------------------------------------------
// API-RPT-08 the pupil's own views (S10-T09)
// ---------------------------------------------------------------------------------------------

/** The pupil's own live roster line of a config (class member or entry holder, not dropped), else undefined. */
function ownLineOf(c: HeadcountConfigRow, studentId: number): RosterLine | undefined {
  const line = rosterOf(c).find((l) => l.studentId === studentId)
  return line && !line.dropped ? line : undefined
}

/** The configs the pupil sees: own class configs where the pupil is not dropped, newest first. */
export function ownConfigsOf(studentId: number): HeadcountConfigRow[] {
  return headcountRepo
    .configs()
    .filter((c) => ownLineOf(c, studentId) !== undefined)
    // like the API (FR-MUR-3-2): only the current year; the seeds are dated, so the latest seeded year stands in
    .filter((c, _i, all) => c.academicYear === Math.max(...all.map((x) => x.academicYear)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id)
}

/**
 * The pupil's own entry views for Prestasi 360 (FR-MUR-4-6, S10-T01 part 2): exactly the configs of `GET /headcounts/me`
 * (own classes, current year, not dropped), each with the pupil's own line (class defaults when there is no entry row).
 */
export function ownEntryViewsOf(studentId: number): HeadcountEntryView[] {
  return ownConfigsOf(studentId).map((c) => (ownLineOf(c, studentId) as RosterLine).view)
}

/** One card of `GET /headcounts/me`: the pupil's own pill (Active iff an ETR, own or default) and reason. */
export function ownListItem(c: HeadcountConfigRow, studentId: number): HeadcountListItem {
  const line = ownLineOf(c, studentId) as RosterLine
  const { entryStatus, statusReason } = statusOf(line.view)
  return { ...listItem(c), entryStatus, statusReason }
}

/** `GET /headcounts/me/detail`: the pupil's own line of one config only (no classmate data). */
export function ownStudentOf(
  studentId: number,
  c: HeadcountConfigRow | undefined,
): HeadcountStudent | undefined {
  const user = users.get(studentId)
  if (!user) return undefined
  const school = user.schoolId === null ? null : (schools.get(user.schoolId)?.name ?? null)
  const student = { id: user.id, name: user.name, school }
  if (!c) return { student, sections: [] }
  const line = ownLineOf(c, studentId)
  if (!line) return undefined
  const entry: HeadcountEntryRow = line.entry ?? {
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
  return { student, sections: [sectionOf(c, entry, school)] }
}
