/**
 * The Amaran read models behind SRS M18 §7 #21, #22, #24 and #30 (and, through them, M27 S4). The
 * endpoint handlers are thin wrappers over these functions, so M27 S0 (`risk.forSchool`) and the S22
 * page (`amaran.schoolRisk`) read the same numbers.
 *
 * Labels and shapes: SRS §6.7 (`PupilRisk`, `RiskTally`, `EffectivenessReport`), BR-M18-14/16/17/22,
 * URS FN-M18-4.1.3 (cell texts), FN-M18-4.4.5 (class label), FN-M18-4.8.x (effectiveness cards).
 */

import { startOfDay } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'
import { streak } from '@/modules/m14-gamification/mock'

import { amaranInterventionsRepo, correctionSubjectsRepo } from './stores'
import { risk, schoolIdsOfScope } from './risk'
import type {
  AmaranInterventionRow,
  Effectiveness,
  InterventionType,
  PupilRiskRow,
  PupilRiskView,
  RiskOptions,
  RiskScope,
  RiskStatus,
  RiskTally,
  RiskTallyView,
  SubjectRiskRow,
  Tingkatan,
} from './types'

export const STATUS_LABEL: Readonly<Record<RiskStatus, string>> = {
  on_track: 'On Track',
  watch: 'Perlu Perhatian',
  high: 'Berisiko Tinggi',
}

export const TYPE_LABEL: Readonly<Record<InterventionType, string>> = {
  kaunseling: 'Sesi Kaunseling',
  kelas_tambahan: 'Kelas Tambahan',
  tugasan_khas: 'Tugasan Khas',
  hubungi_ibubapa: 'Hubungi Ibu Bapa',
  mentor_rakan: 'Mentor Rakan Sebaya',
  bimbingan: 'Bimbingan',
  lain: 'Lain-lain',
}

const TYPE_ORDER = Object.keys(TYPE_LABEL) as InterventionType[]

const round1 = (n: number): number => Math.round(n * 10) / 10
const pctInt = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100)

/** `T4` / `T5` / `4` / `5` -> 4 / 5; anything else -> undefined (no filter). */
export function parseTingkatan(value: string | undefined): Tingkatan | undefined {
  const v = value?.trim().toUpperCase().replace(/^T/, '')
  return v === '4' ? 4 : v === '5' ? 5 : undefined
}

/** The tally in the §6.7 `RiskTally` shape (Hijau / Kuning / Merah and integer percentages). */
export function tallyView(t: RiskTally): RiskTallyView {
  return {
    green: t.onTrack,
    yellow: t.watch,
    red: t.high,
    total: t.total,
    pct: {
      green: pctInt(t.onTrack, t.total),
      yellow: pctInt(t.watch, t.total),
      red: pctInt(t.high, t.total),
    },
  }
}

function levelLabelOf(grade: number | null): string | null {
  if (grade === null) return null
  if (grade >= 7) return `Tingkatan ${String(grade - 6)}`
  if (grade >= 1) return `Darjah ${String(grade)}`
  return null
}

function classLabelOf(row: PupilRiskRow): string {
  const c = row.classes[0]
  if (!c) return '-'
  const m = /^(tingkatan|tahun)-(\d)$/.exec(c.level)
  const level = m ? `${m[1] === 'tingkatan' ? 'Tingkatan' : 'Darjah'} ${m[2] as string} ` : ''
  return `${level}${c.name}`
}

/** One pupil row of the S22 / S28 list (FN-M18-4.1.3 cell texts). */
export function pupilView(row: PupilRiskRow, rank: number): PupilRiskView {
  const accuracy = row.accuracy === null ? null : round1(row.accuracy)
  const engagement = row.lastActiveAt === null ? null : row.lastActiveAt.slice(0, 10)
  const mastery = row.masteryMean === null ? null : round1(row.masteryMean)
  return {
    rank,
    userId: row.userId,
    studentId: row.userId,
    name: row.name,
    levelLabel: levelLabelOf(row.grade),
    tingkatan: row.grade !== null && row.grade >= 7 ? row.grade - 6 : null,
    className: row.classes[0]?.name ?? null,
    classLabel: classLabelOf(row),
    score: row.score,
    status: row.status,
    accuracy,
    engagement,
    mastery,
    accuracyText:
      accuracy !== null
        ? `Purata ketepatan: ${String(accuracy)}%`
        : row.neverActive
          ? 'Tiada data latihan'
          : 'Tiada data',
    engagementText: engagement !== null ? `Terakhir aktif: ${engagement}` : 'Tiada aktiviti',
    masteryText:
      row.masteryMean !== null
        ? `Purata tahap: L${String(Math.round(row.masteryMean))}`
        : row.neverActive
          ? 'Tiada data penguasaan'
          : 'Tiada data',
  }
}

