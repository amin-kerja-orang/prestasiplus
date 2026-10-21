import {
  AMARAN_MONTH_ABBREVIATIONS,
  AMARAN_STATUS_LABELS,
  AMARAN_TYPE_LABELS,
  PRACTICE_READS_MASTERY_THRESHOLDS,
  type AmaranEffectiveness,
  type AmaranEffectivenessReport,
  type AmaranInterventionType,
  type AmaranPupilRisk,
  type AmaranRiskStatus,
  type AmaranTally,
} from '@pp/contract'

/**
 * Pure rules of the Amaran Awal early warning (BE-21 Part C, BR-M18-13/14/15). No database, no clock: the caller passes `now`
 * (epoch ms). Risk is computed at request time and never stored.
 */

export const DAY_MS = 86_400_000
const MYT_OFFSET_MS = 8 * 3_600_000

export const round1 = (n: number): number => Math.round(n * 10) / 10
export const pctInt = (part: number, whole: number): number => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/** score < 40 on_track, < 60 watch, otherwise high. */
export function statusOf(score: number): AmaranRiskStatus {
  return score < 40 ? 'on_track' : score < 60 ? 'watch' : 'high'
}

/** The M05 BR-20 ladder (L0 to L10) applied to the correct answers of one subject (the owner's thresholds from the contract). */
export function masteryLevelOf(correct: number): number {
  let level = 0
  for (const [i, t] of PRACTICE_READS_MASTERY_THRESHOLDS.entries()) if (correct >= t) level = i
  return level
}

export interface RiskInputs {
  /** Mean practice-session accuracy in percent, or null without a completed practice session. */
  accuracy: number | null
  sessions: number
  /** Epoch ms of the last activity, or null. */
  lastActiveAt: number | null
  /** One level (0 to 10) per mastery record. */
  masteryLevels: readonly number[]
}

export interface RiskComputed {
  a: number
  e: number
  m: number
  score: number
  status: AmaranRiskStatus
  neverActive: boolean
  masteryMean: number | null
}

/**
 * A = 100 - mean accuracy; 100 without a session but with a last-active date or a mastery record; 50 with none of the three.
 * E = min(100, whole days since last active x 100 / 30); 100 when never active.
 * M = (10 - mean mastery level) x 10; 100 without mastery records.
 * score = 0.4A + 0.3E + 0.3M, one decimal.
 */
export function computeRisk(input: RiskInputs, now: number): RiskComputed {
  const hasActivity = input.lastActiveAt !== null
  const hasMastery = input.masteryLevels.length > 0
  const hasSession = input.sessions > 0 && input.accuracy !== null
  const neverActive = !hasSession && !hasActivity && !hasMastery
  const masteryMean = hasMastery ? input.masteryLevels.reduce((x, y) => x + y, 0) / input.masteryLevels.length : null

  const a = hasSession ? 100 - (input.accuracy as number) : hasActivity || hasMastery ? 100 : 50
  const days = input.lastActiveAt === null ? null : Math.max(0, Math.floor((now - input.lastActiveAt) / DAY_MS))
  const e = days === null ? 100 : Math.min(100, (days * 100) / 30)
  const m = masteryMean === null ? 100 : (10 - masteryMean) * 10
  const score = round1(0.4 * a + 0.3 * e + 0.3 * m)
  return { a, e, m, score, status: statusOf(score), neverActive, masteryMean }
}

// --- labels and filters -----------------------------------------------------------------------------------------------------

/** `T4`, `T5`, `4`, `5` (any case) to 4 or 5; anything else is no filter. */
export function parseTingkatan(value: string | undefined): 4 | 5 | undefined {
  const v = value?.trim().toUpperCase().replace(/^T/, '')
  return v === '4' ? 4 : v === '5' ? 5 : undefined
}

/** "Tingkatan n" (grades 7 to 11), "Darjah n" (grades 1 to 6) or null. */
export function levelLabelOf(grade: number | null): string | null {
  if (grade === null) return null
  if (grade >= 7) return `Tingkatan ${grade - 6}`
  if (grade >= 1) return `Darjah ${grade}`
  return null
}

export interface ClassFact {
  name: string
  /** `tingkatan-n`, `tahun-n` or null. */
  slug: string | null
}

/** "Tingkatan n {class}", "Darjah n {class}", or "-" without a class. */
export function classLabelOf(classes: readonly ClassFact[]): string {
  const c = classes[0]
  if (!c) return '-'
  const m = c.slug === null ? null : /^(tingkatan|tahun)-(\d)$/.exec(c.slug)
  const level = m ? `${m[1] === 'tingkatan' ? 'Tingkatan' : 'Darjah'} ${m[2] as string} ` : ''
  return `${level}${c.name}`
}

