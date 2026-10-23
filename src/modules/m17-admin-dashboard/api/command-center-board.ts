/**
 * Command Center board client (SRS M17 v1.13 §7 #3–#5; M17-T1b): the live board S2, the daily-activity board S3
 * and its school drill, plus the pure display rules the pages share (FR-M17-23…32, FR-M17-37…40). The S2 / S3
 * pages (M17-T3, and the Admin Sekolah alias pages of the same component) import these functions and the
 * types; they do not change this file (build-plan §S.3 rule 5).
 *
 * Guard **AS** (#3, #4): an admin sees the platform; a school admin sees the same shapes scoped to the
 * session's school (a client `school_id` is never sent and never honoured; `topSchools` is empty, `schools`
 * is omitted, `scope` is `'school'`). #5 is admin only (a school admin gets 403). Failures reject with `ApiError`:
 * 401 without a session, 403 for any other role (and for a school admin without a school), 404 for an
 * unknown school on #5. An unknown `period` is answered with today's figures and echoed in `period`.
 */

import { api } from '@/api'

import type {
  CcDailyActivity,
  CcLiveData,
  CcPeriod,
  CcSchoolDrill,
} from './command-center-board-types'

export type * from './command-center-board-types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #3 `GET /api/admin/command-center/live-data` (S2, polled every 10 s). */
export const fetchCcLiveData = (o: Signal = {}) =>
  api.get<CcLiveData>('/api/admin/command-center/live-data', withSignal(o))

/** #4 `GET /api/command-center/daily-activity?period=` (S3, polled every 30 s). */
export const fetchCcDailyActivity = (period: CcPeriod, o: Signal = {}) =>
  api.get<CcDailyActivity>('/api/command-center/daily-activity', {
    ...withSignal(o),
    query: { period },
  })

/** #5 `GET /api/command-center/daily-activity/school/{id}?period=` (S3 school drill; admin only). */
export const fetchCcSchoolDrill = (schoolId: number | string, period: CcPeriod, o: Signal = {}) =>
  api.get<CcSchoolDrill>(`/api/command-center/daily-activity/school/${String(schoolId)}`, {
    ...withSignal(o),
    query: { period },
  })

// --- display rules ---------------------------------------------------------------------------------

export type CcTrendWord = 'peningkatan' | 'penurunan' | 'stabil'

/** BR-M17-07 / FR-M17-26: "penurunan" below 0, "peningkatan" above 0, "stabil" at 0. */
export const ccTrendWord = (weekChange: number): CcTrendWord =>
  weekChange < 0 ? 'penurunan' : weekChange > 0 ? 'peningkatan' : 'stabil'

export interface CcAlesaSentence {
  /** "Platform menunjukkan " / "Sekolah anda menunjukkan " (PROPOSED wording, the page never says "platform" for a school). */
  before: string
  /** The bold word. */
  trend: CcTrendWord
  after: string
  /** `before + trend + after`. */
  text: string
}

/**
 * The "ALESA AI" sentence (FN-M17-3.3.3, DV-M17-09): "Platform menunjukkan **{trend}** {|change|}% minggu ini.
 * {activeRatio}% pelajar terlibat aktif. Ketepatan purata {acc}% dengan {n} sekolah aktif. GPS keseluruhan:
 * {gps}." The active ratio is (Champion + Konsisten + Berkembang) ÷ Σ buckets of DC-M17-05 on the platform view;
 * the school view has no buckets (zeros) and uses its engaged ÷ registered pupils (INFERRED).
 */
export function ccAlesaSentence(d: CcLiveData): CcAlesaSentence {
  let ratio = 0
  if (d.scope === 'school') {
    ratio = d.totalStudents === 0 ? 0 : (d.activeStudents / d.totalStudents) * 100
  } else {
    const e = d.engagement
    const total = e.champion + e.consistent + e.developing + e.minimum + e.disengaged
    ratio = total === 0 ? 0 : ((e.champion + e.consistent + e.developing) / total) * 100
  }
  const trend = ccTrendWord(d.weekChange)
  const before = d.scope === 'school' ? 'Sekolah anda menunjukkan ' : 'Platform menunjukkan '
  const after =
    ` ${String(Math.abs(d.weekChange))}% minggu ini. ${ratio.toFixed(1)}% pelajar terlibat aktif. ` +
    `Ketepatan purata ${d.accuracy.toFixed(1)}% dengan ${String(d.totalSchools)} sekolah aktif. ` +
    `GPS keseluruhan: ${d.gpsOverall.toFixed(2)}.`
  return { before, trend, after, text: `${before}${trend}${after}` }
}

