/**
 * M06-T1 endpoints #1-#7 (S1-S6, S8), the pool cells, the Tracking A sets and the M05 seam (SRS M06
 * v1.4 §6.10, §7) over the real owners.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { listDisplayConstants } from '@/mock/dataset'
import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'

import type {
  DatabankSubject,
  LatihTubiConfig,
  LatihTubiList,
  SpmOverview,
  SubjektifOverview,
  TrackingAHub,
  TrackingASubject,
} from '../../api/types'
import { spm } from '../../mock'
import { POOL_ALLOCATION, SUBJECT_ID } from '../../mock/data/config'
import { poolCells } from '../../mock/seeds/seed'
import { ADMIN, GURU, MemoryStorage, PELAJAR, PELAJAR2, bootM06, call, dataOf } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = await bootM06()
}, 300_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const get = <T>(as: number | null, url: string) => dataOf<T>(runtime, as, 'GET', url)

describe('SPM pool cells (M04 dataset, SRS §6.10)', () => {
  it('every contributed cell holds its count and the pool stays at 21,033', () => {
    expect(questions.count('Q-SPM-POOL')).toBe(21_033)
    for (const [code, [t4, t5]] of Object.entries(POOL_ALLOCATION)) {
      const s = SUBJECT_ID[code] as number
      expect(questions.count('Q-SPM-POOL', s), code).toBe(
        [...t4, ...t5].reduce((a, b) => a + b, 0),
      )
      for (const [level, byD] of [
        [10, t4],
        [11, t5],
      ] as const) {
        byD.forEach((n, i) => {
          expect(questions.count('Q-SPM-POOL', s, level, i + 1), `${code} ${String(level)}/${String(i + 1)}`).toBe(n)
        })
      }
    }
  })

  it('declares the hub figures as documented display constants (DV-M06-01)', () => {
    const m06 = listDisplayConstants().filter((c) => c.module === 'M06')
    expect(m06.map((c) => [c.name, c.value, c.dv])).toEqual([
      ['hubPoolChip', 14673, 'DV-M06-01'],
      ['hubTotalQuestions', 20529, 'DV-M06-01'],
    ])
  })
})

describe('guards', () => {
  it.each([
    '/api/spm/overview',
    '/api/spm/databank',
    '/api/spm/latih-tubi',
    '/api/spm/latih-tubi/MATH',
    '/api/spm/tracking-a',
    '/api/spm/tracking-a/GEO',
    '/api/spm/subjektif',
    '/api/spm-mocks',
    '/api/duta/recommendations',
  ])('%s answers 401 without a session', async (url) => {
    const r = await call<{ error: { code: string } }>(runtime, null, 'GET', url)
    expect(r.status).toBe(401)
    expect(r.body.error.code).toBe('UNAUTHORIZED')
  })
})

describe('#1 overview (S1)', () => {
  it('admin: constants, derived stats and the 4 sessions 21.8% / 26 / 84', async () => {
    const o = await get<SpmOverview>(ADMIN, '/api/spm/overview')
    expect(o.stats).toEqual({
      totalQuestions: 20_529,
      subjectCount: 25,
      yearsAvailable: 0,
      trackingAQuestions: 1_769,
    })
    expect(o.modules).toEqual({
      databank: 14_673,
      latihTubi: 14_673,
      trackingA: 1_769,
      subjektifSets: 4_059,
    })
    expect(o.me).toEqual({ sessions: 4, avgAccuracy: 21.8, coins: 26, answered: 84 })
    // Never a chip above the total (E2E-M06-03).
    expect(o.modules.databank).toBeLessThanOrEqual(o.stats.totalQuestions)
  })

  it('student: 4 / 65.4% / 70 / 94; pelajar2 has no activity', async () => {
    expect((await get<SpmOverview>(PELAJAR, '/api/spm/overview')).me).toEqual({
      sessions: 4,
      avgAccuracy: 65.4,
      coins: 70,
      answered: 94,
    })
    expect((await get<SpmOverview>(PELAJAR2, '/api/spm/overview')).me).toEqual({
      sessions: 0,
      avgAccuracy: 0,
      coins: 0,
      answered: 0,
    })
  })
})

describe('#2 databank (S2) and #3 latih tubi (S3)', () => {
  it('lists the 18 subjects in the S2 order with the observed counts', async () => {
    const rows = await get<DatabankSubject[]>(PELAJAR, '/api/spm/databank')
    expect(rows.map((r) => r.code)).toEqual([
      'BM', 'BI', 'MATH', 'SCI', 'SEJ', 'BIO', 'EKON', 'PHY', 'GEO', 'CHEM',
      'ADDMATH', 'PI', 'PM', 'PSV', 'PSI', 'PERNIAGA', 'AKAUN', 'TI',
    ])
    expect(rows.map((r) => r.databankCount)).toEqual([
      514, 1114, 1681, 2076, 1539, 1999, 1986, 1261, 1228, 1009, 501, 483, 1353, 545, 510, 934,
      1770, 530,
    ])
    expect(rows[0]).toMatchObject({ name: 'Bahasa Melayu', nameEn: 'Malay Language' })
  })

  it('S3: Teras 7, Elektif 12 in order; counts equal S2; Bahasa Arab is locked 0/40', async () => {
    const l = await get<LatihTubiList>(PELAJAR, '/api/spm/latih-tubi')
    expect(l.teras.map((c) => c.code)).toEqual(['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM'])
    expect(l.elektif.map((c) => c.code)).toEqual([
      'GEO', 'BIO', 'CHEM', 'PHY', 'PERNIAGA', 'AKAUN', 'EKON', 'ADDMATH', 'PSV', 'BA', 'TI', 'PSI',
    ])
    const db = new Map(
      (await get<DatabankSubject[]>(PELAJAR, '/api/spm/databank')).map((r) => [r.code, r.databankCount]),
    )
    for (const c of [...l.teras, ...l.elektif]) {
      if (c.code !== 'BA') expect(c.total, c.code).toBe(db.get(c.code))
    }
    const ba = l.elektif.find((c) => c.code === 'BA')
    expect(ba).toMatchObject({ total: 0, targetType: 'latihan', targetSize: 40, locked: true })
    expect(l.teras.concat(l.elektif).filter((c) => c.locked).map((c) => c.code)).toEqual(['BA'])
    expect(l.teras[0]).toMatchObject({ targetType: 'custom', targetSize: 34 })
    expect(l.elektif.find((c) => c.code === 'PERNIAGA')).toMatchObject({
      targetType: null,
      targetSize: null,
    })
  })
})

describe('#4 latih tubi config (S4)', () => {
  it('MATH: level and difficulty counts of the pool, target option 40', async () => {
    const c = await get<LatihTubiConfig>(PELAJAR, '/api/spm/latih-tubi/MATH')
    expect(c.total).toBe(1681)
    expect(c.levelCounts).toEqual({ '10': 976, '11': 705 })
    expect(c.difficultyStats).toEqual({ '1': 505, '2': 514, '3': 577, '4': 85, '5': 0 })
    expect(c.difficultyByLevel['10']).toEqual({ '1': 199, '2': 309, '3': 410, '4': 58, '5': 0 })
    expect(c.difficultyByLevel['11']).toEqual({ '1': 306, '2': 205, '3': 167, '4': 27, '5': 0 })
    expect(c.countOptions).toEqual([{ value: 40, label: '40 (Target SPM)', isTarget: true }])
    expect(c.defaultCount).toBe(40)
  })

  it('BM custom 34, ADDMATH latihan 20, PERNIAGA free counts default 10', async () => {
    expect((await get<LatihTubiConfig>(PELAJAR, '/api/spm/latih-tubi/BM')).countOptions[0]?.label).toBe(
      '34 (Target Custom)',
    )
    expect((await get<LatihTubiConfig>(PELAJAR, '/api/spm/latih-tubi/ADDMATH')).defaultCount).toBe(20)
    const p = await get<LatihTubiConfig>(PELAJAR, '/api/spm/latih-tubi/PERNIAGA')
    expect(p.countOptions.map((o) => o.value)).toEqual([5, 10, 20, 30, 40, 50, 60])
    expect(p.defaultCount).toBe(10)
    expect(p.total).toBe(934)
  })

  it('BA stays reachable with 0; unknown codes and non-SPM subjects are 404', async () => {
    expect((await get<LatihTubiConfig>(PELAJAR, '/api/spm/latih-tubi/BA')).total).toBe(0)
    expect((await call(runtime, PELAJAR, 'GET', '/api/spm/latih-tubi/NOPE')).status).toBe(404)
    expect((await call(runtime, PELAJAR, 'GET', '/api/spm/latih-tubi/SK')).status).toBe(404)
  })
})

describe('#5 / #6 Tracking A (S5, S6)', () => {
  it('student: lanes 3 / 18 / 747, three open subjects, no readiness card', async () => {
    const h = await get<TrackingAHub>(PELAJAR, '/api/spm/tracking-a')
    expect(h.readiness).toBeNull()
    expect(h.objectiveLane).toEqual({ subjects: 3, sets: 18, questions: 747 })
    expect(h.bahasaLane).toEqual({ subjects: 2, sets: 559 + 773 })
    expect(h.bahasa.map((b) => [b.code, b.sets])).toEqual([
      ['BM', 559],
      ['BI', 773],
    ])
    expect(h.openSubjects.map((c) => c.code)).toEqual(['GEO', 'AKAUN', 'PSI'])
    expect(h.openSubjects[0]).toMatchObject({
      readyQuestions: 40,
      bankBesarSets: 1,
      bersihSets: 0,
      bankSource: 67,
      startableSets: 1,
      targetType: 'spm',
      targetSize: 40,
    })
    expect(h.openSubjects[1]).toMatchObject({
      readyQuestions: 640,
      bankBesarSets: 0,
      bersihSets: 16,
      bankSource: null,
      targetType: null,
      startableSets: 16,
    })
    expect(h.openSubjects[2]).toMatchObject({ readyQuestions: 40, bersihSets: 1, startableSets: 1 })
  })

  it('admin: readiness tiles in BR-M06-11 order with the observed 10% and 17%', async () => {
    const h = await get<TrackingAHub>(ADMIN, '/api/spm/tracking-a')
    const r = h.readiness
    expect(r?.tiles.map((t) => t.code)).toEqual([
      'BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM', 'ADDMATH', 'PHY', 'CHEM', 'BIO', 'GEO', 'BA', 'EKON', 'PSI',
    ])
    const tile = (c: string) => r?.tiles.find((t) => t.code === c)
    expect(tile('BM')).toMatchObject({ bersih: 0, bankBesar: 0, locked: 1, total: 1, readiness: 0 })
    expect(tile('BM')?.lockedSets).toEqual([{ setNo: 1, readyCount: 9, target: 34 }])
    expect(tile('BI')).toMatchObject({ total: 0, readiness: 0, lockedSets: [] })
    expect(tile('GEO')).toMatchObject({
      bersih: 0,
      bankBesar: 1,
      locked: 9,
      total: 10,
      readiness: 10,
      hasBankBesar: true,
    })
    expect(tile('GEO')?.lockedSets).toHaveLength(6)
    expect(tile('PSI')).toMatchObject({ bersih: 1, locked: 5, total: 6, readiness: 17 })
    expect(r?.summary).toEqual({
      bersih: 1,
      bankBesar: 1,
      locked: r?.tiles.reduce((a, t) => a + t.locked, 0),
    })
    // Not for a teacher either (BR-M06-30).
    expect((await get<TrackingAHub>(GURU, '/api/spm/tracking-a')).readiness).toBeNull()
  })

  it('S6 GEO: startable first, then locked by set number; chips', async () => {
    const s = await get<TrackingASubject>(PELAJAR, '/api/spm/tracking-a/GEO')
    expect(s.summary).toEqual({ bersih: 0, bankBesar: 1, readyQuestions: 309, belumCukup: 9 })
    expect(s.sets.map((x) => x.setNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(s.sets[0]).toEqual({
      setNo: 1,
      status: 'bank_besar',
      readyCount: 40,
      bankSource: 67,
      dskpTagged: 67,
      dskpTotal: 67,
    })
    expect(s.sets[8]).toMatchObject({ setNo: 9, status: 'belum_cukup', readyCount: 20 })
    expect(s.targetType).toBe('spm')
  })

  it('S6 PSI puts set 4 (40) first; MATH has 11 locked sets; PERNIAGA is empty', async () => {
    const psi = await get<TrackingASubject>(PELAJAR, '/api/spm/tracking-a/PSI')
    expect(psi.sets.map((x) => x.setNo)).toEqual([4, 3, 5, 6, 7, 8])
    expect(psi.sets[0]?.status).toBe('bersih')
    const math = await get<TrackingASubject>(PELAJAR, '/api/spm/tracking-a/MATH')
    expect(math.summary).toMatchObject({ belumCukup: 11, readyQuestions: 362 })
    const empty = await get<TrackingASubject>(PELAJAR, '/api/spm/tracking-a/PERNIAGA')
    expect(empty.sets).toEqual([])
    expect(empty.summary).toEqual({ bersih: 0, bankBesar: 0, readyQuestions: 0, belumCukup: 0 })
  })

  it('BM and BI redirect; unknown code is 404', async () => {
    expect(await get(PELAJAR, '/api/spm/tracking-a/BM')).toEqual({
      redirect: '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa',
    })
    expect(await get(PELAJAR, '/api/spm/tracking-a/BI')).toEqual({
      redirect: '/latihan-berstruktur?subject_id=2&scope=spm&track=bahasa',
    })
    expect((await call(runtime, PELAJAR, 'GET', '/api/spm/tracking-a/XYZ')).status).toBe(404)
  })

  it('the set records: disjoint ids, all eligible pool questions of the subject', () => {
    const akaun = spm.setsOf(21)
    expect(akaun).toHaveLength(16)
    const ids = akaun.flatMap((s) => spm.ramalanQuestions(21, 2026, s.setNo) ?? [])
    expect(ids).toHaveLength(640)
    expect(new Set(ids).size).toBe(640)
    for (const id of ids.slice(0, 40)) {
      expect(questions.getEligible(id)).toMatchObject({ subjectId: 21, spmPool: true })
    }
    expect(spm.setsOf(12)[0]?.eligibleCount).toBe(67)
  })

  it('M05 seam: bersih set in order, bank besar first 40, locked [], unknown null', () => {
    expect(spm.ramalanQuestions(21, 2026, 1)).toHaveLength(40)
    expect(spm.ramalanQuestions(12, 2026, 1)).toHaveLength(40)
    expect(spm.ramalanQuestions(12, 2026, 2)).toEqual([])
    expect(spm.ramalanQuestions(12, 2026, 99)).toBeNull()
    expect(spm.ramalanQuestions(21, 2025, 1)).toBeNull()
  })

  it('M05 #4 starts a ramalan session from the set (BR-M06-14) and refuses a locked one', async () => {
    const ok = await call<{ data: unknown }>(runtime, PELAJAR, 'POST', '/api/practice/sessions', {
      mode: 'ramalan',
      subjectCode: 'AKAUN',
      year: 2026,
      setNo: 2,
    })
    expect(ok.status).toBe(201)
    const locked = await call<{ error: { code: string } }>(runtime, PELAJAR, 'POST', '/api/practice/sessions', {
      mode: 'ramalan',
      subjectCode: 'GEO',
      year: 2026,
      setNo: 2,
    })
    expect(locked.status).toBe(422)
    expect(locked.body.error.code).toBe('SET_NOT_READY')
    const missing = await call(runtime, PELAJAR, 'POST', '/api/practice/sessions', {
      mode: 'ramalan',
      subjectCode: 'GEO',
      year: 2026,
      setNo: 99,
    })
    expect(missing.status).toBe(404)
  })
})

describe('sets follow the M04 store (FR-M06-89, BR-M06-08)', () => {
  it('a deactivated question leaves its set: a clean 40/40 set becomes Belum Cukup, then recovers', async () => {
    const id = (spm.ramalanQuestions(21, 2026, 3) as number[])[0] as number
    const poolBefore = questions.count('Q-SPM-POOL', 21)
    questions.deactivate(id)
    try {
      expect(spm.setsOf(21).find((s) => s.setNo === 3)).toMatchObject({
        status: 'belum_cukup',
        readyCount: 39,
        eligibleCount: 39,
      })
      expect(spm.ramalanQuestions(21, 2026, 3)).toEqual([])
      expect(questions.count('Q-SPM-POOL', 21)).toBe(poolBefore - 1)
      const h = await get<TrackingAHub>(ADMIN, '/api/spm/tracking-a')
      expect(h.openSubjects.find((c) => c.code === 'AKAUN')?.startableSets).toBe(15)
    } finally {
      questions.reactivate(id)
    }
    expect(spm.setsOf(21).find((s) => s.setNo === 3)?.status).toBe('bersih')
  })
})

describe('#7 subjektif (S8)', () => {
  it('student: 2 sets, 2 subjects, best 75%, 2 saved', async () => {
    const s = await get<SubjektifOverview>(PELAJAR, '/api/spm/subjektif')
    expect(s.stats).toEqual({ setsAnswered: 2, subjectsTried: 2, bestScore: 75, bestSetsSaved: 2 })
  })

  it('admin and pelajar2: nothing yet ("Belum Ada")', async () => {
    for (const u of [ADMIN, PELAJAR2]) {
      expect((await get<SubjektifOverview>(u, '/api/spm/subjektif')).stats).toEqual({
        setsAnswered: 0,
        subjectsTried: 0,
        bestScore: null,
        bestSetsSaved: 0,
      })
    }
  })

  it('15 subjects, Teras A-Z then Elektif A-Z, counts sum to 4,059', async () => {
    const s = await get<SubjektifOverview>(ADMIN, '/api/spm/subjektif')
    expect(s.subjects).toHaveLength(15)
    expect(s.subjects.slice(0, 5).map((x) => x.name)).toEqual([
      'Bahasa Inggeris', 'Bahasa Melayu', 'Matematik', 'Sains', 'Sejarah',
    ])
    expect(s.subjects.slice(0, 5).every((x) => x.group === 'teras')).toBe(true)
    const elektif = s.subjects.slice(5).map((x) => x.name)
    expect(elektif).toEqual([...elektif].sort((a, b) => a.localeCompare(b, 'ms')))
    const by = Object.fromEntries(s.subjects.map((x) => [x.subjectId, x.sets]))
    expect(by).toMatchObject({ 2: 773, 1: 559, 3: 298, 4: 204, 5: 328, 11: 217, 22: 42, 9: 246, 12: 21, 10: 232, 8: 256, 23: 763, 21: 76, 17: 22, 25: 22 })
    expect(s.subjects.reduce((a, x) => a + x.sets, 0)).toBe(4_059)
  })
})

describe('contributeCells through the poolCells override (seed phase only)', () => {
  it('a contributed cell moves the S4 counts together; the M04 owner override is not clobbered by default', async () => {
    const cells = poolCells().map((c) =>
      c.facets.subjectId === 3 && c.facets.educationLevelId === 11 && c.facets.difficultyLevel === 4
        ? { ...c, count: 3 }
        : c,
    )
    await runtime.reset({ poolCells: cells })
    try {
      const c = await get<LatihTubiConfig>(PELAJAR, '/api/spm/latih-tubi/MATH')
      expect(c.difficultyByLevel['11']?.['4']).toBe(3)
      expect(c.total).toBe(1681 - 24)
      expect(c.levelCounts['11']).toBe(705 - 24)
    } finally {
      await runtime.reset()
    }
    expect((await get<LatihTubiConfig>(PELAJAR, '/api/spm/latih-tubi/MATH')).total).toBe(1681)
    // M04's override alone still wins when M06 contributes nothing.
    await runtime.reset({ questionStore: { spmPool: { MATH: { 11: { 4: 3 } } } } })
    expect(questions.count('Q-SPM-POOL', 3, 11, 4)).toBe(3)
    await runtime.reset()
  }, 300_000)
})