/** A pupil is in a tingkatan when one of the active classes is of that level (the filter is class based). */
export const inTingkatan = (classes: readonly ClassFact[], t: 4 | 5): boolean => classes.some((c) => c.slug === `tingkatan-${t}`)

/** The MYT calendar date (yyyy-mm-dd) of an instant. */
export const mytDate = (ms: number): string => new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 10)

/** yyyymmdd of an instant in MYT (file names). */
export const yyyymmdd = (ms: number): string => mytDate(ms).replace(/-/g, '')

// --- the pupil rows ---------------------------------------------------------------------------------------------------------

export interface PupilFacts extends RiskInputs {
  userId: string
  name: string
  grade: number | null
  classes: readonly ClassFact[]
}

/** BigInt-safe compare of two decimal ids. */
export const compareIds = (a: string, b: string): number => (a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0)

export interface ScoredPupil {
  facts: PupilFacts
  risk: RiskComputed
}

export function scorePupils(facts: readonly PupilFacts[], now: number): ScoredPupil[] {
  return facts.map((f) => ({ facts: f, risk: computeRisk(f, now) }))
}

/** Score descending, then name, then id. */
export function rankOrder(a: ScoredPupil, b: ScoredPupil): number {
  return b.risk.score - a.risk.score || a.facts.name.localeCompare(b.facts.name, 'ms', { sensitivity: 'base' }) || compareIds(a.facts.userId, b.facts.userId)
}

/** One row of the risk list with the exact BM cell texts (never any IC, e-mail or phone). */
export function pupilView(p: ScoredPupil, rank: number): AmaranPupilRisk {
  const f = p.facts
  const accuracy = f.sessions > 0 && f.accuracy !== null ? round1(f.accuracy) : null
  const engagement = f.lastActiveAt === null ? null : mytDate(f.lastActiveAt)
  const mastery = p.risk.masteryMean === null ? null : round1(p.risk.masteryMean)
  return {
    rank,
    userId: f.userId,
    studentId: f.userId,
    name: f.name,
    levelLabel: levelLabelOf(f.grade),
    tingkatan: f.grade !== null && f.grade >= 7 && f.grade <= 11 ? f.grade - 6 : null,
    className: f.classes[0]?.name ?? null,
    classLabel: classLabelOf(f.classes),
    score: p.risk.score,
    status: p.risk.status,
    accuracy,
    engagement,
    mastery,
    accuracyText: accuracy !== null ? `Purata ketepatan: ${accuracy}%` : p.risk.neverActive ? 'Tiada data latihan' : 'Tiada data',
    engagementText: engagement !== null ? `Terakhir aktif: ${engagement}` : 'Tiada aktiviti',
    masteryText: p.risk.masteryMean !== null ? `Purata tahap: L${Math.round(p.risk.masteryMean)}` : p.risk.neverActive ? 'Tiada data penguasaan' : 'Tiada data',
  }
}

export function tallyOf(pupils: readonly ScoredPupil[]): AmaranTally {
  const green = pupils.filter((p) => p.risk.status === 'on_track').length
  const yellow = pupils.filter((p) => p.risk.status === 'watch').length
  const red = pupils.filter((p) => p.risk.status === 'high').length
  const total = pupils.length
  return { green, yellow, red, total, pct: { green: pctInt(green, total), yellow: pctInt(yellow, total), red: pctInt(red, total) } }
}

export const statusLabelOf = (s: AmaranRiskStatus): string => AMARAN_STATUS_LABELS[s]

// --- weakness ---------------------------------------------------------------------------------------------------------------

/** A pupil is weak in a subject below this percent of correct answers (the DSKP "lemah" band of the school reports). */
export const WEAK_BELOW_PCT = 50

export interface SubjectCounter {
  subjectId: string
  correct: number
  answered: number
}

export interface WeaknessRow {
  subjectId: string
  weak: number
  total: number
  pct: number
}

/**
 * One row per subject that at least `minPupils` pupils answered, in subject id order (numeric). `weak` = pupils under
 * `WEAK_BELOW_PCT`. A subject with fewer pupils than `minPupils` is left out (k-cohort rule).
 */
export function weaknessOf(perPupil: readonly (readonly SubjectCounter[])[], minPupils: number): WeaknessRow[] {
  const by = new Map<string, { weak: number; total: number }>()
  for (const counters of perPupil) {
    for (const c of counters) {
      if (c.answered <= 0) continue
      const row = by.get(c.subjectId) ?? { weak: 0, total: 0 }
      row.total += 1
      if ((c.correct / c.answered) * 100 < WEAK_BELOW_PCT) row.weak += 1
      by.set(c.subjectId, row)
    }
  }
  return [...by.entries()]
    .filter(([, r]) => r.total >= minPupils)
    .sort((a, b) => compareIds(a[0], b[0]))
    .map(([subjectId, r]) => ({ subjectId, weak: r.weak, total: r.total, pct: pctInt(r.weak, r.total) }))
}

