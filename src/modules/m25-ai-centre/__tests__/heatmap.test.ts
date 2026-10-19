/**
 * M25-T1: the heatmap read model, handler #1 and the fixtures (SRS M25 v1.2 §6.4, §6.7, §7), over the
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
import m04 from '@/modules/m04-question-bank/mock'
import m05, { practice } from '@/modules/m05-practice/mock'

import { bandOf, percentOf } from '../api/settings'
import type { HeatmapResponse } from '../api/types'
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

const sum = (xs: { attempts: number; correct: number }[]) => ({
  attempts: xs.reduce((n, x) => n + x.attempts, 0),
  correct: xs.reduce((n, x) => n + x.correct, 0),
})

describe('rules', () => {
  it('rounds half up and bands the whole number', () => {
    expect(percentOf(159, 200)).toBe(80)
    expect(percentOf(79, 100)).toBe(79)
    expect(percentOf(12, 38)).toBe(32)
    expect(percentOf(0, 0)).toBe(0)
    expect([49, 50, 79, 80].map(bandOf)).toEqual(['red', 'amber', 'amber', 'green'])
  })
})

describe('admin (id 1), SRS §6.7 A', () => {
  it('has the six observed cells in the observed order', () => {
    const subjects = heatmap.forUser(ADMIN)
    expect(subjects.map((s) => [s.subjectId, s.name])).toEqual([
      [1, 'Bahasa Melayu'],
      [5, 'Sejarah'],
    ])
    const flat = subjects.flatMap((s) =>
      s.topics.map((t) => [t.chapterId, t.attempts, t.correct, t.percent, t.band]),
    )
    expect(flat).toEqual([
      [87, 5, 0, 0, 'red'],
      [413, 38, 12, 32, 'red'],
      [35, 18, 8, 44, 'red'],
      [36, 5, 3, 60, 'amber'],
      [2, 10, 8, 80, 'green'],
      [382, 40, 14, 35, 'red'],
    ])
    expect(subjects[0]?.topics.map((t) => t.name)).toEqual([
      'Kemahiran Bahasa Tingkatan 4',
      'Kemahiran Bahasa Tingkatan 5',
      'Kemahiran Mendengar dan Bertutur',
      'Kemahiran Membaca',
      'Kemahiran Menulis',
    ])
  })

  it('shows 116 attempts / 45 correct and hides 3 / 1', () => {
    const topics = heatmap.forUser(ADMIN).flatMap((s) => s.topics)
    expect(sum(topics)).toEqual({ attempts: 116, correct: 45 })
    expect(heatmap.hiddenForUser(ADMIN)).toEqual({ answers: 3, correct: 1 })
    const all = practice.answers(ADMIN)
    expect(all.length).toBe(119)
    expect(all.filter((a) => a.isCorrect).length).toBe(46)
  })

  it('keeps the other observed admin figures (BM 79 / 32, SEJ 40 / 14)', () => {
    const all = practice.answers(ADMIN)
    const by = (subjectId: number) => all.filter((a) => a.subjectId === subjectId)
    expect([by(1).length, by(1).filter((a) => a.isCorrect).length]).toEqual([79, 32])
    expect([by(5).length, by(5).filter((a) => a.isCorrect).length]).toEqual([40, 14])
  })

  it('has the Q-M25-HM-ROWS rows (7, the D2 chapter below the minimum)', () => {
    const rows = heatmap.rowsForUser(ADMIN)
    expect(rows.length).toBe(7)
    expect(rows.find((r) => r.chapterId === 4)).toEqual({ chapterId: 4, attempts: 2, correct: 1 })
  })
})

describe('pelajarmaju (id 4) and empty users', () => {
  it('has 3 Matematik cells, 37 / 26, ordered 43, 57, 83', () => {
    const subjects = heatmap.forUser(PELAJARMAJU)
    expect(subjects.length).toBe(1)
    expect(subjects[0]?.name).toBe('Matematik')
    const topics = subjects[0]?.topics ?? []
    expect(
      topics.map((t) => [t.chapterId, t.name, t.attempts, t.correct, t.percent, t.band]),
    ).toEqual([
      [143, 'Sukatan dan Geometri', 7, 3, 43, 'red'],
      [136, 'Pecahan', 7, 4, 57, 'amber'],
      [1, 'Nombor Bulat hingga 100', 23, 19, 83, 'green'],
    ])
    expect(sum(topics)).toEqual({ attempts: 37, correct: 26 })
    expect(heatmap.hiddenForUser(PELAJARMAJU)).toEqual({ answers: 0, correct: 0 })
  })

  it('pelajar2 (id 3) is empty', () => {
    expect(heatmap.forUser(PELAJAR2)).toEqual([])
    expect(heatmap.hiddenForUser(PELAJAR2)).toEqual({ answers: 0, correct: 0 })
  })
})

describe('handler #1', () => {
  it('answers the admin and the student with the read model', async () => {
    const a = await get<{ data: HeatmapResponse }>(ADMIN)
    expect(a.status).toBe(200)
    expect(a.body.data.subjects.flatMap((s) => s.topics).length).toBe(6)
    const m = await get<{ data: HeatmapResponse }>(PELAJARMAJU)
    expect(m.status).toBe(200)
    expect(m.body.data.subjects[0]?.topics.map((t) => t.percent)).toEqual([43, 57, 83])
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

  it('m25-bands: bands and order by accuracy', () => {
    expect(m25Hooks.loadFixture('m25-bands')).toBe(330)
    const topics = heatmap.forUser(PELAJAR2).flatMap((s) => s.topics)
    expect(topics.map((t) => [t.chapterId, t.attempts, t.percent, t.band])).toEqual([
      [12, 10, 40, 'red'],
      [13, 10, 50, 'amber'],
      [14, 100, 79, 'amber'],
      [15, 200, 80, 'green'],
      [16, 10, 80, 'green'],
    ])
    expect(heatmap.hiddenForUser(PELAJAR2)).toEqual({ answers: 0, correct: 0 })
  })
})
