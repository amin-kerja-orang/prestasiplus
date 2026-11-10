import { PerformanceRankingSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { ApiError } from '../../../../src/common/errors/api-error'
import { compareCandidates, percentileOf } from '../../../../src/modules/reports/performance/domain/kedudukan'
import { shortName } from '../../../../src/modules/reports/performance/domain'
import { ctxOf } from '../fakes/fixtures'
import { socialWorld, type SocialWorld } from '../fakes/social-world'

/** Kedudukan (R1-MUR-18, API-RPT-13): rank by the current wallet balance, fictitious pupils only. */
let w: SocialWorld
const me = (id: string) => ctxOf('student', id)

/** School s1 in Negeri A: pupils 1..8 (syiling 80, 70, ... 10); class c1 holds 1, 2, 3 and 4. Pupil 20: school s3 in Negeri B. */
beforeEach(() => {
  w = socialWorld()
  const names = ['Aina Binti Hassan', 'Bakar Bin Ismail', 'Chong Wei Ming', 'Devi Nair', 'Emir Danial', 'Farah Lee', 'Gopal Raj', 'Hana Yusof']
  names.forEach((name, i) =>
    w.kedudukan.add({
      userId: String(i + 1),
      name,
      syiling: (8 - i) * 10,
      schoolId: 's1',
      state: 'Negeri A',
      classIds: i < 4 ? ['c1'] : [],
    }),
  )
  w.kedudukan.add({ userId: '20', name: 'Ilham Tan', syiling: 500, schoolId: 's3', state: 'Negeri B' })
})

const scopeOf = (r: Awaited<ReturnType<SocialWorld['ranking']['rankings']>>, s: string) => r.scopes.find((x) => x.scope === s)

describe('Kedudukan: ranks and cards', () => {
  it('one card per applicable scope with rank, total and percentile (round half up) and the own syiling', async () => {
    const r = await w.ranking.rankings(me('3'))
    PerformanceRankingSchema.parse(r)
    expect(r.syiling).toBe(60)
    expect(r.scopes.map((s) => s.scope)).toEqual(['kelas', 'sekolah', 'negeri', 'kebangsaan'])
    expect(scopeOf(r, 'kelas')).toMatchObject({ rank: 3, total: 4, percentile: 75 })
    expect(scopeOf(r, 'sekolah')).toMatchObject({ rank: 3, total: 8, percentile: 38 }) // 37.5 rounds up
    expect(scopeOf(r, 'negeri')).toMatchObject({ rank: 3, total: 8 })
    expect(scopeOf(r, 'kebangsaan')).toMatchObject({ rank: 4, total: 9, percentile: 44 }) // pupil 20 (500) is ahead
  })

  it('no class: no kelas card; no school: no sekolah card and negeri is all null ("Belum tersedia")', async () => {
    expect((await w.ranking.rankings(me('6'))).scopes.map((s) => s.scope)).toEqual(['sekolah', 'negeri', 'kebangsaan'])
    w.kedudukan.add({ userId: '30', name: 'Zulaikha Omar', syiling: 15 })
    const r = await w.ranking.rankings(me('30'))
    expect(r.scopes.map((s) => s.scope)).toEqual(['negeri', 'kebangsaan'])
    expect(scopeOf(r, 'negeri')).toEqual({ scope: 'negeri', rank: null, total: null, percentile: null, nearby: [] })
    expect(scopeOf(r, 'kebangsaan')).toMatchObject({ rank: 9, total: 10 })
  })

  it('a lone pupil is #1 of 1 and the percentile is 100 ("Kumpulan 100% teratas")', async () => {
    const lone = socialWorld()
    lone.kedudukan.add({ userId: '1', name: 'Seorang Murid', syiling: 374, schoolId: 's1', state: 'Negeri A' })
    const r = await lone.ranking.rankings(me('1'))
    expect(scopeOf(r, 'sekolah')).toMatchObject({ rank: 1, total: 1, percentile: 100 })
  })

  it('the last pupil of a school is ranked last with percentile 100', async () => {
    const r = await w.ranking.rankings(me('8'))
    expect(r.syiling).toBe(10)
    expect(scopeOf(r, 'sekolah')).toMatchObject({ rank: 8, total: 8, percentile: 100 })
  })

  it('only a pupil has a standing: other roles and unknown users get no scopes', async () => {
    for (const role of ['teacher', 'school_admin', 'admin', 'ppd_officer', 'parent'] as const)
      expect(await w.ranking.rankings(ctxOf(role, '3'))).toEqual({ syiling: 0, scopes: [] })
    expect(await w.ranking.rankings(me('999'))).toEqual({ syiling: 0, scopes: [] })
  })
})

describe('Kedudukan: Sekitar anda', () => {
  it('up to 2 above, the own row marked me, up to 2 below, ranks consecutive', async () => {
    const s = scopeOf(await w.ranking.rankings(me('4')), 'sekolah')
    expect(s?.nearby.map((n) => [n.rank, n.me, n.syiling])).toEqual([
      [2, false, 70],
      [3, false, 60],
      [4, true, 50],
      [5, false, 40],
      [6, false, 30],
    ])
  })

  it('rank 1 shows the own row and 2 below (3 rows); the last rank shows 2 above and the own row', async () => {
    const top = scopeOf(await w.ranking.rankings(me('1')), 'kelas')
    expect(top?.nearby.map((n) => [n.rank, n.me])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ])
    const last = scopeOf(await w.ranking.rankings(me('8')), 'sekolah')
    expect(last?.nearby.map((n) => [n.rank, n.me])).toEqual([
      [6, false],
      [7, false],
      [8, true],
    ])
  })

  it('other pupils by first name only, no id and no school; the viewer by the stored name', async () => {
    const r = await w.ranking.rankings(me('2'))
    const s = scopeOf(r, 'sekolah')
    expect(s?.nearby.map((n) => n.name)).toEqual(['Aina', 'Bakar Bin Ismail', 'Chong', 'Devi'])
    const wire = JSON.stringify(r)
    expect(wire).not.toContain('Hassan')
    expect(wire).not.toContain('userId')
    expect(wire).not.toContain('schoolName')
  })
})

