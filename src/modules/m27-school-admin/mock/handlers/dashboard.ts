/**
 * SRS M27 v1.3 §7 #1 `GET /api/admin-sekolah/dashboard` (S0 "Dashboard Sekolah"; Q-M27-S0, §6.3).
 *
 * Guard **SA**: `school_admin` only (401 guest, 403 other role). The school is the session user's school
 * and nothing in the request is read: a `school_admin` without a school gets 403, never "all schools"
 * (FR-M27-08, 09, 11; BR-M27-01). M27 owns no data (D12): every figure is computed per request through the
 * owners' contracts: M02 `schools` and `schoolSubscriptions`, M01 `users`, M10 `classrooms`, M08
 * `schoolPerformance`, M09 `perutusan`.
 *
 * Owner gaps handled by the SRS fallbacks (reported, not fixed here): M08 has no `gps.grade` yet (XR-M27-06b),
 * so the grade is derived from `gps.value` with BR-M08-04; M18 has no `Q-M18-RISK` read (XR-M27-08), so
 * `performance.risk` is `null`.
 */

import { toEpochMs } from '@/lib/time'
import { forbidden, ok, requireRole, route, type Middleware, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { schoolSubscriptions, schools } from '@/modules/m02-users-schools/mock'
import { schoolPerformance } from '@/modules/m08-student-performance/mock'
import { perutusan } from '@/modules/m09-content/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type { SchoolDashboard, SubscriptionStatus } from '../../api/dashboard'

/** M01 §6.7 role label of `school_admin` (FR-M27-19). */
export const ROLE_LABEL = 'Admin Sekolah'
/** FR-M27-13: the Perutusan card shows the first 3 visible posts of the viewer (PROPOSED). */
export const PERUTUSAN_LIMIT = 3

/** M02 BR-23 badge wording (FR-M27-30, PROPOSED); `none` is the observed "Belum Ada". */
export const SUBSCRIPTION_LABEL: Readonly<Record<SubscriptionStatus, string>> = {
  none: 'Belum Ada',
  active: 'Aktif',
  grace: 'Tempoh Ihsan',
  expired: 'Tamat',
}

/** M08 BR-M08-04 grade scale, best first: A+ is 0 points … G is 9. */
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const

/** FR-M27-32: the grade at round(GPS), half up (BR-M08-04), clamped to the scale. */
export function gradeAtGps(gps: number): string {
  const index = Math.min(GRADES.length - 1, Math.max(0, Math.floor(gps + 0.5)))
  return GRADES[index] as string
}

/**
 * BR-M27-14: the school's current subscription = the `active` row whose period contains `now`; else
 * `grace`; else `expired`. A `cancelled` row is not a current subscription; none gives `none`.
 */
export function currentSubscriptionStatus(schoolId: number, now: number): SubscriptionStatus {
  const rows = schoolSubscriptions.forSchool(schoolId)
  const inPeriod = rows.some(
    (r) => r.status === 'active' && toEpochMs(r.startsAt) <= now && now <= toEpochMs(r.endsAt),
  )
  if (inPeriod) return 'active'
  if (rows.some((r) => r.status === 'grace')) return 'grace'
  if (rows.some((r) => r.status === 'expired')) return 'expired'
  return 'none'
}

/** A `school_admin` whose user has no school is refused: a missing scope never means "all" (FR-M27-08). */
const refuseSchoollessAdmin: Middleware = (req) =>
  users.get(req.session?.userId ?? -1)?.schoolId == null ? forbidden() : undefined

/** Q-M27-S0 for a school admin of `schoolId` at `now`. Throws when the school is unknown (never expected). */
export function buildSchoolDashboard(
  viewer: { id: number; schoolId: number },
  now: number,
): SchoolDashboard {
  const { schoolId } = viewer
  const school = schools.get(schoolId)
  if (!school) throw new Error(`M27: unknown school ${String(schoolId)}`)

  const year = new Date(now + 8 * 3_600_000).getUTCFullYear()
  const perf = schoolPerformance({ kind: 'school', schoolId }, year)
  const sub = currentSubscriptionStatus(schoolId, now)
  const count = (role: 'student' | 'teacher') =>
    users.adminList({ role, schoolId, pageSize: 1 }).total

  const gpsValue = perf.gps.value
  const practice = perf.stats
  return {
    school: {
      id: school.id,
      name: school.name,
      state: school.state,
      ppd: school.district && school.district !== '' ? school.district : null,
      code: school.code !== '' ? school.code : null,
    },
    roleLabel: ROLE_LABEL,
    perutusan: perutusan
      .list({ id: viewer.id, role: 'school_admin', schoolId })
      .slice(0, PERUTUSAN_LIMIT)
      .map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt,
        author: { initials: p.author.initials, roleLabel: p.author.roleLabel },
      })),
    cards: {
      pupils: count('student'),
      teachers: count('teacher'),
      activeClasses: classrooms.list({ isActive: true, schoolId }).length,
      subscription: { status: sub, label: SUBSCRIPTION_LABEL[sub] },
    },
    performance: {
      gps: {
        value: gpsValue,
        grade: gpsValue === null ? null : gradeAtGps(gpsValue),
        band: perf.gps.band,
        entries: perf.gps.entries,
      },
      risk: null,
      practice: {
        // BR-M27-18: a school without completed sessions is "no data", never 0 %.
        accuracy: practice.sessions === 0 ? null : practice.accuracy,
        sessions: practice.sessions,
        questions: practice.answered,
      },
      levels: perf.levels.map((l) => ({
        code: l.code,
        name: l.code === 't4' ? 'Tingkatan 4' : 'Tingkatan 5',
        accuracy: l.accuracy,
      })),
      distribution: perf.distribution.map((d) => ({ grade: d.grade, count: d.count, pct: d.pct })),
      total: perf.distribution.reduce((sum, d) => sum + d.count, 0),
    },
  }
}

export const dashboardRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/admin-sekolah/dashboard',
    [requireRole('school_admin'), refuseSchoollessAdmin],
    (req, ctx) => {
      const session = req.session
      if (!session) throw new Error('a guard must run first')
      // Guarded above: the session user has a school. Nothing else in the request is read (FR-M27-09).
      const schoolId = users.get(session.userId)?.schoolId as number
      return ok(buildSchoolDashboard({ id: session.userId, schoolId }, ctx.clock.now()))
    },
  ),
]