/** BR-M18-16 for a school: one row per stored CorrectionSubject row; empty without data. */
export function subjectRisk(schoolId: number): SubjectRiskRow[] {
  const out: SubjectRiskRow[] = []
  for (const r of correctionSubjectsRepo.forSchool(schoolId)) {
    if (r.pupils <= 0) continue
    out.push({
      subjectId: r.subjectId,
      subjectName: curriculum.subject(r.subjectId)?.name ?? `Subjek ${String(r.subjectId)}`,
      weak: r.pupilsWeak,
      total: r.pupils,
      pct: pctInt(r.pupilsWeak, r.pupils),
    })
  }
  return out
}

/** BR-M18-22: the pupils of a school, score descending, with 1-based rank. */
export function atRiskList(schoolId: number, options?: RiskOptions): PupilRiskView[] {
  return risk.pupilsForSchool(schoolId, options).map((r, i) => pupilView(r, i + 1))
}

export interface SchoolRiskData {
  school: { id: number; name: string; code: string; district: string | null; state: string }
  levelFilter: 'T4' | 'T5' | null
  levelSuffix: string
  tally: RiskTallyView
  weakness: SubjectRiskRow[]
  pupils: PupilRiskView[]
}

/** #21: the S22 / S28 school page. `null` for an unknown school. */
export function schoolRisk(schoolId: number, options?: RiskOptions): SchoolRiskData | null {
  const school = schools.get(schoolId)
  if (!school) return null
  const t = options?.tingkatan
  return {
    school: {
      id: school.id,
      name: school.name,
      code: school.code,
      district: school.district,
      state: school.state,
    },
    levelFilter: t === undefined ? null : t === 4 ? 'T4' : 'T5',
    levelSuffix: t === undefined ? '' : ` — Tingkatan ${String(t)}`,
    tally: tallyView(risk.forSchool(schoolId, options)),
    weakness: subjectRisk(schoolId),
    pupils: atRiskList(schoolId, options),
  }
}

// ---------------------------------------------------------------------------------------------
// #22 executive summary
// ---------------------------------------------------------------------------------------------

export interface KomboSummary {
  active: number
  pupils: number
  avg: number
  max: number
  today: number
}

/** Q-M18-KOMBO over the pupils of the scope's schools (BR-M18-09; the DATA-M18-06 display means are not applied). */
function komboOf(schoolIds: readonly number[], now: number): KomboSummary {
  let pupils = 0
  let active = 0
  let sum = 0
  let max = 0
  let today = 0
  const from = startOfDay(now)
  for (const id of schoolIds) {
    const ids = risk.pupilsForSchool(id, { now }).map((r) => r.userId)
    pupils += ids.length
    for (const s of streak.forUsers(ids)) {
      if (s.current > 0) {
        active++
        sum += s.current
        if (s.current > max) max = s.current
      }
    }
    today += practice.distinctUsers({ by: 'answers', from, to: from + 86_400_000, schoolId: id })
  }
  return { active, pupils, avg: active === 0 ? 0 : round1(sum / active), max, today }
}

export interface SchoolRow {
  schoolId: number
  school: string
  pupils: number
  avgScore: number
  green: number
  yellow: number
  red: number
}

/** BR-M18-22: average score descending, ties by school id; every school once. */
function schoolRows(schoolIds: readonly number[], now: number): SchoolRow[] {
  const rows: SchoolRow[] = []
  for (const id of schoolIds) {
    const p = risk.pupilsForSchool(id, { now })
    if (p.length === 0) continue
    const t = risk.forSchool(id, { now })
    rows.push({
      schoolId: id,
      school: schools.get(id)?.name ?? `Sekolah ${String(id)}`,
      pupils: p.length,
      avgScore: round1(p.reduce((a, r) => a + r.score, 0) / p.length),
      green: t.onTrack,
      yellow: t.watch,
      red: t.high,
    })
  }
  return rows.sort((a, b) => b.avgScore - a.avgScore || a.schoolId - b.schoolId)
}

