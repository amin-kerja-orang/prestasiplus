import { beforeAll, describe, expect, it } from 'vitest'

import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04, { questions } from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m07 from '@/modules/m07-pksk/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m11 from '@/modules/m11-teacher-analytics/mock'
import m14 from '@/modules/m14-gamification/mock'
import m16 from '@/modules/m16-battle-games/mock'
import { bootMock, type MockRuntime } from '@/mock/index'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'

import m17 from '../../mock'
import type { AdminAnalytics, AdminDashboard, AdminLaporan } from '../../api/command-center'
import { ADMIN, ADMIN_SEKOLAH, GURU, PELAJAR, call, data } from '../mock/drill-helpers'

let runtime: MockRuntime
beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m07, m08, m10, m11, m14, m16, m17],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 60_000)

describe('GET /api/admin/dashboard (API-ADM-11)', () => {
  it('returns the AdminDashboard shape, the question counts of the Studio list query', async () => {
    const d = await data<AdminDashboard>(runtime, ADMIN, '/api/admin/dashboard')
    expect(d.questions.total).toBe(questions.adminList({ page: 1, pageSize: 1 }).total)
    expect(d.questions.byStatus.review).toBe(
      questions.adminList({ status: 'pending_review', page: 1, pageSize: 1 }).total,
    )
    const sum = Object.values(d.questions.byStatus).reduce((a, b) => a + b, 0)
    expect(sum).toBeLessThanOrEqual(d.questions.total)
    expect(d.questions.thisWeek).toBeGreaterThanOrEqual(0)
    expect(d.levels).toBe(5)
    expect(d.subjects.active).toBeLessThanOrEqual(d.subjects.total)
    expect(d.users.total).toBeGreaterThanOrEqual(d.users.students + d.users.teachers)
    expect(d.battles.total).toBeGreaterThanOrEqual(d.battles.active + d.battles.finished)
  })
})

describe('GET /api/admin/analytics (API-ADM-12)', () => {
  it('returns the AdminAnalytics shape', async () => {
    const a = await data<AdminAnalytics>(runtime, ADMIN, '/api/admin/analytics?range=7d')
    expect(a.trend).toHaveLength(7)
    expect(a.platform.accuracy).toBeGreaterThanOrEqual(0)
    expect(a.platform.accuracy).toBeLessThanOrEqual(100)
    expect(a.bank.bySubject.length).toBeGreaterThan(0)
    expect(a.bank.byLevel).toHaveLength(5)
    expect(a.topSchools.length).toBeLessThanOrEqual(10)
  })
})

describe('GET /api/admin/reports/laporan (API-ADM-13)', () => {
  it('returns the AdminLaporan shape with a 14-day trend', async () => {
    const l = await data<AdminLaporan>(runtime, ADMIN, '/api/admin/reports/laporan')
    expect(l.trend).toHaveLength(14)
    expect(l.tiles.pupilsAccessed).toBeLessThanOrEqual(l.tiles.pupils)
    expect(l.mostActive.length).toBeLessThanOrEqual(10)
    expect(l.breakdown.every((b) => b.count > 0)).toBe(true)
  })
})

describe('admin only', () => {
  it.each(['/api/admin/dashboard', '/api/admin/analytics', '/api/admin/reports/laporan'])(
    '%s answers 401 to a guest and 403 to other roles',
    async (url) => {
      expect((await call(runtime, null, url)).status).toBe(401)
      for (const id of [PELAJAR, GURU, ADMIN_SEKOLAH]) {
        expect((await call(runtime, id, url)).status, `${url} as ${String(id)}`).toBe(403)
      }
    },
  )
})
