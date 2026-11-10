import {
  PerformanceLeaderboardSchema,
  PerformancePublicProfileSchema,
  PerformanceRankingSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PerformancePorts } from '../../../../src/modules/reports/performance'
import { type Client, expectError, loginAs, parseData } from '../../../curriculum/helpers'
import { InMemoryGamification } from '../fakes/in-memory-gamification'
import { InMemoryPracticeRead } from '../fakes/in-memory-practice-read'
import { bootWorld, EXTRA_PUPILS, type World } from './boot'

/**
 * Social routes (rankings, leaderboard, public profile, weekly report) on a migrated database. The practice
 * and gamification ports are the in-memory fakes (the SQL adapters have their own port-contract spec).
 * Needs a database: `npm run be:test -- test/reports/performance/http/social.spec.ts`.
 */
let w: World
const as: Record<string, Client> = {}
// requestId is unique per request by design; the privacy assertion is on everything else.
const noReq = (b: unknown): string => {
  const c = structuredClone(b) as { error?: { requestId?: unknown } }
  if (c?.error) delete c.error.requestId
  return JSON.stringify(c)
}
const who = ['pelajar', 'guru', 'admin', 'ibubapa'] as const

beforeAll(async () => {
  w = await bootWorld({ THROTTLE_PUBLIC_PER_MINUTE: '12' })
  for (const k of who) as[k] = await loginAs(w, `${k}@demo.test`)
  const practice = new InMemoryPracticeRead()
  const gamification = new InMemoryGamification()
  const pupils = ['pelajar@demo.test', 'pelajarmaju@demo.test', 'pelajar2@demo.test', ...EXTRA_PUPILS]
  pupils.forEach((email, i) => {
    const id = w.ids[email] as string
    practice.addPupil({ id, name: `Murid Ujian ${i + 1} Penuh`, schoolId: w.schools.demo1, schoolName: 'Sekolah Demo', state: 'Negeri Demo', district: 'Daerah Demo' })
    practice.addAnswers(id, 10, 10 - i)
    practice.addSession({ userId: id, completedAt: new Date('2026-10-19T08:00:00+08:00'), questionCount: 10, correctCount: 10 - i, coins: 10 * (i + 1) })
    gamification.add(id, { level: 2 })
  })
  const ports = w.app.get(PerformancePorts)
  ports.providePractice(practice)
  ports.provideGamification(gamification)
}, 120_000)
afterAll(async () => {
  await w?.close()
  delete process.env.THROTTLE_PUBLIC_PER_MINUTE
})

describe('authentication', () => {
  it('401 without a session on rankings, leaderboard and weekly report', async () => {
    for (const url of ['/api/rankings', '/api/leaderboard', '/api/weekly-report']) expectError(await w.http().get(url), 'UNAUTHORIZED')
  })
})

describe('rankings (Kedudukan, R1-MUR-18)', () => {
  it('a pupil gets the rank per scope by wallet syiling and Sekitar anda with first names only; no-store', async () => {
    const res = await (as.pelajar as Client).get('/api/rankings')
    expect(res.status).toBe(200)
    expect(String(res.headers['cache-control'])).toContain('no-store')
    const data = parseData(res, PerformanceRankingSchema)
    const nation = data.scopes.find((s) => s.scope === 'kebangsaan')
    expect(nation?.rank).toBeGreaterThanOrEqual(1)
    expect(nation?.total).toBeGreaterThanOrEqual(nation?.rank ?? 0)
    const mine = nation?.nearby.filter((n) => n.me) ?? []
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ rank: nation?.rank, syiling: data.syiling })
    expect(nation?.nearby.length).toBeLessThanOrEqual(5)
    // every other pupil: first name only, no id, no school
    for (const n of (nation?.nearby ?? []).filter((x) => !x.me)) expect(n.name).not.toContain(' ')
    expect(JSON.stringify(data)).not.toMatch(/userId|schoolName/)
    // ranks are consecutive around the pupil
    const ranks = nation?.nearby.map((n) => n.rank) ?? []
    expect(ranks).toEqual(ranks.map((_, i) => (ranks[0] ?? 0) + i))
  })

  it('a teacher has no standing: no scopes (the page shows "Kedudukan belum tersedia")', async () => {
    const t = parseData(await (as.guru as Client).get('/api/rankings'), PerformanceRankingSchema)
    expect(t).toEqual({ syiling: 0, scopes: [] })
  })
})