/** T1 stars "★★★★☆" for a 1–5 mean (k = round(v ÷ 5 × 5), DV-M17-08). */
export function ccStars(value: number): string {
  const k = Math.max(0, Math.min(5, Math.round(value)))
  return '★'.repeat(k) + '☆'.repeat(5 - k)
}

/** Kirkpatrick bar fractions 0–1 (BR-M17-08): T1 v ÷ 5, T2 accuracy %, T3 min(n ÷ 500, 1), T4 min(gps ÷ 5, 1). */
export function ccKirkpatrickBars(d: CcLiveData): {
  t1: number
  t2: number
  t3: number
  t4: number
} {
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  return {
    t1: clamp(d.kirk.t1.value / 5),
    t2: clamp(d.kirk.t2Accuracy / 100),
    t3: clamp(d.kirk.t3Active / 500),
    t4: clamp(d.kirk.t4Gps / 5),
  }
}

/** "Aktiviti Hari Ini" bar width in percent: today ÷ max(today, week ÷ 5, 100) × 100 (BR-M17-07). */
export function ccTodayBarPercent(d: CcLiveData): number {
  const max = Math.max(d.answeredToday, d.answeredWeek / 5, 100)
  return (d.answeredToday / max) * 100
}

export interface CcChangeLine {
  tone: 'down' | 'up' | 'same'
  text: string
}

/** The week change line: "▼ -{n}% vs minggu lepas", "▲ +{n}% vs minggu lepas", "Sama dengan minggu lepas". */
export function ccChangeLine(weekChange: number): CcChangeLine {
  if (weekChange < 0)
    return { tone: 'down', text: `▼ -${String(Math.abs(weekChange))}% vs minggu lepas` }
  if (weekChange > 0) return { tone: 'up', text: `▲ +${String(weekChange)}% vs minggu lepas` }
  return { tone: 'same', text: 'Sama dengan minggu lepas' }
}

/** Engagement bar widths in percent: n ÷ max × 100 (platform buckets, DC-M17-05). */
export function ccEngagementWidths(d: CcLiveData): Record<keyof CcLiveData['engagement'], number> {
  const e = d.engagement
  const max = Math.max(e.champion, e.consistent, e.developing, e.minimum, e.disengaged)
  const w = (n: number) => (max === 0 ? 0 : (n / max) * 100)
  return {
    champion: w(e.champion),
    consistent: w(e.consistent),
    developing: w(e.developing),
    minimum: w(e.minimum),
    disengaged: w(e.disengaged),
  }
}

/** Bar heights in percent of the school view's 7 days: n ÷ max × 100 with a 4 % minimum (OQ-M17-12). */
export function ccDailyTrendHeights(d: CcLiveData): number[] {
  const max = Math.max(1, ...d.dailyTrend.map((p) => p.count))
  return d.dailyTrend.map((p) => Math.max(4, (p.count / max) * 100))
}

/** The S3 login card label per tab (DV-M17-10). */
export const CC_LOGIN_LABEL: Readonly<Record<CcPeriod, string>> = Object.freeze({
  today: 'Login Hari Ini',
  week: 'Login Minggu Ini',
  month: 'Login Bulan Ini',
})

/** "student: 9 · teacher: 1" (roles with at least one login, in the response order, FR-M17-38). */
export const ccLoginRoleLine = (byRole: Record<string, number>): string =>
  Object.entries(byRole)
    .map(([role, n]) => `${role}: ${String(n)}`)
    .join(' · ')

/** "Purata: {m}m {s}s" (mean `timeSpent`, floor). */
export const ccAvgSessionLabel = (seconds: number): string =>
  `Purata: ${String(Math.floor(seconds / 60))}m ${String(Math.floor(seconds % 60))}s`

/** "Ketepatan: {n}%" with ".0" dropped (FR-M17-39, BR-M17-06): 95.0 → "95", 84.6 → "84.6". */
export const ccAccuracyLabel = (accuracy: number): string => `Ketepatan: ${String(accuracy)}%`

/** The S3 header title per view (FR-M17-116): "AKTIVITI PLATFORM" or, for a school admin, "AKTIVITI SEKOLAH". */
export const ccDailyTitle = (scope: CcLiveData['scope']): string =>
  scope === 'school' ? 'AKTIVITI SEKOLAH' : 'AKTIVITI PLATFORM'
