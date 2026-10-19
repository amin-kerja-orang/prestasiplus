/**
 * SRS M27 Part B §19 #4 `GET /api/admin-sekolah/laporan-aktiviti?range=` (S3 "Laporan Aktiviti"; FR-M27-66 to 73,
 * BR-M27-26, XR-M27-15). Guard SA; the school is the session's and nothing else in the request is read.
 *
 * Thin mapping onto the M17 pure builder `buildStatsReport(range, { schoolId })`. In the school scope the builder
 * already answers `schools: []` and `overview.score` / `structuredScore` null; this handler drops those keys and
 * the per-row `schoolName` so the response never carries a platform-only figure ("Skor Purata", "Struktur").
 * The range is normalised by the builder (7, 30, 90, else 30).
 */

import { ok, queryString, route, type RouteDef } from '@/mock/define'
import { buildStatsReport, normaliseRange } from '@/modules/m17-admin-dashboard/mock'
import type { StatsPupilRow, StatsTeacherRow } from '@/modules/m17-admin-dashboard/mock'

import type {
  ActivityPupilRow,
  ActivityTeacherRow,
  SchoolActivityReport,
} from '../../api/school-admin'
import { requireSchoolAdminWithSchool, schoolOf } from '../read-models/school-scope'

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
