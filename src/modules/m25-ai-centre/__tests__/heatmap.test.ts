/**
 * M25-T1 / S10-T05: the heatmap read model (API-DSKP-08), handler #1 and the fixtures, over the
 * real stores of M01-M05 at the project clock. Tests run in order and share one runtime: the fixture
 * tests (last) write answers for Pelajar 2 after the observed-figure checks.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, clock as globalClock, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04, { questions } from '@/modules/m04-question-bank/mock'
import m05, { practice } from '@/modules/m05-practice/mock'

import { bandOf, percentOf, wholePercent } from '../api/settings'
import type { HeatmapChapter, HeatmapResponse, HeatmapSubject } from '../api/types'
import m25, { heatmap } from '../mock'
import { m25Hooks } from '../mock/hooks'

const ADMIN = 1
const PELAJAR2 = 3
const PELAJARMAJU = 4
const GURU = 5
const IBUBAPA = 6

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m25],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  globalClock.setNow(CLOCK_ANCHOR_ISO)
}, 600_000)

interface Answer<T = unknown> {
  status: number
  body: T
  res: TransportResponse
}

async function get<T = unknown>(
  as: number | null,
  url = '/api/buku-nota/heatmap',
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  const res = await runtime.transport.request({ method: 'GET', url, headers })
  return { status: res.status, body: res.body as T, res }
}

import { tileLine } from '../components/heatmap/heatmap-copy'

const tileText = tileLine
const tried = (subject: HeatmapSubject | undefined): HeatmapChapter[] =>
  (subject?.chapters ?? []).filter((c) => c.state !== 'belum-cuba')

describe('rules', () => {
  it('rounds half up and bands the whole number (no minimum, FR-MUR-14-7)', () => {
    expect(percentOf(159, 200)).toBe(80)
    expect(percentOf(79, 100)).toBe(79)
    expect(percentOf(12, 38)).toBe(32)
    expect(percentOf(4, 7)).toBe(57)
    expect(percentOf(0, 0)).toBe(0)
    expect([0, 49, 50, 79, 80, 100].map(bandOf)).toEqual([
      'red',
      'red',
      'amber',
      'amber',
      'green',
      'green',
    ])
  })

  it('shows the whole percent of the wire accuracy, half away from zero (XS-5)', () => {
    expect([49.5, 79.5, 57.1, 62.5, 0.4, 100].map(wholePercent)).toEqual([50, 80, 57, 63, 0, 100])
    expect(wholePercent(null)).toBe(0)
  })
})

describe('admin (id 1)', () => {
  it('lists the practised subjects, Subjek Teras first then name, with every T1-T5 chapter', () => {
    const subjects = heatmap.forUser(ADMIN)
    expect(subjects.map((s) => [s.id, s.code, s.name])).toEqual([
      ['1', 'BM', 'Bahasa Melayu'],
      ['5', 'SEJ', 'Sejarah'],
    ])
    expect(subjects.map((s) => s.chapters.length)).toEqual([58, 28])
  })

  it('has the T4/T5 attempts as tiles, with no minimum, and the rest grey', () => {
    const [bm, sej] = heatmap.forUser(ADMIN)
    expect(
      tried(bm).map((t) => [t.id, t.number, t.attempts, t.correct, t.accuracy, t.state]),
    ).toEqual([
      ['87', 1, 5, 0, 0, 'red'],
      ['413', 99, 38, 12, 31.6, 'red'],
    ])
    expect(tried(sej).map((t) => [t.id, t.attempts, t.correct, t.accuracy, t.state])).toEqual([
      ['382', 40, 14, 35, 'red'],
    ])
    const grey = (bm?.chapters ?? []).filter((c) => c.state === 'belum-cuba')
    expect(grey).toHaveLength(56)
    for (const g of grey) {
      expect([g.attempts, g.correct, g.accuracy]).toEqual([0, 0, null])
    }
  })

  it('orders chapters by Bab number (none last), the Darjah chapters are never listed', () => {
    for (const s of heatmap.forUser(ADMIN)) {
      const numbers = s.chapters.map((c) => c.number ?? Number.POSITIVE_INFINITY)
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    }
    const ids = heatmap.forUser(ADMIN).flatMap((s) => s.chapters.map((c) => c.id))
    // 35, 36, 2 (D1) and 4 (D2) carry admin attempts but are Darjah chapters (FR-MUR-14-6).
    for (const darjah of ['35', '36', '2', '4']) expect(ids).not.toContain(darjah)
  })

  it('keeps the other observed admin figures (119 answers, BM 79 / 32, SEJ 40 / 14)', () => {
    const all = practice.answers(ADMIN)
    expect([all.length, all.filter((a) => a.isCorrect).length]).toEqual([119, 46])
    const by = (subjectId: number) => all.filter((a) => a.subjectId === subjectId)
    expect([by(1).length, by(1).filter((a) => a.isCorrect).length]).toEqual([79, 32])
    expect([by(5).length, by(5).filter((a) => a.isCorrect).length]).toEqual([40, 14])
  })

  it('has the Q-M25-HM-ROWS rows (7, grouped by chapter id)', () => {
    const rows = heatmap.rowsForUser(ADMIN)
    expect(rows.length).toBe(7)
    expect(rows.find((r) => r.chapterId === 4)).toEqual({ chapterId: 4, attempts: 2, correct: 1 })
  })
})

describe('pelajarmaju (id 4) and empty users', () => {
  it('lists Matematik (practised on Bab-linked questions) with every T1-T5 chapter grey', () => {
    const subjects = heatmap.forUser(PELAJARMAJU)
    expect(subjects.map((s) => [s.code, s.name])).toEqual([['MATH', 'Matematik']])
    expect(subjects[0]?.chapters).toHaveLength(62)
    expect(tried(subjects[0])).toEqual([])
  })

  it('pelajar2 (id 3) is empty: a subject without a Bab-linked attempt is not listed', () => {
    expect(heatmap.forUser(PELAJAR2)).toEqual([])
  })
})

describe('handler #1', () => {
  it('answers the admin and the student with the read model', async () => {
    const a = await get<{ data: HeatmapResponse }>(ADMIN)
    expect(a.status).toBe(200)
    expect(a.body.data.subjects.map((s) => s.name)).toEqual(['Bahasa Melayu', 'Sejarah'])
    expect(a.body.data.subjects[0]?.chapters[0]).toEqual({
      id: '28',
      number: 1,
      name: expect.any(String),
      attempts: 0,
      correct: 0,
      accuracy: null,
      state: 'belum-cuba',
    })
    const m = await get<{ data: HeatmapResponse }>(PELAJARMAJU)
    expect(m.status).toBe(200)
    expect(m.body.data.subjects.map((s) => s.code)).toEqual(['MATH'])
    const e = await get<{ data: HeatmapResponse }>(PELAJAR2)
    expect(e.status).toBe(200)
    expect(e.body.data).toEqual({ subjects: [] })
  })

  it('ignores any query value (own data only)', async () => {
    const r = await get<{ data: HeatmapResponse }>(PELAJARMAJU, '/api/buku-nota/heatmap?userId=1')
    expect(r.body.data.subjects.length).toBe(1)
  })

  it('answers 401 to a guest and 403 to other roles', async () => {
    expect((await get(null)).status).toBe(401)
    expect((await get(GURU)).status).toBe(403)
    expect((await get(IBUBAPA)).status).toBe(403)
  })
})

describe('fixtures (write answers for Pelajar 2; keep last)', () => {
  it('rejects an unknown fixture', () => {
    expect(() => m25Hooks.loadFixture('nope')).toThrow(RangeError)
  })

  it('m25-bands: bands on the whole percent, tiles in Bab order, grey for the rest', () => {
    expect(m25Hooks.loadFixture('m25-bands')).toBe(330)
    const subjects = heatmap.forUser(PELAJAR2)
    expect(subjects.map((s) => s.name)).toEqual(['Matematik', 'Sains'])
    const flat = subjects.flatMap(tried).map((c) => [c.id, c.attempts, c.accuracy, c.state])
    expect(flat).toEqual([
      ['91', 10, 40, 'red'],
      ['228', 200, 79.5, 'green'], // T5 Bab 1 sorts before T4 Bab 2
      ['92', 10, 50, 'amber'],
      ['220', 100, 79, 'amber'],
      ['322', 10, 80, 'green'],
    ])
    // 159 / 200 = 79.5: the whole percent rounds half up to 80, so the tile is green (FR-MUR-14-7).
    const t228 = subjects[0]?.chapters.find((c) => c.id === '228')
    expect(t228 && tileText(t228)).toBe('200 cuba · 80% betul')
    expect(subjects[0]?.chapters.filter((c) => c.state === 'belum-cuba').length).toBe(
      (subjects[0]?.chapters.length ?? 0) - 4,
    )
  })

  it('shows a chapter with a single attempt (no minimum)', () => {
    const ids = questions.query('Q-CHAPTER', { sort: 'id' }, 323).rows.map((q) => q.id)
    practice.addAnswer(
      { userId: PELAJAR2, questionId: ids[0] as number, isCorrect: false },
      globalClock.now(),
    )
    const sains = heatmap.forUser(PELAJAR2).find((s) => s.name === 'Sains')
    expect(sains?.chapters.find((c) => c.id === '323')).toMatchObject({
      attempts: 1,
      correct: 0,
      accuracy: 0,
      state: 'red',
    })
  })
})
