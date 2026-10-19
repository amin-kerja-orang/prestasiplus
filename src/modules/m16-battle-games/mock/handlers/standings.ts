/**
 * SRS M16 v1.6 §7 #18-#21: the student ranking (S2), the school ranking (S3), the school detail (S4)
 * and the battle history (S5). Logged in (U). All figures are computed from the battle records
 * (BR-M16-12/13/14); the stored Ketepatan / Skor of the 8 observed school rows are DC-M16-03.
 */

import { int, notFound, ok, queryString, requireAuth, route, type RouteDef } from '@/mock/define'
import { schools } from '@/modules/m02-users-schools/mock'

import {
  battleStandingsRepo,
  battlesRepo,
  isPeriod,
  type SchoolStanding,
  type StandingPeriod,
} from '../repository'
import { viewerOf } from './common'

const box = (r: SchoolStanding | null) =>
  r === null
    ? null
    : {
        rank: r.rank,
        battles: r.battles,
        menang: r.menang,
        seri: r.seri,
        kalah: r.kalah,
        skor: r.skor,
      }

export const standingsRoutes: RouteDef[] = [
  // #18: weekly (default) or monthly; anything else is weekly.
  route('GET', '/api/battle/standings/students', [requireAuth()], (req) => {
    const p = queryString(req.query, 'period')
    const period: StandingPeriod = p === 'monthly' ? 'monthly' : 'weekly'
    return ok(
      battleStandingsRepo.students(period).map(({ schoolId: _school, ...row }) => {
        void _school
        return row
      }),
    )
  }),

  // #19: default weekly; an unknown period is all time with no active pill (BR-M16-13).
  route('GET', '/api/battle/standings/schools', [requireAuth()], (req) => {
    const p = queryString(req.query, 'period')
    const period: StandingPeriod = p === undefined ? 'weekly' : isPeriod(p) ? p : 'all_time'
    const state = queryString(req.query, 'state')
    const national = battleStandingsRepo.schools(period)
    const rows = state ? national.filter((r) => r.state === state) : national
    return ok({
      activePeriod: p === undefined || isPeriod(p) ? period : null,
      rows,
      podium: national.slice(0, 3).map((r) => ({
        column: r.rank,
        schoolId: r.schoolId,
        name: r.name,
        state: r.state,
        skor: r.skor,
      })),
    })
  }),

  // #20
  route(
    'GET',
    '/api/battle/schools/:id',
    [requireAuth()],
    (req) => {
      const id = req.params.id as number
      const school = schools.get(id)
      if (!school) return notFound('Sekolah tidak dijumpai.')
      const all = battleStandingsRepo.school(id, 'all_time')
      const fighters = battleStandingsRepo
        .students('weekly')
        .filter((s) => s.schoolId === id)
        .slice(0, 5)
        .map((s) => ({ userId: s.userId, name: s.name, skor: s.skor }))
      return ok({
        school: {
          id: school.id,
          name: school.name,
          ppd: school.district,
          state: school.state,
          type: school.type,
        },
        allTime: {
          battles: all?.battles ?? 0,
          menang: all?.menang ?? 0,
          ketepatan: all?.ketepatan ?? 0,
          pelajar: all?.pelajar ?? 0,
        },
        week: box(battleStandingsRepo.school(id, 'weekly')),
        month: box(battleStandingsRepo.school(id, 'monthly')),
        fighters,
        recent: battlesRepo.recentForSchool(id, 10),
      })
    },
    { params: { id: int() } },
  ),

  // #21
  route('GET', '/api/battle/history', [requireAuth()], (req) =>
    ok(battlesRepo.historyFor(viewerOf(req).id)),
  ),
]
