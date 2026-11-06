/**
 * S6-T19: the mock `GET /api/guru/databank/overview` and `/questions` over the real M03 / M04 stores:
 * the tile counts equal the list totals, only Tingkatan 1-5 approved active questions are counted and
 * listed, a search needs 2 characters and the routes are teacher only.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import type { DatabankOverview, DatabankQuestionsResult } from '../../api/types'
import { bootM10 } from './helpers'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5

let runtime: MockRuntime

beforeAll(async () => {
  ;({ runtime } = await bootM10())
}, 240_000)

async function get<T>(url: string, as: number | null = GURU): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  const res = await runtime.transport.request({ method: 'GET', url, headers })
  return { status: res.status, body: res.body as T }
}

describe('GET /api/guru/databank/overview', () => {
  it('lists Teras then Elektif tiles; the stat cards are computed from the tiles', async () => {
    const { status, body } = await get<DatabankOverview>('/api/guru/databank/overview')
    expect(status).toBe(200)
    const { teras, elektif, totalQuestions, activeSubjects } = body.data
    expect(teras.map((x) => x.nameMs).slice(0, 3)).toEqual([
      'Bahasa Melayu',
      'Bahasa Inggeris',
      'Matematik',
    ])
    expect(teras.every((x) => curriculum.subject(x.subjectId)?.isCore)).toBe(true)
    expect(elektif.every((x) => !curriculum.subject(x.subjectId)?.isCore)).toBe(true)
    const all = [...teras, ...elektif]
    expect(totalQuestions).toBe(all.reduce((n, x) => n + x.count, 0))
    expect(activeSubjects).toBe(all.filter((x) => x.count > 0).length)
    expect(teras[0]).toEqual({
      subjectId: 1,
      nameMs: 'Bahasa Melayu',
      nameEn: 'Malay Language',
      count: expect.any(Number),
    })
  })

  it('a tile count equals the servable questions of its subject in Tingkatan 1-5', async () => {
    const { body } = await get<DatabankOverview>('/api/guru/databank/overview')
    const levels = curriculum
      .levels()
      .filter((l) => l.stage !== 'primary')
      .map((l) => l.id)
    for (const t of [...body.data.teras, ...body.data.elektif].slice(0, 6)) {
      expect(t.count).toBe(
        questions.countWhere({
          status: 'approved',
          isActive: true,
          subjectId: t.subjectId,
          educationLevelId: levels,
        }),
      )
    }
  })
})

describe('GET /api/guru/databank/questions', () => {
  it('a subject list has 20 units and its total equals the tile count', async () => {
    const { body: o } = await get<DatabankOverview>('/api/guru/databank/overview')
    const tile = o.data.teras[0]!
    const { status, body } = await get<DatabankQuestionsResult>(
      `/api/guru/databank/questions?subjectId=${String(tile.subjectId)}`,
    )
    expect(status).toBe(200)
    expect(body.data).toHaveLength(20)
    expect(body.meta).toMatchObject({ page: 1, pageSize: 20, totalUnits: tile.count, totalItems: tile.count })
    for (const u of body.data) {
      expect(u.unitId).toMatch(/^q\d+$/)
      expect(u.group).toBeNull()
      expect(u.questions[0]?.subjectId).toBe(tile.subjectId)
      expect(u.questions[0]?.levelLabel).toMatch(/^Tingkatan [1-5]$/)
    }
  })

  it('without a subject the total equals "Jumlah Soalan"; page 2 follows page 1 newest first', async () => {
    const { body: o } = await get<DatabankOverview>('/api/guru/databank/overview')
    const p1 = await get<DatabankQuestionsResult>('/api/guru/databank/questions')
    const p2 = await get<DatabankQuestionsResult>('/api/guru/databank/questions?page=2')
    expect(p1.body.meta.totalUnits).toBe(o.data.totalQuestions)
    const ids = [...p1.body.data, ...p2.body.data].map((u) => u.questions[0]?.id ?? 0)
    expect(new Set(ids).size).toBe(40)
  })

  it('searches the question text (at least 2 characters)', async () => {
    const hit = await get<DatabankQuestionsResult>('/api/guru/databank/questions?q=satelit')
    expect(hit.status).toBe(200)
    expect(hit.body.meta.totalUnits).toBeGreaterThan(0)
    for (const u of hit.body.data) {
      expect(u.questions[0]?.stemMs?.toLowerCase()).toContain('satelit')
    }
    const miss = await get<DatabankQuestionsResult>('/api/guru/databank/questions?q=zzqqxx')
    expect(miss.body.data).toEqual([])
    const short = await get<{ error: { fields?: Record<string, string> } }>(
      '/api/guru/databank/questions?q=x',
    )
    expect(short.status).toBe(422)
    expect(short.body.error.fields?.q).toBe('Taip sekurang-kurangnya 2 aksara.')
  })
})

describe('teacher only', () => {
  for (const url of ['/api/guru/databank/overview', '/api/guru/databank/questions']) {
    it(`${url}: guest 401, pupil 403`, async () => {
      expect((await get(url, null)).status).toBe(401)
      expect((await get(url, PELAJAR)).status).toBe(403)
    })
    it(`${url}: the mock admits the admin like the other teacher tools`, async () => {
      expect((await get(url, ADMIN)).status).toBe(200)
    })
  }
})
