import { PerformanceAnalyticsSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { PerformancePorts } from '../../../../src/modules/reports/performance/ports'
import { spBandOfPercent } from '../../../../src/modules/reports/performance/domain'
import { AnalyticsService } from '../../../../src/modules/reports/performance/services'
import { ctxOf, world, type World } from '../fakes/fixtures'
import { InMemoryPupilRoster } from '../fakes/in-memory-pupil-roster'
import { spNode } from '../fakes/in-memory-sp-map'

/**
 * Analitik Adaptif of the pupil (S10-T04 part 3, R1-MUR-5, DK rule 4.10) on the fake SP port and the shared answer
 * reader. Proves FR-MUR-5-1/-2/-3/-5/-6 and AC-MUR-5-1/-2/-3, AC-MUR-DK-3 at unit level.
 */
const d = (iso: string) => new Date(iso)
const AT = d('2026-09-22T10:00:00+08:00')

let w: World

/** BM (id 1): strand "Kemahiran Membaca" with SP 1.1.1 / 1.1.2 / 1.1.3, strand "Kemahiran Menulis" with 2.1.1; MT (id 2): one SP. */
const BM_TREE = {
  subjectId: '1',
  subjectCode: 'BM',
  subjectName: 'Bahasa Melayu',
  nodes: [
    spNode('101', '1.1.1', { strand: 'Kemahiran Membaca', sortOrder: 1 }),
    spNode('102', '1.1.2', { strand: 'Kemahiran Membaca', sortOrder: 2 }),
    spNode('103', '1.1.3', { strand: 'Kemahiran Membaca', sortOrder: 3 }),
    spNode('104', '2.1.1', { strand: 'Kemahiran Menulis', sortOrder: 4 }),
  ],
}
const MT_TREE = { subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik', nodes: [spNode('201', '1.1.1', { strand: 'Ubahan', sortOrder: 1 })] }

/** `n` answers of the question `qid` by `userId`, `correct` of them right: one aggregated fact row per (question, mode). */
const answers = (userId: string, qid: string, n: number, correct: number, over: { mode?: string; subjectId?: string; at?: Date } = {}) => {
  for (let i = 0; i < n; i++) {
    w.answers.add({ userId, subjectId: over.subjectId ?? '1', questionId: qid, mode: over.mode ?? 'latih_tubi', isCorrect: i < correct, answeredAt: over.at ?? AT })
  }
}

beforeEach(() => {
  w = world()
  w.directory.addPupil({ id: '1', levelId: '10' }).addPupil({ id: '2', levelId: '10' }).addPupil({ id: '3', levelId: '3', levelSlug: 't1' })
  w.spMap.setTree('10', [BM_TREE, MT_TREE]).tag('qa', '101').tag('qb', '102').tag('qc', '103')
})

const me = (id = '1') => w.analytics.me(ctxOf('student', id))
const tile = (r: Awaited<ReturnType<typeof me>>, subject: string, spId: string) => r.subjects.find((s) => s.code === subject)?.map.tiles.find((t) => t.spId === spId)

describe('SP bands on the whole-number accuracy (FR-MUR-5-3)', () => {
  it.each([
    [100, 'mahir'],
    [75, 'mahir'],
    [74.5, 'mahir'], // rounds half up to 75
    [74.4, 'sederhana'],
    [50, 'sederhana'],
    [49.5, 'sederhana'], // rounds half up to 50
    [49.4, 'lemah'],
    [0, 'lemah'],
  ] as const)('%s%% is %s', (value, band) => {
    expect(spBandOfPercent(value)).toBe(band)
  })
})

describe('AC-MUR-5-1: 3 SPs at 80, 60 and 30 %', () => {
  beforeEach(() => {
    answers('1', 'qa', 10, 8)
    answers('1', 'qb', 10, 6)
    answers('1', 'qc', 10, 3)
  })

  it('tiles are green, yellow, red and the ring reads 1 / {total} SP', async () => {
    const r = await me()
    const bm = r.subjects[0]!
    expect(bm.map.tiles.map((t) => [t.code, t.status])).toEqual([
      ['1.1.1', 'mahir'],
      ['1.1.2', 'sederhana'],
      ['1.1.3', 'lemah'],
      ['2.1.1', 'belum'],
    ])
    expect(bm.counts).toEqual({ mahir: 1, sederhana: 1, lemah: 1, belum: 1 })
    expect(bm.ringTotal).toBe(4)
    expect(bm.accuracy).toBe(56.7)
    expect(bm.answered).toBe(30)
    PerformanceAnalyticsSchema.parse(r)
  })

  it('the Lemah SP is the weak topic; no focus count is invented (S5-T03 owns it)', async () => {
    const r = await me()
    expect(r.subjects[0]!.weak).toEqual([expect.objectContaining({ spId: '103', code: '1.1.3', answered: 10, accuracy: 30, available: 0, focusCount: 0 })])
    expect(r.topWeak.map((x) => x.spId)).toEqual(['103'])
  })

  it('the map is grouped by strand: each tile carries its strand heading and the DSKP order', async () => {
    const tiles = (await me()).subjects[0]!.map.tiles
    expect(tiles.map((t) => t.strand)).toEqual(['Kemahiran Membaca', 'Kemahiran Membaca', 'Kemahiran Membaca', 'Kemahiran Menulis'])
    expect((await me()).subjects[0]!.map.caption).toBe('Peta DSKP — Standard Pembelajaran · Bahasa Melayu')
  })
})

describe('band boundaries per tile', () => {
  it.each([
    [75, 100, 'mahir'],
    [74, 100, 'sederhana'],
    [50, 100, 'sederhana'],
    [49, 100, 'lemah'],
    [3, 4, 'mahir'],
    [1, 2, 'sederhana'],
    [0, 3, 'lemah'],
  ] as const)('%s of %s answers right is %s', async (correct, n, status) => {
    answers('1', 'qa', n, correct)
    expect(tile(await me(), 'BM', '101')?.status).toBe(status)
  })
})

describe('AC-MUR-DK-3: a Bab-only question is not in the Analitik map', () => {
  it('its answers change no tile and no band count, but stay in the subject figures', async () => {
    answers('1', 'qa', 4, 4)
    answers('1', 'q-bab-only', 6, 0) // no SP tag (a question with a Bab and no SP)
    const bm = (await me()).subjects[0]!
    expect(bm.counts).toEqual({ mahir: 1, sederhana: 0, lemah: 0, belum: 3 })
    expect(bm.map.tiles.filter((t) => t.status !== 'belum').map((t) => t.spId)).toEqual(['101'])
    expect(bm.weak).toEqual([])
    expect(bm.answered).toBe(10)
    expect(bm.accuracy).toBe(40)
  })

  it('a Bab-only subject answer alone leaves every tile Belum cuba', async () => {
    answers('1', 'q-bab-only', 5, 5)
    const bm = (await me()).subjects[0]!
    expect(bm.counts).toEqual({ mahir: 0, sederhana: 0, lemah: 0, belum: 4 })
  })

  it('a tag to an SP of another level (not in the pupil map) is ignored', async () => {
    w.spMap.tag('q-other', '999')
    answers('1', 'q-other', 5, 0)
    expect((await me()).subjects[0]!.counts.belum).toBe(4)
  })
})

describe('FR-MUR-5-3: every mode is pooled (one answer store)', () => {
  it('latih tubi, simulasi, battle and a teacher set add up on one SP', async () => {
    answers('1', 'qa', 4, 4, { mode: 'latih_tubi' })
    answers('1', 'qa', 4, 0, { mode: 'simulasi' })
    answers('1', 'qa', 4, 4, { mode: 'battle' })
    answers('1', 'qa', 3, 0, { mode: 'set_soalan_guru' })
    const r = await me()
    expect(tile(r, 'BM', '101')?.status).toBe('sederhana') // 8 / 15 = 53 %
    expect(r.subjects[0]).toMatchObject({ answered: 15, accuracy: 53.3 })
  })

  it('a question tagged to two SPs counts in both', async () => {
    w.spMap.tag('qa', '102')
    answers('1', 'qa', 10, 9)
    const r = await me()
    expect(tile(r, 'BM', '101')?.status).toBe('mahir')
    expect(tile(r, 'BM', '102')?.status).toBe('mahir')
  })

  it('test rows never count (the answer reader has no way to ask for them)', async () => {
    w.answers.add({ userId: '1', subjectId: '1', questionId: 'qa', mode: 'latih_tubi', isCorrect: true, answeredAt: AT, isTest: true })
    expect((await me()).subjects[0]!.answered).toBe(0)
  })
})

describe('FR-MUR-5-1: own data only', () => {
  it("another pupil's answers never reach the figures", async () => {
    answers('1', 'qa', 4, 4)
    answers('2', 'qa', 100, 0)
    const bm = (await me('1')).subjects[0]!
    expect(bm).toMatchObject({ answered: 4, accuracy: 100, counts: { mahir: 1, sederhana: 0, lemah: 0, belum: 3 } })
    const other = (await me('2')).subjects[0]!
    expect(other).toMatchObject({ answered: 100, accuracy: 0, counts: { mahir: 0, sederhana: 0, lemah: 1, belum: 3 } })
  })
})

describe('FR-MUR-5-2, AC-MUR-5-2, FR-MUR-5-6: a tab for every subject with an SP map', () => {
  it('a pupil with no answers anywhere has a tab per mapped subject, accuracy and projection null, every SP Belum cuba', async () => {
    const r = await me()
    expect(r.subjects.map((s) => s.code)).toEqual(['BM', 'MT'])
    for (const s of r.subjects) {
      expect(s).toMatchObject({ accuracy: null, answered: 0, projection: null, trend: 'stable', weak: [] })
      expect(s.counts.mahir + s.counts.sederhana + s.counts.lemah).toBe(0)
      expect(s.counts.belum).toBe(s.ringTotal)
    }
    expect(r.subjects[0]!.counts.belum).toBe(4)
    expect(r.subjects[1]!.counts.belum).toBe(1)
    expect(r.topWeak).toEqual([])
    PerformanceAnalyticsSchema.parse(r)
  })

  it('a subject practised only in one tab leaves the other tab empty (accuracy null)', async () => {
    answers('1', 'qa', 4, 3)
    const r = await me()
    expect(r.subjects.map((s) => [s.code, s.accuracy])).toEqual([['BM', 75], ['MT', null]])
  })

  it('answers in a subject without an SP map add no tab', async () => {
    answers('1', 'qx', 5, 5, { subjectId: '9' })
    expect((await me()).subjects.map((s) => s.code)).toEqual(['BM', 'MT'])
  })

  it('the tabs follow the curriculum order the port returns', async () => {
    w.spMap.setTree('10', [MT_TREE, BM_TREE])
    expect((await me()).subjects.map((s) => s.code)).toEqual(['MT', 'BM'])
  })
})

describe('AC-MUR-5-3 and FR-MUR-5-5: no SP data is no error', () => {
  it('a pupil of a level with no SP nodes (T1-T3) gets no tabs, no weak topics and the level id', async () => {
    answers('3', 'qa', 5, 1)
    const r = await me('3')
    expect(r).toEqual({ userLevelId: '3', topWeak: [], subjects: [] })
    PerformanceAnalyticsSchema.parse(r)
  })

  it('a T5 pupil whose questions have no SP tags sees the tabs with empty maps', async () => {
    const bare = world()
    bare.directory.addPupil({ id: '1', levelId: '10' })
    bare.spMap.setTree('10', [BM_TREE])
    bare.answers.add({ userId: '1', subjectId: '1', questionId: 'x1', mode: 'latih_tubi', isCorrect: true, answeredAt: AT })
    const r = await bare.analytics.me(ctxOf('student', '1'))
    expect(r.subjects).toHaveLength(1)
    expect(r.subjects[0]!.counts).toEqual({ mahir: 0, sederhana: 0, lemah: 0, belum: 4 })
    expect(r.topWeak).toEqual([])
  })

  it('without the S4/S1 adapter bound the default answers "no SP map" (no tabs, no error)', async () => {
    const ports = new PerformancePorts(undefined, undefined, undefined, undefined, undefined, w.answers)
    const svc = new AnalyticsService(ports, w.directory, w.clock, new InMemoryPupilRoster(w.directory))
    answers('1', 'qa', 3, 3)
    expect(await svc.me(ctxOf('student', '1'))).toEqual({ userLevelId: '10', topWeak: [], subjects: [] })
  })

  it('a pupil with no level gets no tabs', async () => {
    w.directory.addPupil({ id: '4', levelId: null })
    expect((await me('4')).subjects).toEqual([])
  })

  it('the SP port is bound only once', () => {
    const ports = new PerformancePorts()
    expect(() => ports.provideSpMap(w.spMap)).not.toThrow()
    expect(() => ports.provideSpMap(w.spMap)).toThrow()
  })
})

describe('the weakest SPs', () => {
  it('topWeak is the 4 lowest accuracies over all subjects; the subject list is the Lemah ones, lowest first', async () => {
    w.spMap.setTree('10', [
      { ...BM_TREE, nodes: [...BM_TREE.nodes, spNode('105', '2.1.2', { strand: 'Kemahiran Menulis', sortOrder: 5 })] },
      { ...MT_TREE, nodes: [spNode('201', '1.1.1', { sortOrder: 1 }), spNode('202', '1.1.2', { sortOrder: 2 })] },
    ])
    w.spMap.tag('qd', '104').tag('qe', '105').tag('qm1', '201').tag('qm2', '202')
    answers('1', 'qa', 10, 4) // 40
    answers('1', 'qb', 10, 3) // 30
    answers('1', 'qc', 10, 9) // mahir
    answers('1', 'qd', 10, 1) // 10
    answers('1', 'qe', 10, 2) // 20
    answers('1', 'qm1', 10, 0, { subjectId: '2' }) // 0
    answers('1', 'qm2', 10, 8, { subjectId: '2' })
    const r = await me()
    expect(r.topWeak.map((x) => [x.subjectCode, x.code, x.accuracy])).toEqual([
      ['MT', '1.1.1', 0],
      ['BM', '2.1.1', 10],
      ['BM', '2.1.2', 20],
      ['BM', '1.1.2', 30],
    ])
    expect(r.subjects[0]!.weak.map((x) => x.accuracy)).toEqual([10, 20, 30, 40])
  })
})

describe('trend and projection of a subject (pooled answers, 30 days against the 30 before)', () => {
  it('rising accuracy is up; the projection range comes from the whole-subject accuracy', async () => {
    answers('1', 'qa', 10, 9, { at: d('2026-09-20T10:00:00+08:00') })
    answers('1', 'qa', 10, 5, { at: d('2026-08-20T10:00:00+08:00') })
    const bm = (await me()).subjects[0]!
    expect(bm.trend).toBe('up')
    expect(bm.accuracy).toBe(70)
    expect(bm.projection).toEqual({ low: 'B', high: 'A' })
  })

  it('answers in one window only are stable', async () => {
    answers('1', 'qa', 10, 9, { at: d('2026-09-20T10:00:00+08:00') })
    expect((await me()).subjects[0]!.trend).toBe('stable')
  })
})