export interface SummaryData {
  scope: 'school' | 'district' | 'state'
  title: string
  subtitle: string
  pupilsLine: string | null
  generatedAt: number
  tally: RiskTallyView
  kombo: KomboSummary
  schools?: SchoolRow[]
  weakness?: SubjectRiskRow[]
}

/** #22: the printable executive summary of a school, district or state (SRS FN-M18-4.7.x). */
export function summary(scope: RiskScope, now: number): SummaryData | null {
  const opts = { now }
  const ids = schoolIdsOfScope(scope)
  const tally = tallyView(risk.forScope(scope, opts))
  const kombo = komboOf(ids, now)
  if (scope.kind === 'school') {
    const s = schools.get(scope.schoolId)
    if (!s) return null
    return {
      scope: 'school',
      title: s.name,
      subtitle: `${s.district ?? ''}${s.district ? ', ' : ''}${s.state}`,
      pupilsLine: `${String(tally.total)} pelajar`,
      generatedAt: now,
      tally,
      kombo,
      weakness: subjectRisk(scope.schoolId),
    }
  }
  const rows = schoolRows(ids, now)
  if (scope.kind === 'district') {
    return {
      scope: 'district',
      title: scope.district,
      subtitle: `${scope.state} — Ringkasan Eksekutif`,
      pupilsLine: `${String(tally.total)} pelajar`,
      generatedAt: now,
      tally,
      kombo,
      schools: rows,
    }
  }
  return {
    scope: 'state',
    title: `Negeri ${scope.state}`,
    subtitle: 'Ringkasan Eksekutif Seluruh Negeri',
    pupilsLine: null,
    generatedAt: now,
    tally,
    kombo,
    schools: rows,
  }
}

// ---------------------------------------------------------------------------------------------
// #24 effectiveness
// ---------------------------------------------------------------------------------------------

export interface EffectivenessReport {
  cards: {
    total: number
    berkesan: number
    evaluated: number
    rate: number
    needsAction: number
    sederhana: number
    tidakBerkesan: number
    notEvaluated: number
  }
  /** Berkesan, Sederhana, Tidak Berkesan, Belum Dinilai. */
  doughnut: [number, number, number, number]
  trend: { labels: string[]; data: number[] }
  byType: { type: InterventionType; label: string; count: number }[]
  byTeacher: {
    teacherId: number
    name: string
    total: number
    berkesan: number
    notEvaluated: number
    rate: number | null
  }[]
  followUps: {
    id: number
    studentId: number
    studentName: string
    type: InterventionType
    label: string
    interventionDate: string
    effectiveness: Effectiveness
  }[]
  bySchool: {
    schoolId: number
    school: string
    total: number
    berkesan: number
    sederhana: number
    tidakBerkesan: number
    notEvaluated: number
    rate: number
  }[]
}

const MONTHS_BM = [
  'Jan',
  'Feb',
  'Mac',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ogo',
  'Sep',
  'Okt',
  'Nov',
  'Dis',
]