describe('Kedudukan: order chain (48 GAME-16)', () => {
  const c = (over: Partial<Parameters<typeof compareCandidates>[0]>) => ({ userId: '1', name: 'A', syiling: 10, answered: 0, correct: 0, bestStreak: 0, ...over })

  it('syiling desc, accuracy desc (unrounded, no answers last), streak desc, name asc, id asc', () => {
    expect(compareCandidates(c({ syiling: 11 }), c({}))).toBeLessThan(0)
    expect(compareCandidates(c({ answered: 3, correct: 2 }), c({ answered: 4, correct: 2 }))).toBeLessThan(0)
    expect(compareCandidates(c({ answered: 6, correct: 3 }), c({ answered: 2, correct: 1 }))).toBe(0)
    expect(compareCandidates(c({ answered: 0 }), c({ answered: 1, correct: 0 }))).toBeGreaterThan(0)
    expect(compareCandidates(c({ bestStreak: 5 }), c({ bestStreak: 4 }))).toBeLessThan(0)
    expect(compareCandidates(c({ name: 'Aina' }), c({ name: 'Bakar' }))).toBeLessThan(0)
    expect(compareCandidates(c({ userId: '2' }), c({ userId: '10' }))).toBeLessThan(0)
  })

  it('equal syiling is broken by accuracy, streak, name and id so positions are distinct', async () => {
    const t = socialWorld()
    const base = { syiling: 100, schoolId: 's1', state: 'Negeri A' }
    t.kedudukan
      .add({ userId: '1', name: 'Dina', ...base, answered: 10, correct: 5 })
      .add({ userId: '2', name: 'Cahaya', ...base, answered: 10, correct: 9 })
      .add({ userId: '3', name: 'Bakar', ...base, answered: 10, correct: 5, bestStreak: 4 })
      .add({ userId: '4', name: 'Amir', ...base, answered: 10, correct: 5, bestStreak: 4 })
      .add({ userId: '5', name: 'Amir', ...base, answered: 10, correct: 5, bestStreak: 4 })
      .add({ userId: '6', name: 'Eman', ...base })
    const ranks = await Promise.all(
      ['1', '2', '3', '4', '5', '6'].map(async (id) => [id, scopeOf(await t.ranking.rankings(me(id)), 'sekolah')?.rank] as const),
    )
    expect(Object.fromEntries(ranks)).toEqual({ '2': 1, '4': 2, '5': 3, '3': 4, '1': 5, '6': 6 })
  })

  it('percentile: round half up, at least 1', () => {
    expect(percentileOf(1, 8)).toBe(13) // 12.5
    expect(percentileOf(175, 342)).toBe(51)
    expect(percentileOf(406, 864)).toBe(47)
    expect(percentileOf(1, 4806)).toBe(1)
    expect(percentileOf(5, 5)).toBe(100)
  })
})

describe('Pure helpers and the weekly report', () => {
  it('shortName', () => {
    expect(shortName('Aina Binti Hassan')).toBe('Aina H.')
    expect(shortName('Devi')).toBe('Devi')
    expect(shortName('  ')).toBe('')
  })

  it('weekly report (AC6) is 403 for every role', () => {
    expect.assertions(1)
    try {
      w.weekly.report()
    } catch (e) {
      expect((e as ApiError).getStatus()).toBe(403)
    }
  })
})
