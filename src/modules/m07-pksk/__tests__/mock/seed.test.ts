/**
 * M07-T1a seed: the 763 PKSK rows as M04 anchors (SRS M07 v1.7 §6.8), the domains, the packages
 * (provisional, owner M19), the 3 access rows, the attempts and the mastery.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'

import { DOMAIN_LEVEL_TOTALS } from '../../mock/data/domains'
import { INOVASI_IDS, OBSERVED_QUESTIONS } from '../../mock/data/questions'
import { pkskAccess, pkskDomains, pkskPackages, pkskProgress } from '../../mock'
import { bootPksk, MemoryStorage } from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootPksk()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const pksk = (where: object = {}) => questions.countWhere({ pkskDomainId: { ne: null }, ...where })

describe('PKSK anchors in the M04 store', () => {
  it('has 763 contiguous ids 177698-178460, all approved (Q-PKSK)', () => {
    expect(runtime).toBeDefined()
    expect(questions.count('Q-PKSK')).toBe(763)
    expect(pksk({ id: { gte: 177698, lte: 178460 } })).toBe(763)
    expect(pksk({ status: 'approved' })).toBe(763)
    for (let id = 177698; id <= 178460; id += 1) {
      expect(questions.pkskGet(id)?.id, String(id)).toBe(id)
    }
    expect(questions.pkskGet(177697)).toBeNull()
    expect(questions.pkskGet(178461)).toBeNull()
  })

  it('matches the live per-domain x level totals, T1 383 / T4 380, A 160 / B 573 / C 30', () => {
    for (const [d, [t1, t4]] of Object.entries(DOMAIN_LEVEL_TOTALS)) {
      expect(pksk({ pkskDomainId: Number(d), pkskTargetLevel: 'T1' }), `${d} T1`).toBe(t1)
      expect(pksk({ pkskDomainId: Number(d), pkskTargetLevel: 'T4' }), `${d} T4`).toBe(t4)
    }
    expect(questions.count('Q-PKSK', undefined, 'T1')).toBe(383)
    expect(questions.count('Q-PKSK', undefined, 'T4')).toBe(380)
    const inDomains = (ids: number[]) => pksk({ pkskDomainId: ids })
    expect(inDomains([1])).toBe(160)
    expect(inDomains([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])).toBe(573)
    expect(inDomains([15])).toBe(30)
    expect(
      pksk({ pkskDomainId: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], pkskTargetLevel: 'T1' }),
    ).toBe(288)
  })

  it('splits difficulty 253 / 253 / 191 / 66 / 0 (Q-PKSK-DIFFICULTY, M04 v1.11)', () => {
    expect([1, 2, 3, 4, 5].map((d) => pksk({ difficultyLevel: d }))).toEqual([253, 253, 191, 66, 0])
  })

  it('keeps the observed anchors exactly', () => {
    for (const o of OBSERVED_QUESTIONS) {
      const q = questions.pkskGet(o.id)
      expect(q, String(o.id)).not.toBeNull()
      expect(q?.pkskDomainId, `${String(o.id)} domain`).toBe(o.domainId)
      expect(q?.pkskTargetLevel, `${String(o.id)} level`).toBe(o.level)
      expect(q?.questionText, `${String(o.id)} text`).toBe(o.text)
      if (o.difficulty !== undefined) expect(q?.difficultyLevel).toBe(o.difficulty)
      if (o.explanation !== undefined) expect(q?.explanation).toBe(o.explanation)
      if (o.options) expect(q?.pkskOptions).toEqual(o.options)
    }
    expect(questions.pkskGet(178460)).toMatchObject({
      pkskDomainId: 7,
      pkskTargetLevel: 'T4',
      difficultyLevel: 3,
    })
    expect(questions.pkskGet(178359)?.pkskOptions?.[3]).toEqual({
      text: 'Mengucapkan tahniah dan menghormati amalan perayaannya.',
      isCorrect: true,
    })
    expect(questions.pkskGet(178349)).toMatchObject({ questionType: 'essay', pkskOptions: [] })
    expect(questions.pkskGet(177919)).toMatchObject({ difficultyLevel: 2, pkskDomainId: 4 })
    expect(questions.pkskGet(178175)?.difficultyLevel).toBe(3)
    expect(questions.pkskGet(178174)?.difficultyLevel).toBe(2)
  })

  it('has A/B questions with 4 options and exactly one flagged; C without options', () => {
    for (let id = 177698; id <= 178460; id += 1) {
      const q = questions.pkskGet(id)
      if (q?.pkskDomainId === 15) {
        expect(q.pkskOptions, String(id)).toEqual([])
      } else {
        expect(q?.pkskOptions?.length, String(id)).toBe(4)
        expect(q?.pkskOptions?.filter((o) => o.isCorrect).length, String(id)).toBe(1)
      }
    }
  })

  it('has exactly the 13 live "inovasi" texts (BR-M07-06)', () => {
    for (const term of ['inovasi', 'INOVASI', ' inovasi ']) {
      const r = questions.pkskList({ search: term, pageSize: 100 })
      expect(r.total, term).toBe(13)
      expect(r.rows.map((x) => x.id).sort((a, b) => a - b)).toEqual(
        [...INOVASI_IDS].sort((a, b) => a - b),
      )
    }
  })

  it('reproduces the observed list order: page 1 and page 39 (BR-M07-06)', () => {
    const p1 = questions.pkskList({ page: 1 })
    expect(p1.total).toBe(763)
    expect(p1.rows.map((r) => r.id)).toEqual([
      178460,
      ...Array.from({ length: 19 }, (_, i) => 178432 + i),
    ])
    expect(questions.pkskList({ page: 39 }).rows.map((r) => r.id)).toEqual([178174, 177919, 178175])
    // 177919 and 178175 share the oldest createdAt; 178432-178450 share one.
    expect(questions.pkskGet(177919)?.createdAt).toBe(questions.pkskGet(178175)?.createdAt)
    expect(questions.pkskGet(178432)?.createdAt).toBe(questions.pkskGet(178450)?.createdAt)
  })

  it('contains no "inovasi" outside the live records (seed-assigned texts)', () => {
    expect(pksk()).toBe(763)
    expect(questions.pkskList({ search: 'inovasi', pageSize: 1000 }).total).toBe(INOVASI_IDS.length)
  })

  it('filters by level and domain (S3 counts)', () => {
    expect(questions.pkskList({ targetLevel: 'T1', status: 'approved' }).total).toBe(383)
    expect(questions.pkskList({ domainIds: [5], targetLevel: 'T4' }).total).toBe(24)
  })
})

describe('domains, packages, access, progress', () => {
  it('has the 15 live domains in order with the live codes', () => {
    const list = pkskDomains.list()
    expect(list).toHaveLength(15)
    expect(list.map((d) => d.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(list.map((d) => d.bahagian).join('')).toBe('ABBBBBBBBBBBBBC')
    expect(pkskDomains.byCode('PKSK_MATH')).toMatchObject({
      id: 2,
      name: 'Matematik',
      nameEn: 'Mathematics',
      icon: 'fa-calculator',
      color: '#3b82f6',
    })
    expect(pkskDomains.byCode('pksk_math')).toBeUndefined()
    expect(pkskDomains.get(13)).toMatchObject({ code: 'PKSK_INOV', name: 'Inovasi & Pencipta' })
    expect(pkskDomains.ofBahagian('B')).toHaveLength(13)
    expect(pkskDomains.get(15)?.createdAt).toBe('2026-02-07T00:57:33+08:00')
  })

  it('hosts the provisional package fixture for M19', () => {
    expect(pkskPackages.list()).toEqual([
      { id: 1, name: 'PKSK Tingkatan 1 (SBP/MRSM)', level: 'T1' },
      { id: 2, name: 'PKSK Tingkatan 4 (SBP/MRSM)', level: 'T4' },
      { id: 3, name: 'PKSK Kombo (T1 + T4)', level: 'ALL' },
    ])
  })

  it('seeds the 3 live Kombo grants and nothing else', () => {
    const rows = [2, 6, 4].flatMap((u) => pkskAccess.forUser(u))
    expect(
      rows.map((r) => [r.id, r.userId, r.packageId, r.grantedById, r.expiresAt, r.status]),
    ).toEqual([
      [1, 2, 3, null, null, 'active'],
      [2, 6, 3, null, null, 'active'],
      [3, 4, 3, null, null, 'active'],
    ])
    expect(rows.map((r) => r.grantedAt.slice(0, 10))).toEqual([
      '2026-02-28',
      '2026-02-28',
      '2026-04-22',
    ])
    expect(pkskAccess.forUser(3)).toEqual([])
  })

  it('seeds the two T1 attempts of Pelajar Demo and the 7 mastery values', () => {
    const attempts = pkskProgress.attempts(2, 'T1')
    expect(attempts.map((a) => [a.scorePct, a.bahagianBPct, a.grade])).toEqual([
      [64, 67, 'C'],
      [46, 52.4, 'D'],
    ])
    // 0.2 A + 0.7 B + 0.1 C reproduces each score (BR-M07-09).
    for (const a of attempts) {
      expect(0.2 * a.bahagianAPct + 0.7 * a.bahagianBPct + 0.1 * a.bahagianCPct).toBeCloseTo(
        a.scorePct,
        6,
      )
    }
    expect(pkskProgress.attempts(2, 'T4')).toEqual([])
    expect(pkskProgress.attempts(4, 'T1')).toEqual([])
    const expected: Record<number, number> = { 1: 60, 2: 70, 3: 55, 4: 80, 5: 40, 6: 65, 15: 50 }
    for (let d = 1; d <= 15; d += 1) {
      expect(pkskProgress.mastery(2, 'T1', d), String(d)).toBe(expected[d] ?? 0)
    }
    expect(pkskProgress.mastery(2, 'T4', 2)).toBe(0)
  })
})
