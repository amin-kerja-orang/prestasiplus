import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { giveBab } from '../support/bab'
import { ACCOUNTS } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * R1-T45 part 3 (proof specs only): AC-R1-21.3 (the two V2 errors of "Tambah soalan") and AC-R1-21.6 (the section-pool candidate search
 * of the Set Builder, on the real BE-09 bank rather than the fakes of pool-window-shortfall.spec.ts). HTTP only.
 *
 * "Nombor soalan {x} sudah digunakan dalam kertas ini." (createQuestion) compares the typed number, lowercased and trimmed, ONLY with the
 * `numberLabel` of questions already added to the paper through "Tambah soalan". The negative side of that policy is pinned below (a number equal to
 * a positional number or to a bank question's printed number is NOT refused). Widening the check to positional or printed numbers is
 * [PROPOSED] / KIV R2 (ha24 KIV row 38, LEAD 2026-11-02): unconfirmed V2 behaviour, so it is not built and not asserted here.
 */
describe('R1-T45 builder AC proofs: Tambah soalan errors and the candidate search (real bank)', () => {
  let t: FullApp
  let admin: FullClient
  let student: FullClient
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
    await giveBab(t.db, ids) // Semakan asks for a Bab on the bulk route too (R1-H-A18)
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
    student = await loginFull(t, ACCOUNTS.student)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterAll(async () => {
    await t.close()
  })

  const editorOf = async (paper: string) => (await admin.get(`/api/admin/papers/${paper}`)).body.data
  const addSection = (paper: string, label: string) => admin.post(`/api/admin/papers/${paper}/sections`, { label })
  const addQuestion = (paper: string, sectionId: string, body: Record<string, unknown>) => admin.post(`/api/admin/papers/${paper}/sections/${sectionId}/questions`, body)
  type PoolUnit = { placed: boolean; questions: { id: string; pinned?: boolean }[] }
  const pool = (paper: string, section: string, query: string) => admin.get(`/api/admin/papers/${paper}/sections/${section}/pool${query}`)

  describe('AC-R1-21.3: the two V2 errors of "Tambah soalan" through HTTP', () => {
    it('a Kontrak Bahagian is refused with the V2 text "Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin." (422, the section is unchanged)', async () => {
      const { paper, sections } = await fullPaper()
      const res = await addQuestion(paper, sections[0]!, { number: '21', mode: 'mcq', marks: 2 })
      expect(res.status).toBe(422)
      expect(res.body.error.message).toBe('Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin.')
      const editor = await editorOf(paper)
      expect((editor.paper.sections as { id: string; questionCount: number }[]).find((s) => s.id === sections[0])?.questionCount).toBe(3)
    })

    it('a used Nombor soalan is refused with "Nombor soalan {x} sudah digunakan dalam kertas ini." on fields.number, case-insensitive, also across Bahagian', async () => {
      const { paper, sections } = await fullPaper()
      const res = await addSection(paper, 'Bahagian D')
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const d = (res.body.data.paper.sections as { id: string }[]).at(-1)!.id
      const e = await addSection(paper, 'Bahagian E')
      const eId = (e.body.data.paper.sections as { id: string }[]).at(-1)!.id
      expect(sections).not.toContain(eId)
      expect((await addQuestion(paper, d, { number: '7B', mode: 'mcq', marks: 1 })).status).toBe(201)
      for (const [section, number] of [[d, '7b'], [eId, ' 7B ']] as const) {
        const clash = await addQuestion(paper, section, { number, mode: 'mcq', marks: 1 })
        expect(clash.status, number).toBe(422)
        expect(clash.body.error.message).toBe(`Nombor soalan ${number.trim()} sudah digunakan dalam kertas ini.`)
        expect(clash.body.error.fields.number).toBe(clash.body.error.message)
      }
    })

    it('both refusals store nothing: no question is created in the bank', async () => {
      const { paper, sections } = await fullPaper()
      const d = ((await addSection(paper, 'Bahagian D')).body.data.paper.sections as { id: string }[]).at(-1)!.id
      expect((await addQuestion(paper, d, { number: '9', mode: 'mcq', marks: 1 })).status).toBe(201)
      const before = Number((await q(`select count(*)::int n from questions`))[0]!.n)
      expect((await addQuestion(paper, sections[1]!, { number: '10', mode: 'mcq', marks: 1 })).status).toBe(422)
      expect((await addQuestion(paper, d, { number: '9', mode: 'mcq', marks: 1 })).status).toBe(422)
      const after = Number((await q(`select count(*)::int n from questions`))[0]!.n)
      expect(after).toBe(before)
    })

    it('the clash is against the Nombor soalan of ADDED questions only: a positional number or a bank question\'s printed number is not refused (current policy, [PROPOSED] KIV R2 to widen)', async () => {
      const printed = await approved({ numberLabel: 'P88', pointsValue: 2 })
      const { paper, ids } = await fullPaper({ last: printed })
      expect(ids.at(-1)).toBe(printed)
      expect(((await admin.get(`/api/questions/${printed}`)).body.data as { numberLabel: string | null }).numberLabel).toBe('P88') // the bank really carries it
      const d = ((await addSection(paper, 'Bahagian D')).body.data.paper.sections as { id: string }[]).at(-1)!.id
      // '1' is the position of the first question of Bahagian A, '6' the overall position of the last one, 'p88' (any case) the printed number of that bank question
      for (const number of ['1', '6', 'p88']) {
        const res = await addQuestion(paper, d, { number, mode: 'mcq', marks: 1 })
        expect(res.status, `${number}: ${JSON.stringify(res.body)}`).toBe(201)
      }
      const labels = (await editorOf(paper)).paper.sections.find((x: { id: string }) => x.id === d).numberLabels as Record<string, string>
      expect(Object.values(labels).sort()).toEqual(['1', '6', 'p88'])
      // and only now do these three exist as labels on the paper, so a repeat IS refused
      expect((await addQuestion(paper, d, { number: 'P88', mode: 'mcq', marks: 1 })).status).toBe(422)
    })
  })

  describe('AC-R1-21.6: the candidate search ("Cari soalan") of the Set Builder on the real bank', () => {
    it('finds a Terbit question of the paper subject by its text, says whether it is placed, and a miss is an empty list with total 0', async () => {
      const marker = 'Rajah kuasa tiga unik zq'
      const hit = await approved({ questionText: `${marker} berapakah nilai x?` })
      await setPool(hit, ['MAT2-A'])
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      const found = await pool(paper, a!, `?q=${encodeURIComponent(marker.toUpperCase())}&pageSize=100`)
      expect(found.status, JSON.stringify(found.body)).toBe(200)
      expect(found.body.meta.totalItems).toBe(1)
      const unit = (found.body.data as PoolUnit[])[0]!
      expect(unit.questions.map((x) => x.id)).toEqual([hit])
      expect(unit.placed).toBe(false)
      expect(unit.questions[0]!.pinned).toBeUndefined()
      const miss = await pool(paper, a!, `?q=${encodeURIComponent('tiada padanan xyzzy')}`)
      expect(miss.body.data).toEqual([])
      expect(miss.body.meta.totalItems).toBe(0)
    })

    it('the same search shows the question as placed with pinned false on a draf and pinned true once the paper is Terbit (T48)', async () => {
      const marker = 'Pecahan unik yy'
      // the searched question is the paper's last one (Bahagian C, 2 marks), so the paper stays a valid, publishable paper
      const extra = await approved({ questionText: `${marker} apakah hasilnya?`, pointsValue: 2 })
      const { paper, ids, sections } = await fullPaper({ last: extra })
      expect(ids.at(-1)).toBe(extra)
      const find = async () => (await pool(paper, sections[2]!, `?q=${encodeURIComponent(marker)}&pageSize=100`)).body.data as PoolUnit[]
      const draft = await find()
      expect(draft).toHaveLength(1)
      expect(draft[0]).toMatchObject({ placed: true })
      expect(draft[0]!.questions[0]).toMatchObject({ id: extra, pinned: false })

      const published = await admin.post(`/api/admin/papers/${paper}/publish`)
      expect(published.status, JSON.stringify(published.body)).toBe(200)
      expect(published.body.data).toMatchObject({ ok: true })
      const terbit = await find()
      expect(terbit).toHaveLength(1)
      expect(terbit[0]).toMatchObject({ placed: true })
      expect(terbit[0]!.questions[0]).toMatchObject({ id: extra, pinned: true })
    })

    it('a Draf made by "Tambah soalan" is not a candidate: the search for the paper sees no new unit and the total does not grow', async () => {
      const { paper, sections } = await fullPaper()
      const before = (await pool(paper, sections[0]!, '?pageSize=100')).body.meta.totalItems as number
      const d = ((await addSection(paper, 'Bahagian D')).body.data.paper.sections as { id: string }[]).at(-1)!.id
      const made = await addQuestion(paper, d, { number: '31', mode: 'mcq', marks: 2 })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      const after = (await pool(paper, sections[0]!, '?pageSize=100')).body
      expect(after.meta.totalItems).toBe(before)
      const all = (after.data as PoolUnit[]).flatMap((u) => u.questions.map((x) => x.id))
      expect(all).not.toContain((made.body.data.added as string[])[0])
    })

    it('the page size is capped at 100 (422 above) and the search needs a session', async () => {
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      expect((await pool(paper, a!, '?pageSize=101')).status).toBe(422)
      expect((await student.get(`/api/admin/papers/${paper}/sections/${a}/pool`)).status).toBe(403)
    })
  })
})
