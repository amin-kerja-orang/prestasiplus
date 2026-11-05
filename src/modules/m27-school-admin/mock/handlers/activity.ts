/**
 * SRS M27 Part B §19 #4 `GET /api/admin-sekolah/laporan-aktiviti?range=` (S3 "Laporan Aktiviti"; FR-M27-66 to 73,
 * BR-M27-26, XR-M27-15). Guard SA; the school is the session's and nothing else in the request is read.
 *
 * Thin mapping onto the M17 pure builder `buildStatsReport(range, { schoolId })`. In the school scope the builder
 * already answers `schools: []` and `overview.score` / `structuredScore` null; this handler drops those keys and
 * the per-row `schoolName` so the response never carries a platform-only figure; "Skor Purata" is the school's own
 * `overview.skorPurata` (mean of per-session accuracy, R1-AS-48), computed here from the M05 history.
 * The range is normalised by the builder (7, 30, 90, else 30).
 */

import { ok, queryString, route, type RouteDef } from '@/mock/define'
import { buildStatsReport, normaliseRange } from '@/modules/m17-admin-dashboard/mock'
import type { StatsPupilRow, StatsTeacherRow } from '@/modules/m17-admin-dashboard/mock'

import { DAY_MS, startOfDay } from '@/lib/time'
import { practice } from '@/modules/m05-practice/mock'

import type {
  ActivityPupilRow,
  ActivityTeacherRow,
  SchoolActivityReport,
} from '../../api/school-admin'
import { peopleOf } from '../read-models/school-people'
import { requireSchoolAdminWithSchool, schoolOf } from '../read-models/school-scope'
import { round1 } from '../read-models/usage'

const pupilRow = (r: StatsPupilRow): ActivityPupilRow => ({
  userId: r.userId,
  name: r.name,
  className: r.className,
  sessions: r.sessions,
  accuracy: r.accuracy,
  seconds: r.seconds,
  coins: r.coins,
  lastLoginAt: r.lastLoginAt,
})
const teacherRow = (r: StatsTeacherRow): ActivityTeacherRow => ({
  userId: r.userId,
  name: r.name,
  email: r.email,
  loggedIn: r.loggedIn,
  mcq: r.mcq,
  structured: r.structured,
  coins: r.coins,
  hasHeadcount: r.hasHeadcount,
  lastLoginAt: r.lastLoginAt,
})

/**
 * "Skor Purata" (R1-AS-48): the mean of per-session accuracy of the completed sessions with questions of the school's
 * pupils in the range window (today included); null without one.
 */
function skorPurata(schoolId: number, days: number, now: number): number | null {
  const from = startOfDay(now) - (days - 1) * DAY_MS
  const values: number[] = []
  for (const pupil of peopleOf(schoolId, 'student', { isActive: true })) {
    for (const s of practice.history(pupil.id, { from, to: now + 1 })) {
      if (s.questionCount > 0) values.push((s.correctCount / s.questionCount) * 100)
    }
  }
  return values.length === 0 ? null : round1(values.reduce((a, b) => a + b, 0) / values.length)
}

/** Q-M27-S3 for `schoolId` at `now` (epoch ms). */
export function buildSchoolActivityReport(
  schoolId: number,
  range: unknown,
  now?: number,
): SchoolActivityReport {
  const r = buildStatsReport(normaliseRange(range), { schoolId, now, includeInactive: true })
  return {
    range: r.range,
    schoolId,
    generatedAt: r.generatedAt,
    overview: {
      pupils: r.overview.pupils,
      pupilsLogged: r.overview.pupilsLogged,
      teachers: r.overview.teachers,
      teachersLogged: r.overview.teachersLogged,
      practised: r.overview.practised,
      activity: r.overview.activity,
      skorPurata: skorPurata(schoolId, r.range, now ?? Date.now()),
    },
    trend: r.trend,
    breakdown: r.breakdown,
    topPupils: r.topPupils,
    teachersNeverLogged: r.teachersNeverLogged,
    teachers: r.teachers.map(teacherRow),
    pupils: {
      semua: r.pupils.semua.map(pupilRow),
      aktif: r.pupils.aktif.map(pupilRow),
      loginSahaja: r.pupils.loginSahaja.map(pupilRow),
      belumLogin: r.pupils.belumLogin.map(pupilRow),
    },
    tiles: { teachers: r.tiles.teachers, pupils: r.tiles.pupils },
  }
}

export const activityRoutes: RouteDef[] = [
  route('GET', '/api/admin-sekolah/laporan-aktiviti', [requireSchoolAdminWithSchool], (req, ctx) =>
    ok(
      buildSchoolActivityReport(
        schoolOf(req).schoolId,
        queryString(req.query, 'range'),
        ctx.clock.now(),
      ),
    ),
  ),
]
