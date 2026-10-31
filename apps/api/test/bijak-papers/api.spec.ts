import {
  BijakBlueprintContractSchema,
  BijakPaperCoverSchema,
  BijakPaperSummarySchema,
  BijakSubjectSchema,
  envelopeOf,
  type BijakPaperCover,
  type BijakPaperSummary,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { BijakProgressSource, PaperProgress } from '../../src/modules/bijak/papers'
import golden from './golden-mock.json'
import { allKeys, bootPapersApp, expectError, loginAs, serveSeededBlueprints, setPocMarkBudgets, type Client, type PapersTestApp } from './helpers'

/** Keys that would reveal an answer key, a scheme or a question (AC 6, US-15). */
const FORBIDDEN_KEYS = [
  'scheme', 'schemes', 'answerKey', 'answer', 'answers', 'accept', 'accepted', 'correct', 'correctOption',
  'reason', 'explanation', 'model', 'points', 'rubric', 'options', 'questionId', 'questionIds', 'pool',
]

const progress = new Map<string, PaperProgress>()
const fakeProgress: BijakProgressSource = { progressFor: async () => progress }

describe('Bijak papers API (BE-15)', () => {
  let t: PapersTestApp
  let student: Client

  beforeAll(async () => {
    t = await bootPapersApp({ progress: fakeProgress })
    student = await loginAs(t, 'pelajar@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const papers = async (): Promise<BijakPaperSummary[]> => {
    const res = await student.get('/api/bijak/papers')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return envelopeOf(z.array(BijakPaperSummarySchema)).parse(res.body).data
  }
  const idOf = async (code: string, kertas: number): Promise<string> => {
    const row = (await papers()).find((p) => p.code === code && p.kertas === kertas)
    if (!row) throw new Error(`paper ${code} not found`)
    return row.id
  }

  describe('GET /api/bijak/papers', () => {
    it('lists the four published PoC papers exactly as the mock serves them (AC 1, golden)', async () => {
      const list = await papers()
      expect(list).toHaveLength(golden.papers.length)
      list.forEach((p, i) => {
        const g = golden.papers[i] as Record<string, unknown>
        expect({ ...p, id: '' }).toEqual({ ...g, id: '' })
      })
    })

    it('derives the total marks from the placements, choose-N counting the largest question (AC 2)', async () => {
      const list = await papers()
      expect(list.map((p) => [p.code, p.questionCount, p.marks])).toEqual([
        ['1449/1', 10, 10],
        ['1449/2', 6, 21],
        ['4541/2', 5, 13],
        ['1249/2', 4, 19],
      ])
      const before = list.find((p) => p.code === '1449/2')
      // No marks column exists: changing a placement override changes the derived total at once.
      await t.db.query(
        `update paper_placements set marks_override = 20 where id = (
           select pl.id from paper_placements pl join paper_sections s on s.id = pl.paper_section_id
           join papers p on p.id = s.paper_id where p.paper_code = '1449/2' and p.kind = 'pilihan' and s.label = 'Bahagian B' limit 1)`,
      )
      const after = (await papers()).find((p) => p.code === '1449/2')
      expect(after?.marks).toBe((before?.marks ?? 0) - 6 + 20)
      await t.db.query(`update paper_placements set marks_override = null where marks_override is not null`)
      expect((await papers()).find((p) => p.code === '1449/2')?.marks).toBe(before?.marks)
    })

    it('lists published curated papers only: a draft, a withdrawn and a generated paper are not listed', async () => {
      await t.db.query(`update papers set status = 'draft' where paper_code = '1249/2'`)
      await t.db.query(`update papers set status = 'withdrawn' where paper_code = '4541/2'`)
      expect((await papers()).map((p) => p.code)).toEqual(['1449/1', '1449/2'])
      await t.db.query(`update papers set status = 'published' where paper_code in ('1249/2', '4541/2')`)
      expect(await papers()).toHaveLength(4)
    })

    it('carries the per-user in-progress and last-score info of the progress source', async () => {
      const id = await idOf('1449/1', 1)
      progress.set(id, { attemptId: '77', lastScore: { score: 6, max: 10 } })
      let row = (await papers()).find((p) => p.id === id)
      expect(row).toMatchObject({ status: 'sedang', attemptId: '77', lastScore: { score: 6, max: 10 } })
      progress.set(id, { lastScore: { score: 8, max: 10 } })
      row = (await papers()).find((p) => p.id === id)
      expect(row).toMatchObject({ status: 'selesai', lastScore: { score: 8, max: 10 } })
      expect(row).not.toHaveProperty('attemptId')
      progress.clear()
      expect((await papers()).every((p) => p.status === 'belum')).toBe(true)
    })

    it('is never cached', async () => {
      const res = await student.get('/api/bijak/papers')
      expect(res.headers['cache-control']).toBe('no-store')
    })
  })

  describe('GET /api/bijak/papers/:id', () => {
    it('reproduces the mock cover of every seeded paper: sections, rules, marks, instructions, reference sheet (AC 1, 7)', async () => {
      for (const g of golden.covers) {
        const id = await idOf(g.code, g.kertas)
        const res = await student.get(`/api/bijak/papers/${id}`)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        const cover: BijakPaperCover = envelopeOf(BijakPaperCoverSchema).parse(res.body).data
        expect({ ...cover, id: '' }).toEqual({ ...g, id: '' })
      }
    })

    it('uses the authored section instruction, else "Jawab semua soalan." or "Jawab {n} daripada {count} soalan." (AC 7)', async () => {
      const id = await idOf('1449/2', 2)
      const cover = envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${id}`)).body).data
      expect(cover.sections.map((s) => s.instruction)).toEqual(['Jawab semua soalan.', 'Jawab semua soalan.', 'Jawab 1 daripada 2 soalan.'])
      // An authored line wins over the derived one; choose-N derives from the placed count.
      await t.db.query(`update paper_sections set instruction = 'Jawab dengan teliti.' where label = 'Bahagian A' and paper_id = $1`, [id])
      await t.db.query(`update paper_sections set instruction = null where label = 'Bahagian C' and paper_id = $1`, [id])
      const again = envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${id}`)).body).data
      expect(again.sections.map((s) => s.instruction)).toEqual(['Jawab dengan teliti.', 'Jawab semua soalan.', 'Jawab 1 daripada 2 soalan.'])
      await t.db.query(`update paper_sections set instruction = null where label = 'Bahagian A' and paper_id = $1`, [id])
    })

    it('404 "Kertas tidak ditemui" for an unknown, malformed, draft or withdrawn paper', async () => {
      for (const id of ['999999999', 'abc', '0', '9'.repeat(30)]) {
        expectError(await student.get(`/api/bijak/papers/${id}`), 'NOT_FOUND', 404, 'Kertas tidak ditemui')
      }
      const id = await idOf('4541/2', 2)
      await t.db.query(`update papers set status = 'draft' where id = $1`, [id])
      expectError(await student.get(`/api/bijak/papers/${id}`), 'NOT_FOUND', 404, 'Kertas tidak ditemui')
      await t.db.query(`update papers set status = 'withdrawn' where id = $1`, [id])
      expectError(await student.get(`/api/bijak/papers/${id}`), 'NOT_FOUND', 404, 'Kertas tidak ditemui')
      await t.db.query(`update papers set status = 'published' where id = $1`, [id])
      expect((await student.get(`/api/bijak/papers/${id}`)).status).toBe(200)
    })
  })

  describe('GET /api/bijak/contracts and /api/bijak/subjects', () => {
    it('lists the blueprints with their sections and take, source tags included (golden)', async () => {
      const res = await student.get('/api/bijak/contracts')
      expect(res.status).toBe(200)
      const data = envelopeOf(z.array(BijakBlueprintContractSchema)).parse(res.body).data
      // The mock golden predates BJS-01 `canGenerate`; for a student it is true only for a serving (Disahkan) version.
      expect(
        data.map((c) => {
          const rest: Record<string, unknown> = { ...c }
          delete rest.canGenerate
          delete rest.unavailableReason
          return rest
        }),
      ).toEqual(golden.contracts)
      for (const c of data) {
        expect(c.canGenerate, c.code).toBe(c.source === 'Disahkan')
        expect(c.unavailableReason, c.code).toBe(c.canGenerate ? undefined : 'NO_BLUEPRINT')
      }
      expect(allKeys(res.body).has('pool')).toBe(false)
    })

    it('lists only active blueprints; a Draf source is listed, a retired or draft version is not', async () => {
      await t.db.query(`update blueprints set source = 'draft' where code = '4541/1'`)
      let data = envelopeOf(z.array(BijakBlueprintContractSchema)).parse((await student.get('/api/bijak/contracts')).body).data
      expect(data.find((c) => c.code === '4541/1')?.source).toBe('Draf')
      await t.db.query(`update blueprints set source = 'spec', status = 'retired' where code = '4541/1'`)
      data = envelopeOf(z.array(BijakBlueprintContractSchema)).parse((await student.get('/api/bijak/contracts')).body).data
      expect(data.map((c) => c.code)).not.toContain('4541/1')
      await t.db.query(`update blueprints set status = 'active' where code = '4541/1'`)
    })

    it('serves the hub subjects with the Bijak codes (MAT, SN, SEJ)', async () => {
      const res = await student.get('/api/bijak/subjects')
      expect(res.status).toBe(200)
      expect(envelopeOf(z.array(BijakSubjectSchema)).parse(res.body).data).toEqual(golden.subjects)
    })
  })

  it('no answer key, scheme, accepted equivalent, explanation or question id in any response of this card (AC 6)', async () => {
    await setPocMarkBudgets(t.db)
    await serveSeededBlueprints(t.db)
    const id = await idOf('1449/2', 2)
    const gen = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 })
    expect(gen.status).toBe(201)
    const bodies = [
      (await student.get('/api/bijak/papers')).body,
      (await student.get(`/api/bijak/papers/${id}`)).body,
      (await student.get(`/api/bijak/papers/${String((gen.body as { data: { paperId: string } }).data.paperId)}`)).body,
      (await student.get('/api/bijak/contracts')).body,
      (await student.get('/api/bijak/subjects')).body,
      gen.body,
      (await student.post('/api/bijak/papers/generate', { subject: 'SN', kertas: 1 })).body,
    ]
    for (const body of bodies) {
      const keys = allKeys(body)
      for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `key "${k}" must not appear`).toBe(false)
    }
  })

  describe('access (AC 8)', () => {
    const routes = [
      ['get', '/api/bijak/papers'],
      ['get', '/api/bijak/papers/1'],
      ['get', '/api/bijak/contracts'],
      ['get', '/api/bijak/subjects'],
    ] as const

    it('no session is 401 on every route', async () => {
      const anon = t.agent()
      for (const [, path] of routes) expectError(await anon.get(path), 'UNAUTHORIZED')
      expectError(await anon.post('/api/bijak/papers/generate').send({ subject: 'MAT', kertas: 1 }), 'UNAUTHORIZED')
    })

    it.each(['guru@demo.test', 'admin@demo.test', 'adminsekolah@demo.test'])('%s outside Mod Pelajar is 403 on every route', async (who) => {
      const c = await loginAs(t, who)
      for (const [, path] of routes) expectError(await c.get(path), 'FORBIDDEN')
      expectError(await c.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 }), 'FORBIDDEN')
    })

    it.each(['admin@demo.test', 'adminsekolah@demo.test'])('%s inside Mod Pelajar acts as a student and may read and generate', async (who) => {
      const c = await loginAs(t, who)
      await c.enterMod()
      for (const [, path] of routes.filter(([, p]) => !p.endsWith('/1'))) expect((await c.get(path)).status).toBe(200)
      expect((await c.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })).status).toBe(201)
    })

    it('a POST without the CSRF token is 403 CSRF_INVALID and creates nothing', async () => {
      const before = Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]?.n)
      expectError(await student.postNoCsrf('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 }), 'CSRF_INVALID', 403)
      expect(Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]?.n)).toBe(before)
    })
  })
})
