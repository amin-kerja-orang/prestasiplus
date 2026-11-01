import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { ACCOUNTS } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * R1-T48: builder parity with the V2 Panel "Semak Kertas Simulasi": the cover code, the per-paper answering rule, "Tambah bahagian",
 * "Tambah soalan" (a question created inside the paper), "Padam soalan", the `pinned` flag per placed question and the body / caption edit
 * of a shared stimulus. Real BE-09 bank and ServabilityService; HTTP only.
 */
describe('R1-T45 (R1-21.3, R1-21.6): Tambah soalan errors and the candidate search on T48', () => {
  let t: FullApp
  let admin: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function mk(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', {
      subjectId: subject,
      educationLevelId: level,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      kertas: '2',
      cognitiveLevel: 'mengaplikasi', // T33 approve gate: a cognitive level on every leaf of an SPM-bound question
      tag,
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  async function approve(ids: string[]): Promise<void> {
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.failed, `${action}: ${JSON.stringify(res.body.data)}`).toEqual([])
    }
  }
  const approved = async (over: Record<string, unknown> = {}): Promise<string> => {
    const id = await mk(over)
    await approve([id])
    return id
  }
  const setPool = (id: string, pools: string[]) => admin.put(`/api/admin/section-pools/${id}`, { pools })
  const newPaper = async (): Promise<string> => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const sectionsOf = async (id: string): Promise<string[]> => ((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
  const place = (paper: string, sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${paper}/placements`, { sectionId, questionId })
  /** A full MAT kertas 2 paper: A 3 questions, B 1, C 2 (as the PoC blueprint); every question is tagged with its section pool. */
  async function fullPaper(opts: { tagged?: boolean; last?: string } = {}): Promise<{ paper: string; ids: string[]; sections: string[] }> {
    const ids = [await approved(), await approved(), await approved(), await approved(), await approved({ pointsValue: 2 }), opts.last ?? (await approved({ pointsValue: 2 }))]
    if (opts.tagged !== false) {
      for (const [i, id] of ids.entries()) expect((await setPool(id, [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'])).status).toBe(200)
    }
    const paper = await newPaper()
    const sections = await sectionsOf(paper)
    const at = [0, 0, 0, 1, 2, 2]
    for (const [i, id] of ids.entries()) expect((await place(paper, sections[at[i]!]!, id)).status).toBe(201)
    return { paper, ids, sections }
  }

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterAll(async () => {
    await t.close()
  })

  const addSection = (paper: string, label: string) => admin.post(`/api/admin/papers/${paper}/sections`, { label })
  const addQuestion = (paper: string, sectionId: string, body: Record<string, unknown>) => admin.post(`/api/admin/papers/${paper}/sections/${sectionId}/questions`, body)
  /** A full paper plus an admin-added Bahagian D. */
  async function withBahagianD() {
    const made = await fullPaper()
    const res = await addSection(made.paper, 'Bahagian D')
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const sections = res.body.data.paper.sections as { id: string; label: string }[]
    return { ...made, d: sections[sections.length - 1]!.id }
  }

  const pool = (paper: string, section: string, query = '') => admin.get(`/api/admin/papers/${paper}/sections/${section}/pool${query}`)

  describe('AC-R1-21.3: "Tambah soalan" refusals carry the V2 BM texts over HTTP', () => {
    it('a Kontrak Bahagian: 422 VALIDATION_ERROR with the V2 text, and no question is created in the bank', async () => {
      const { paper, sections } = await fullPaper()
      const before = Number((await q(`select count(*)::int n from questions`))[0]!.n)
      const res = await addQuestion(paper, sections[1]!, { number: '30', mode: 'short_text', marks: 1 })
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.error.message).toBe('Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin.')
      expect(Number((await q(`select count(*)::int n from questions`))[0]!.n)).toBe(before)
    })

    it('a number already used on the paper, in ANY Bahagian and in any letter case, is refused with the number in the text; a fresh number still works', async () => {
      const { paper, d } = await withBahagianD()
      const e = await addSection(paper, 'Bahagian E')
      expect(e.status, JSON.stringify(e.body)).toBe(201)
      const secs = e.body.data.paper.sections as { id: string }[]
      const eId = secs[secs.length - 1]!.id
      expect((await addQuestion(paper, d, { number: 'Ab7', mode: 'mcq', marks: 1 })).status).toBe(201)
      const clash = await addQuestion(paper, eId, { number: 'aB7', mode: 'mcq', marks: 1 })
      expect(clash.status).toBe(422)
      expect(clash.body.error.code).toBe('VALIDATION_ERROR')
      expect(clash.body.error.message).toBe('Nombor soalan aB7 sudah digunakan dalam kertas ini.')
      expect(clash.body.error.fields.number).toBe('Nombor soalan aB7 sudah digunakan dalam kertas ini.')
      expect((await addQuestion(paper, eId, { number: 'Ab8', mode: 'mcq', marks: 1 })).status).toBe(201)
    })
  })

  describe('AC-R1-21.6: the candidate search ("Cari soalan") with the questions Tambah soalan creates', () => {
    it('a question created inside the paper is a Draf, so it is never a candidate (not by number text, not by its generated text); Terbit bank questions are found by their text', async () => {
      const { paper, d } = await withBahagianD()
      const res = await addQuestion(paper, d, { number: '88', mode: 'short_text', marks: 2 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const ids = ((await pool(paper, d, '?pageSize=100')).body.data as { questionId?: string; id?: string }[]).map((r) => r.questionId ?? r.id)
      const created = (res.body.data.added as string[])[0]!
      expect(ids).not.toContain(created)
      const byText = await pool(paper, d, `?q=${encodeURIComponent('belum disunting')}&pageSize=100`)
      expect(byText.status, JSON.stringify(byText.body)).toBe(200)
      expect(byText.body.meta.totalItems).toBe(0)
      expect(byText.body.data).toEqual([])
      const found = await pool(paper, d, `?q=${encodeURIComponent('BERAPAKAH HASIL TAMBAH')}&pageSize=100`)
      expect(found.body.meta.totalItems).toBeGreaterThan(0)
      expect(JSON.stringify(found.body.data)).not.toContain(`"${created}"`)
    })

    it('the same candidate search works on the Kontrak Bahagian of that paper and the window rules still hold (block above 100 is 422)', async () => {
      const { paper, d, sections } = await withBahagianD()
      for (const s of [sections[0]!, d]) {
        expect((await pool(paper, s, '?pageSize=100')).status).toBe(200)
        expect((await pool(paper, s, '?pageSize=101')).status).toBe(422)
      }
    })
  })
})