// --- effectiveness ----------------------------------------------------------------------------------------------------------

export interface InterventionFact {
  id: string
  studentId: string
  studentName: string
  teacherId: string
  /** yyyy-mm-dd */
  date: string
  beforeAccuracy: number | null
  afterAccuracy: number | null
}

/** No after-measure or no before-measure: belum_dinilai; after above before: berkesan; below: tidak_berkesan; equal: sederhana. */
export function effectivenessOf(i: Pick<InterventionFact, 'beforeAccuracy' | 'afterAccuracy'>): AmaranEffectiveness {
  if (i.afterAccuracy === null || i.beforeAccuracy === null) return 'belum_dinilai'
  if (i.afterAccuracy > i.beforeAccuracy) return 'berkesan'
  if (i.afterAccuracy < i.beforeAccuracy) return 'tidak_berkesan'
  return 'sederhana'
}

/** The type of a BE-20 intervention: that store has no type column, so every row is "Lain-lain". */
export const INTERVENTION_TYPE: AmaranInterventionType = 'lain'

const TYPE_ORDER = Object.keys(AMARAN_TYPE_LABELS) as AmaranInterventionType[]

/** The current month and the 5 before it (MYT), oldest first: keys `yyyy-mm` and labels "Okt 2026". */
export function trendMonths(now: number): { keys: string[]; labels: string[] } {
  const iso = new Date(now + MYT_OFFSET_MS).toISOString()
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7)) - 1
  const keys: string[] = []
  const labels: string[] = []
  for (let k = 5; k >= 0; k--) {
    const idx = year * 12 + month - k
    const y = Math.floor(idx / 12)
    const m = idx % 12
    keys.push(`${y}-${String(m + 1).padStart(2, '0')}`)
    labels.push(`${AMARAN_MONTH_ABBREVIATIONS[m] as string} ${y}`)
  }
  return { keys, labels }
}

export type TeacherNames = ReadonlyMap<string, string>

/** BR-M18-17 over the interventions of one school. `bySchool` has a single row (the caller school). */
export function effectivenessReport(
  rows: readonly InterventionFact[],
  now: number,
  school: { id: string; name: string },
  teacherNames: TeacherNames,
): AmaranEffectivenessReport {
  const eff = rows.map((r) => ({ r, e: effectivenessOf(r) }))
  const count = (e: AmaranEffectiveness): number => eff.filter((x) => x.e === e).length
  const berkesan = count('berkesan')
  const sederhana = count('sederhana')
  const tidak = count('tidak_berkesan')
  const notEvaluated = count('belum_dinilai')
  const evaluated = rows.length - notEvaluated

  const { keys, labels } = trendMonths(now)
  const data = keys.map((k) => rows.filter((r) => r.date.startsWith(k)).length)

  const byType = TYPE_ORDER.map((type) => ({
    type,
    label: AMARAN_TYPE_LABELS[type],
    count: type === INTERVENTION_TYPE ? rows.length : 0,
  })).filter((t) => t.count > 0)

  const teachers = new Map<string, typeof eff>()
  for (const x of eff) teachers.set(x.r.teacherId, [...(teachers.get(x.r.teacherId) ?? []), x])
  const byTeacher = [...teachers.entries()]
    .map(([teacherId, list]) => {
      const ev = list.filter((x) => x.e !== 'belum_dinilai').length
      const ok = list.filter((x) => x.e === 'berkesan').length
      return {
        teacherId,
        name: teacherNames.get(teacherId) ?? `Guru ${teacherId}`,
        total: list.length,
        berkesan: ok,
        notEvaluated: list.length - ev,
        rate: ev === 0 ? null : pctInt(ok, ev),
      }
    })
    .sort((a, b) => b.total - a.total || compareIds(a.teacherId, b.teacherId))

  const followUps = eff
    .filter((x) => x.e !== 'berkesan')
    .sort((a, b) => b.r.date.localeCompare(a.r.date) || compareIds(b.r.id, a.r.id))
    .map(({ r, e }) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.studentName,
      type: INTERVENTION_TYPE,
      label: AMARAN_TYPE_LABELS[INTERVENTION_TYPE],
      interventionDate: r.date,
      effectiveness: e,
    }))

  return {
    cards: {
      total: rows.length,
      berkesan,
      evaluated,
      rate: pctInt(berkesan, evaluated),
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
    bySchool:
      rows.length === 0
        ? []
        : [
            {
              schoolId: school.id,
              school: school.name,
              total: rows.length,
              berkesan,
              sederhana,
              tidakBerkesan: tidak,
              notEvaluated,
              rate: pctInt(berkesan, evaluated),
            },
          ],
  }
}