/** BR-M18-17 over the given intervention rows at `now`. */
export function effectivenessReport(
  rows: readonly AmaranInterventionRow[],
  now: number,
): EffectivenessReport {
  const count = (e: Effectiveness) => rows.filter((r) => r.effectiveness === e).length
  const berkesan = count('berkesan')
  const sederhana = count('sederhana')
  const tidak = count('tidak_berkesan')
  const notEvaluated = count('belum_dinilai')
  const evaluated = rows.length - notEvaluated

  // Trend: rows per month of `interventionDate`, the current month and the 5 before (MYT).
  const iso = new Date(now + 8 * 3_600_000).toISOString()
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7)) - 1
  const labels: string[] = []
  const keys: string[] = []
  for (let k = 5; k >= 0; k--) {
    const idx = year * 12 + month - k
    const y = Math.floor(idx / 12)
    const m = idx % 12
    keys.push(`${String(y)}-${String(m + 1).padStart(2, '0')}`)
    labels.push(`${MONTHS_BM[m] as string} ${String(y)}`)
  }
  const data = keys.map((key) => rows.filter((r) => r.interventionDate.startsWith(key)).length)

  const byType = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABEL[type],
    count: rows.filter((r) => r.type === type).length,
  })).filter((t) => t.count > 0)

  const teachers = new Map<number, AmaranInterventionRow[]>()
  for (const r of rows) teachers.set(r.teacherId, [...(teachers.get(r.teacherId) ?? []), r])
  const byTeacher = [...teachers.entries()]
    .map(([teacherId, list]) => {
      const ev = list.filter((r) => r.effectiveness !== 'belum_dinilai').length
      const ok = list.filter((r) => r.effectiveness === 'berkesan').length
      return {
        teacherId,
        name: users.get(teacherId)?.name ?? `Guru ${String(teacherId)}`,
        total: list.length,
        berkesan: ok,
        notEvaluated: list.length - ev,
        rate: ev === 0 ? null : pctInt(ok, ev),
      }
    })
    .sort((a, b) => b.total - a.total || a.teacherId - b.teacherId)

  const followUps = rows
    .filter((r) => r.effectiveness !== 'berkesan')
    .sort((a, b) => b.interventionDate.localeCompare(a.interventionDate) || b.id - a.id)
    .map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: users.get(r.studentId)?.name ?? `Pelajar ${String(r.studentId)}`,
      type: r.type,
      label: TYPE_LABEL[r.type],
      interventionDate: r.interventionDate,
      effectiveness: r.effectiveness,
    }))

  const bySchoolMap = new Map<number, AmaranInterventionRow[]>()
  for (const r of rows) bySchoolMap.set(r.schoolId, [...(bySchoolMap.get(r.schoolId) ?? []), r])
  const bySchool = [...bySchoolMap.entries()]
    .map(([schoolId, list]) => {
      const ev = list.filter((r) => r.effectiveness !== 'belum_dinilai').length
      const ok = list.filter((r) => r.effectiveness === 'berkesan').length
      return {
        schoolId,
        school: schools.get(schoolId)?.name ?? `Sekolah ${String(schoolId)}`,
        total: list.length,
        berkesan: ok,
        sederhana: list.filter((r) => r.effectiveness === 'sederhana').length,
        tidakBerkesan: list.filter((r) => r.effectiveness === 'tidak_berkesan').length,
        notEvaluated: list.length - ev,
        rate: ev === 0 ? 0 : pctInt(ok, ev),
      }
    })
    .sort((a, b) => b.total - a.total || a.schoolId - b.schoolId)

  return {
    cards: {
      total: rows.length,
      berkesan,
      evaluated,
      rate: evaluated === 0 ? 0 : pctInt(berkesan, evaluated),
      needsAction: sederhana + tidak,
      sederhana,
      tidakBerkesan: tidak,
      notEvaluated,
    },
    doughnut: [berkesan, sederhana, tidak, notEvaluated],
    trend: { labels, data },
    byType,
    byTeacher,
    followUps,
    bySchool,
  }
}

/** #24: the effectiveness report of one school; `null` for an unknown school. */
export function effectivenessForSchool(
  schoolId: number,
  now: number,
): { school: { id: number; name: string }; report: EffectivenessReport } | null {
  const school = schools.get(schoolId)
  if (!school) return null
  return {
    school: { id: school.id, name: school.name },
    report: effectivenessReport(amaranInterventionsRepo.forSchool(schoolId), now),
  }
}

// ---------------------------------------------------------------------------------------------
// #30 CSV (SRS §7.2, SEC-M18-03)
// ---------------------------------------------------------------------------------------------

/** CSV-injection guard + RFC 4180 quoting. */
export function csvCell(value: string | number | null): string {
  let s = value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const BOM = String.fromCharCode(0xfeff)

export const CSV_HEADER = [
  'Bil',
  'Pelajar',
  'Tingkatan / Kelas',
  'Skor Risiko',
  'Status',
  'Ketepatan',
  'Penglibatan',
  'Penguasaan',
] as const

/** The school CSV (UTF-8 BOM, CRLF); the school's pupils only; no IC, e-mail or phone. */
export function schoolCsv(schoolId: number, options?: RiskOptions): string {
  const lines = [CSV_HEADER.map(csvCell).join(',')]
  for (const p of atRiskList(schoolId, options)) {
    lines.push(
      [
        p.rank,
        p.name,
        p.classLabel,
        p.score.toFixed(1),
        STATUS_LABEL[p.status],
        p.accuracyText,
        p.engagementText,
        p.masteryText,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}

/** `yyyymmdd` of an instant in MYT. */
export function yyyymmdd(now: number): string {
  return new Date(now + 8 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, '')
}

export const amaran = {
  schoolRisk,
  subjectRisk,
  atRiskList,
  summary,
  effectiveness: effectivenessForSchool,
  schoolCsv,
  parseTingkatan,
}