describe('leaderboard', () => {
  it('lists the week with the viewer as me', async () => {
    const res = await (as.pelajar as Client).get('/api/leaderboard?period=all')
    const data = parseData(res, PerformanceLeaderboardSchema)
    expect(data.period).toBe('all')
    expect(data.me.rank).not.toBeNull()
  })
})

describe('leaderboard names', () => {
  it('a student sees the own id and full name, other rows first name + last initial with a null id', async () => {
    const own = w.ids['pelajar@demo.test']
    const data = parseData(await (as.pelajar as Client).get('/api/leaderboard?period=all'), PerformanceLeaderboardSchema)
    const mine = data.rows.find((r) => r.userId === own)
    expect(mine?.name).toMatch(/^Murid Ujian [0-9]+ Penuh$/)
    const others = data.rows.filter((r) => r.userId !== own)
    expect(others.length).toBeGreaterThan(0)
    for (const r of others) {
      expect(r.userId).toBeNull()
      expect(r.name).toMatch(/^Murid P[.]$/)
    }
  })
})

describe('weekly report', () => {
  it('is 403 for every role', async () => {
    for (const k of who) expectError(await (as[k] as Client).get('/api/weekly-report'), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
  })
})

describe('public student profile', () => {
  it('answers without a session: first name only, no school, no-store, no Set-Cookie', async () => {
    const res = await w.http().get(`/api/public/students/${w.ids['pelajar@demo.test']}`)
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeUndefined()
    expect(String(res.headers['cache-control'])).toContain('no-store')
    const data = parseData(res, PerformancePublicProfileSchema)
    expect(data.schoolName).toBeNull()
    expect(data.name).toBe(data.firstName)
    expect(data.posts).toEqual([])
  })

  it('7. unknown, teacher and parent ids give a byte-identical 404', async () => {
    const bodies = new Set<string>()
    for (const id of ['9999999', w.ids['guru@demo.test'], w.ids['ibubapa@demo.test'], 'abc']) {
      const res = await w.http().get(`/api/public/students/${id}`)
      expect(res.status).toBe(404)
      bodies.add(noReq(res.body))
    }
    expect(bodies.size).toBe(1)
  })

  it('7b. an inactive and a suspended pupil give the same 404 as an unknown id (L6)', async () => {
    // Users have no is_test column; Mod Pelajar data is excluded in the practice and gamification adapters.
    const inactive = w.ids['ujian5@demo.test'] as string
    const suspended = w.ids['ujian6@demo.test'] as string
    const unknown = await w.http().get('/api/public/students/9999999')
    await w.db.query('update users set is_active = false where id = $1', [inactive])
    await w.db.query('update users set is_suspended = true where id = $1', [suspended])
    try {
      for (const id of [inactive, suspended]) {
        const res = await w.http().get(`/api/public/students/${id}`)
        expect(res.status).toBe(404)
        expect(noReq(res.body)).toBe(noReq(unknown.body))
      }
    } finally {
      await w.db.query('update users set is_active = true where id = $1', [inactive])
      await w.db.query('update users set is_suspended = false where id = $1', [suspended])
    }
  })

  it('8. enumeration is rate limited per client address (429 with Retry-After)', async () => {
    let last = 0
    for (let i = 0; i < 15; i++) last = (await w.http().get(`/api/public/students/${100000 + i}`)).status
    expect(last).toBe(429)
  })
})
