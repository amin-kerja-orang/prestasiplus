import { BIJAK_BUILDER_MESSAGES as MSG } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { ACCOUNTS, auditRows } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * R1-T48: builder parity with the V2 Panel "Semak Kertas Simulasi": the cover code, the per-paper answering rule, "Tambah bahagian",
 * "Tambah soalan" (a question created inside the paper), "Padam soalan", the `pinned` flag per placed question and the body / caption edit
 * of a shared stimulus. Real BE-09 bank and ServabilityService; HTTP only.
 */
describe('R1-T48 builder parity: cover code, rule, sections, added questions, pinned, stimulus edit', () => {
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

  type Detail = { code: string; message: string; overridable: boolean; section?: string; questionId?: string }
  type Review = { ok: boolean; blockers: string[]; blockerDetails: Detail[]; canOverride: boolean; rows: { questionId: string; pinned?: boolean }[] }
  const reviewOf = async (paper: string) => (await admin.get(`/api/admin/papers/${paper}/review`)).body.data as Review
  const editorOf = async (paper: string) => (await admin.get(`/api/admin/papers/${paper}`)).body.data
  const paperOf = (editor: { paper: { sections: Record<string, unknown>[] } }) => editor.paper
  const dbPaper = async (id: string) => (await q(`select status, paper_code from papers where id = $1`, [id]))[0]!
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

  describe('cover code ("Kod kertas (kulit)")', () => {
    it('is patchable on a draft, trimmed, audited; blank or over 40 characters is 422; a Terbit paper is read-only', async () => {
      const { paper } = await fullPaper()
      const res = await admin.put(`/api/admin/papers/${paper}`, { code: '  1449/9  ' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.paper.code).toBe('1449/9')
      expect((await dbPaper(paper)).paper_code).toBe('1449/9')
      const audit = (await auditRows(t.db, 'bijak.paper.updated')).filter((r) => r.target_id === paper)
      expect(audit.some((r) => (r.detail as { code?: string }).code === '1449/9')).toBe(true)
      const blank = await admin.put(`/api/admin/papers/${paper}`, { code: '   ' })
      expect(blank.status).toBe(422)
      expect(blank.body.error.fields.code).toBe(MSG.codeRequired)
      expect((await admin.put(`/api/admin/papers/${paper}`, { code: 'X'.repeat(41) })).status).toBe(422)
      expect((await admin.put(`/api/admin/papers/${paper}`, { code: 'X'.repeat(40) })).status).toBe(200)
      expect((await student.put(`/api/admin/papers/${paper}`, { code: 'Z' })).status).toBe(403)
      expect((await admin.post(`/api/admin/papers/${paper}/publish`)).body.data.ok).toBe(true)
      const locked = await admin.put(`/api/admin/papers/${paper}`, { code: '1449/1' })
      expect(locked.status).toBe(422)
      expect(locked.body.error.message).toBe(MSG.paperLocked)
    })
  })

  describe('per-paper answering rule ("Peraturan menjawab", "Bilangan soalan dipilih")', () => {
    it('a rule that differs from the Kontrak is the overridable RULE_NOT_IN_CONTRACT; marks that no longer fit the budget stay a hard MARKS_MISMATCH', async () => {
      const { paper, sections } = await fullPaper()
      // Bahagian A: 3 questions, Jawab Semua; Pilih 2 changes the counted marks (2 of 3) as well.
      const res = await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: sections[0], rule: { type: 'choose', n: 2 } }] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.paper.sections[0].rule).toEqual({ type: 'choose', n: 2 })
      expect(res.body.data.paper.sections[0].questionIds).toHaveLength(3)
      const review = await reviewOf(paper)
      expect(review.ok).toBe(false)
      expect(review.blockerDetails).toContainEqual({ code: 'RULE_NOT_IN_CONTRACT', message: 'Bahagian A: peraturan menjawab Pilih 2 tidak sama dengan Kontrak (Jawab Semua)', overridable: true, section: 'Bahagian A' })
      expect(review.blockerDetails.find((b) => b.code === 'MARKS_MISMATCH')).toMatchObject({ overridable: false, section: 'Bahagian A' })
      expect(review.canOverride).toBe(false)
      // back to the Kontrak's rule: clean again
      await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: sections[0], rule: { type: 'all' } }] })
      expect(await reviewOf(paper)).toMatchObject({ ok: true, blockerDetails: [], canOverride: false })
    })

    it('a rule change that keeps the marks is the only blocker: canOverride, the audited override publishes it', async () => {
      const { paper, sections } = await fullPaper()
      // Bahagian B holds one question: Pilih 1 of 1 counts the same marks.
      expect((await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: sections[1], rule: { type: 'choose', n: 1 } }] })).status).toBe(200)
      const review = await reviewOf(paper)
      expect(review.blockerDetails).toEqual([{ code: 'RULE_NOT_IN_CONTRACT', message: 'Bahagian B: peraturan menjawab Pilih 1 tidak sama dengan Kontrak (Jawab Semua)', overridable: true, section: 'Bahagian B' }])
      expect(review.canOverride).toBe(true)
      const refused = await admin.post(`/api/admin/papers/${paper}/publish`)
      expect(refused.body.data).toMatchObject({ ok: false, canOverride: true, blockerDetails: review.blockerDetails })
      const done = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'Peraturan set ini dipinda oleh admin' })
      expect(done.body.data).toMatchObject({ ok: true, errors: [], overridden: [review.blockers[0]] })
      expect((await auditRows(t.db, 'bijak.paper.published_override')).filter((r) => r.target_id === paper)).toHaveLength(1)
    })

    it('Pilih N must be between 1 and the printed question count (fields.rule); a bad rule shape is 422', async () => {
      const { paper, sections } = await fullPaper()
      const over = await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: sections[0], rule: { type: 'choose', n: 4 } }] })
      expect(over.status).toBe(422)
      expect(over.body.error.fields.rule).toBe('Bilangan soalan dipilih mesti antara 1 dan 3')
      expect((await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: sections[0], rule: { type: 'choose', n: 0 } }] })).status).toBe(422)
      expect((await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: sections[0], rule: { type: 'none' } }] })).status).toBe(422)
      expect(paperOf(await editorOf(paper)).sections[0]).toMatchObject({ rule: { type: 'all' } })
    })
  })

  describe('"Tambah bahagian"', () => {
    it('appends an admin-added Bahagian with the rule Jawab Semua and figures that follow its placements; it is outside the Kontrak (overridable)', async () => {
      const { paper } = await fullPaper()
      const res = await addSection(paper, '  Bahagian D  ')
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const sections = res.body.data.paper.sections as Record<string, unknown>[]
      expect(sections).toHaveLength(4)
      expect(sections[3]).toMatchObject({ label: 'Bahagian D', rule: { type: 'all' }, questionCount: 0, markBudget: 0, questionIds: [], adminCreated: true })
      expect(sections[0]!.adminCreated).toBeUndefined()
      const review = await reviewOf(paper)
      expect(review.blockerDetails).toEqual([{ code: 'SECTION_NOT_IN_CONTRACT', message: 'Bahagian D: bahagian ini tiada dalam Kontrak', overridable: true, section: 'Bahagian D' }])
      expect(review.canOverride).toBe(true)
      // a bank question placed in it moves its figures; no count or marks blocker appears
      const extra = await approved()
      expect((await place(paper, (sections[3] as { id: string }).id, extra)).status).toBe(201)
      const after = paperOf(await editorOf(paper)).sections[3] as { questionCount: number; markBudget: number }
      expect(after).toMatchObject({ questionCount: 1, markBudget: 1 })
      expect((await reviewOf(paper)).blockerDetails.map((b) => b.code)).toEqual(['SECTION_NOT_IN_CONTRACT'])
      // the override publishes it and freezes the figures for the student side
      const done = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'Bahagian tambahan diluluskan' })
      expect(done.body.data).toMatchObject({ ok: true, errors: [] })
      expect(await q(`select question_count, mark_budget from paper_sections where paper_id = $1 and admin_created`, [paper])).toEqual([{ question_count: 1, mark_budget: 1 }])
    })

    it('refuses a blank label and more than 20 Bahagian, needs an admin, and a Terbit paper is read-only', async () => {
      const { paper } = await fullPaper()
      const blank = await addSection(paper, '   ')
      expect(blank.status).toBe(422)
      expect(blank.body.error.fields.label).toBe(MSG.sectionLabelRequired)
      expect((await student.post(`/api/admin/papers/${paper}/sections`, { label: 'X' })).status).toBe(403)
      for (let i = 4; i <= 20; i++) expect((await addSection(paper, `Bahagian ${String(i)}`)).status).toBe(201)
      const full = await addSection(paper, 'Bahagian 21')
      expect(full.status).toBe(422)
      expect(full.body.error.message).toBe(MSG.sectionLimit)
      const other = await fullPaper()
      expect((await admin.post(`/api/admin/papers/${other.paper}/publish`)).body.data.ok).toBe(true)
      const locked = await addSection(other.paper, 'Lewat')
      expect(locked.status).toBe(422)
      expect(locked.body.error.message).toBe(MSG.paperLocked)
    })
  })

  describe('"Tambah soalan" (creates a question inside the paper)', () => {
    it('only an admin-added Bahagian takes it (the V2 text); a Kontrak Bahagian is refused', async () => {
      const { paper, sections } = await fullPaper()
      const res = await addQuestion(paper, sections[0]!, { number: '21', mode: 'mcq', marks: 2 })
      expect(res.status).toBe(422)
      expect(res.body.error.message).toBe('Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin.')
    })

    it('creates a blank Draf question in the bank, places it with its Nombor soalan, and Terbit waits for it ("1 soalan belum Terbit")', async () => {
      const { paper, d } = await withBahagianD()
      const res = await addQuestion(paper, d, { number: ' 21 ', mode: 'mcq', marks: 2 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const id = (res.body.data.added as string[])[0]!
      expect(res.body.data.added).toHaveLength(1)
      const section = res.body.data.editor.paper.sections.find((s: { id: string }) => s.id === d)
      expect(section).toMatchObject({ questionIds: [id], numberLabels: { [id]: '21' }, questionCount: 1, markBudget: 2 })
      const stored = await admin.get(`/api/questions/${id}`)
      expect(stored.status, JSON.stringify(stored.body)).toBe(200)
      expect(stored.body.data.status).toBe('draft')
      expect(stored.body.data.parts).toHaveLength(1)
      expect(stored.body.data.parts[0]).toMatchObject({ mode: 'mcq', marks: 2 })
      const review = await reviewOf(paper)
      expect(review.blockerDetails.map((b) => [b.code, b.overridable])).toEqual([
        ['NOT_PUBLISHED', false],
        // a Draf is not among the live candidates of the subject yet (the same as any Draf placed through PUT)
        ['UNKNOWN_QUESTION', false],
        ['SECTION_NOT_IN_CONTRACT', true],
      ])
      expect(review.blockerDetails[0]!.message).toBe('Bahagian D: 1 soalan belum Terbit')
      expect(review.blockerDetails[1]).toMatchObject({ questionId: id, section: 'Bahagian D' })
      expect(review.canOverride).toBe(false)
      expect((await auditRows(t.db, 'bijak.paper.updated')).some((r) => r.target_id === paper && (r.detail as { op?: string }).op === 'question_create')).toBe(true)
    })

    it('every Jenis jawapan creates a valid question with the Markah as its part marks', async () => {
      const { paper, d } = await withBahagianD()
      for (const [i, mode] of (['mcq', 'short_text', 'numeric', 'working', 'essay'] as const).entries()) {
        const res = await addQuestion(paper, d, { number: `N${String(i)}`, mode, marks: i + 1 })
        expect(res.status, `${mode}: ${JSON.stringify(res.body)}`).toBe(201)
        const id = (res.body.data.added as string[])[0]!
        const stored = (await admin.get(`/api/questions/${id}`)).body.data
        expect(stored.parts[0], mode).toMatchObject({ mode, marks: i + 1 })
      }
      const section = paperOf(await editorOf(paper)).sections.find((s: Record<string, unknown>) => s.id === d) as { questionCount: number; markBudget: number }
      expect(section).toMatchObject({ questionCount: 5, markBudget: 15 })
    })

    it('refuses a number already on the paper (case-insensitive, V2 text on fields.number), a blank number, a bad mode or Markah', async () => {
      const { paper, d } = await withBahagianD()
      expect((await addQuestion(paper, d, { number: 'Q1a', mode: 'short_text', marks: 1 })).status).toBe(201)
      const clash = await addQuestion(paper, d, { number: 'q1A', mode: 'short_text', marks: 1 })
      expect(clash.status).toBe(422)
      expect(clash.body.error.message).toBe('Nombor soalan q1A sudah digunakan dalam kertas ini.')
      expect(clash.body.error.fields.number).toBe('Nombor soalan q1A sudah digunakan dalam kertas ini.')
      expect((await addQuestion(paper, d, { number: '  ', mode: 'mcq', marks: 1 })).body.error.fields.number).toBe(MSG.numberRequired)
      expect((await addQuestion(paper, d, { number: '2', mode: 'cloze', marks: 1 })).body.error.fields.mode).toBe(MSG.modeInvalid)
      for (const marks of [0, 101, 1.5, '2']) expect((await addQuestion(paper, d, { number: '3', mode: 'mcq', marks })).status, String(marks)).toBe(422)
      expect((await addQuestion(paper, d, { number: '4', mode: 'mcq', marks: 1, extra: true })).status).toBe(422)
      expect((await student.post(`/api/admin/papers/${paper}/sections/${d}/questions`, { number: '5', mode: 'mcq', marks: 1 })).status).toBe(403)
      expect((await admin.post(`/api/admin/papers/${paper}/sections/987654321/questions`, { number: '5', mode: 'mcq', marks: 1 })).body.error.message).toBe(MSG.invalidSection)
    })

    it('the Nombor soalan survives later placements and a reorder; Salin set copies the section and the number', async () => {
      const { paper, d } = await withBahagianD()
      const first = (await addQuestion(paper, d, { number: '21', mode: 'mcq', marks: 2 })).body.data.added[0] as string
      const bank = await approved()
      expect((await place(paper, d, bank)).status).toBe(201)
      const order = await admin.put(`/api/admin/papers/${paper}/sections/${d}/order`, { order: [bank, first] })
      expect(order.status, JSON.stringify(order.body)).toBe(200)
      const section = order.body.data.editor.paper.sections.find((s: { id: string }) => s.id === d)
      expect(section.questionIds).toEqual([bank, first])
      expect(section.numberLabels).toEqual({ [first]: '21' })
      const copy = await admin.post(`/api/admin/papers/${paper}/copy`)
      const copied = (await editorOf(copy.body.data.id as string)).paper.sections.find((s: Record<string, unknown>) => s.adminCreated) as { numberLabels: Record<string, string>; questionIds: string[] }
      expect(copied.questionIds).toEqual([bank, first])
      expect(copied.numberLabels).toEqual({ [first]: '21' })
    })
  })

  describe('"Padam soalan"', () => {
    it('deletes a Draf question created through Tambah soalan from the paper and the bank; a bank question is refused (use the placement route)', async () => {
      const { paper, d, ids } = await withBahagianD()
      const id = (await addQuestion(paper, d, { number: '21', mode: 'numeric', marks: 2 })).body.data.added[0] as string
      const bank = await approved()
      expect((await place(paper, d, bank)).status).toBe(201)
      const refused = await admin.del(`/api/admin/papers/${paper}/questions/${bank}`)
      expect(refused.status).toBe(422)
      expect(refused.body.error.message).toBe(`Soalan ${bank} bukan soalan tambahan kertas ini`)
      expect((await admin.del(`/api/admin/papers/${paper}/questions/${ids[0]}`)).body.error.message).toBe(`Soalan ${ids[0]} bukan soalan tambahan kertas ini`)
      expect((await admin.del(`/api/admin/papers/${paper}/questions/987654321`)).body.error.message).toBe('Soalan 987654321 tiada dalam kertas ini')
      const res = await admin.del(`/api/admin/papers/${paper}/questions/${id}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.removed).toEqual([id])
      const section = res.body.data.editor.paper.sections.find((s: { id: string }) => s.id === d)
      expect(section.questionIds).toEqual([bank])
      expect(section.numberLabels).toBeUndefined()
      expect((await admin.get(`/api/questions/${id}`)).status).toBe(404)
      expect((await auditRows(t.db, 'bijak.paper.updated')).some((r) => r.target_id === paper && (r.detail as { op?: string; deleted?: boolean }).op === 'question_delete' && (r.detail as { deleted?: boolean }).deleted === true)).toBe(true)
    })

    it('a created question that is no longer a Draf, or sits on another paper, only leaves the paper and stays in the bank', async () => {
      const { paper, d } = await withBahagianD()
      const id = (await addQuestion(paper, d, { number: '21', mode: 'mcq', marks: 2 })).body.data.added[0] as string
      const copy = await admin.post(`/api/admin/papers/${paper}/copy`)
      expect(copy.status).toBe(201)
      const res = await admin.del(`/api/admin/papers/${paper}/questions/${id}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect((await admin.get(`/api/questions/${id}`)).status).toBe(200)
      expect(await q(`select count(*)::int n from paper_placements where question_id = $1`, [id])).toEqual([{ n: 1 }])
      // in review (no longer a Draf) it is kept as well
      const second = await withBahagianD()
      const kept = (await addQuestion(second.paper, second.d, { number: '9', mode: 'mcq', marks: 1 })).body.data.added[0] as string
      expect((await admin.post('/api/questions/bulk-action', { action: 'review', ids: [kept] })).status).toBe(200)
      expect((await admin.del(`/api/admin/papers/${second.paper}/questions/${kept}`)).status).toBe(200)
      expect((await admin.get(`/api/questions/${kept}`)).status).toBe(200)
    })

    it('a Terbit paper is read-only', async () => {
      const made = await withBahagianD()
      const id = (await addQuestion(made.paper, made.d, { number: '1', mode: 'mcq', marks: 1 })).body.data.added[0] as string
      // approve it (tag + review + approved) so that the override can publish the paper
      const edit = await admin.put(`/api/questions/${id}`, { subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionText: 'Berapakah hasil tambah 2 dan 3?', tag })
      expect(edit.status, JSON.stringify(edit.body)).toBe(200)
      await approve([id])
      const done = await admin.post(`/api/admin/papers/${made.paper}/publish`, { override: true, reason: 'Bahagian tambahan diluluskan' })
      expect(done.body.data, JSON.stringify(done.body)).toMatchObject({ ok: true })
      const locked = await admin.del(`/api/admin/papers/${made.paper}/questions/${id}`)
      expect(locked.status).toBe(422)
      expect(locked.body.error.message).toBe(MSG.paperLocked)
    })
  })

  describe('P5: `pinned` per placed question ("Disematkan")', () => {
    it('false while the paper is a draf, true once it is Terbit, false again after Tarik balik; a candidate that is not placed carries none', async () => {
      const { paper, ids } = await fullPaper()
      const spare = await approved()
      await setPool(spare, ['MAT2-A'])
      const flagOf = async () => {
        const editor = await editorOf(paper)
        return Object.fromEntries((editor.questions as { id: string; pinned?: boolean }[]).map((x) => [x.id, x.pinned]))
      }
      let flags = await flagOf()
      expect(ids.every((id) => flags[id] === false)).toBe(true)
      expect(Object.hasOwn(flags, spare) ? flags[spare] : 'absent').toBeUndefined()
      expect((await reviewOf(paper)).rows.every((r) => r.pinned === false)).toBe(true)
      // the section pool answer: a placed member carries the flag, a candidate that is not placed carries none
      type PoolUnit = { placed: boolean; questions: { id: string; pinned?: boolean }[] }
      const poolOf = async (): Promise<PoolUnit[]> => {
        const section = (await sectionsOf(paper))[0]
        const all: PoolUnit[] = []
        for (let page = 1; page <= 50; page++) {
          const res = await admin.get(`/api/admin/papers/${paper}/sections/${section}/pool?pageSize=100&page=${String(page)}`)
          all.push(...(res.body.data as PoolUnit[]))
          if (page >= (res.body.meta.totalPages as number)) break
        }
        return all
      }
      const before = await poolOf()
      expect(before.flatMap((u) => u.questions).find((x) => x.id === ids[0])?.pinned).toBe(false)
      expect(before.filter((u) => !u.placed).flatMap((u) => u.questions).every((x) => x.pinned === undefined)).toBe(true)
      expect((await admin.post(`/api/admin/papers/${paper}/publish`)).body.data.ok).toBe(true)
      expect((await poolOf()).flatMap((u) => u.questions).find((x) => x.id === ids[0])?.pinned).toBe(true)
      flags = await flagOf()
      expect(ids.every((id) => flags[id] === true)).toBe(true)
      expect(flags[spare]).toBeUndefined()
      expect((await reviewOf(paper)).rows.every((r) => r.pinned === true)).toBe(true)
      expect((await admin.post(`/api/admin/papers/${paper}/withdraw`)).status).toBe(200)
      flags = await flagOf()
      expect(ids.every((id) => flags[id] === false)).toBe(true)
    })
  })

  describe('R3: body and caption of the shared stimulus ("Sunting petikan")', () => {
    async function groupOnPaper(approveMembers: boolean) {
      const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan lama', caption: 'Kapsyen lama', body: { ms: 'Petikan ujian untuk kertas.' } })
      expect(stim.status, JSON.stringify(stim.body)).toBe(201)
      const members = [await mk(), await mk()]
      const group = await admin.post('/api/stimulus-groups', { label: 'Petikan lama', stimulusIds: [stim.body.data.id], questionIds: members })
      expect(group.status, JSON.stringify(group.body)).toBe(201)
      if (approveMembers) await approve(members)
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      // a draft member cannot be placed by the picker; PUT places any status (Terbit reports it)
      const placed = await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: a, questionIds: [members[0]] }] })
      expect(placed.status, JSON.stringify(placed.body)).toBe(200)
      return { paper, groupId: group.body.data.id as string, stimulusId: stim.body.data.id as string }
    }

    it('edits the caption and the body of the stimulus (and the title in the same call); the bank shows it for every paper', async () => {
      const { paper, groupId, stimulusId } = await groupOnPaper(false)
      const res = await admin.put(`/api/admin/papers/${paper}/groups/${groupId}`, { label: 'Petikan baharu', caption: 'Kapsyen baharu', body: { ms: 'Teks baharu petikan.', en: 'New text.' } })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const stored = (await admin.get(`/api/stimuli/${stimulusId}`)).body.data
      expect(stored).toMatchObject({ caption: 'Kapsyen baharu', body: { ms: 'Teks baharu petikan.', en: 'New text.' } })
      expect((await admin.get(`/api/stimulus-groups/${groupId}`)).body.data.label).toBe('Petikan baharu')
      // caption alone, with the stimulus named; null clears it
      const only = await admin.put(`/api/admin/papers/${paper}/groups/${groupId}`, { stimulusId, caption: null })
      expect(only.status, JSON.stringify(only.body)).toBe(200)
      const cleared = (await admin.get(`/api/stimuli/${stimulusId}`)).body.data
      expect(cleared.caption).toBeNull()
      expect(cleared.body.ms).toBe('Teks baharu petikan.')
      expect((await auditRows(t.db, 'bijak.paper.updated')).some((r) => r.target_id === paper && (r.detail as { stimulus?: unknown }).stimulus !== undefined)).toBe(true)
    })

    it('refuses nothing to save, an empty body, a caption over 300, a stimulus that is not in the group; a Terbit paper is read-only', async () => {
      const { paper, groupId } = await groupOnPaper(false)
      const put = (body: Record<string, unknown>) => admin.put(`/api/admin/papers/${paper}/groups/${groupId}`, body)
      const empty = await put({})
      expect(empty.status).toBe(422)
      expect(empty.body.error.fields.label).toBe(MSG.groupEditEmpty)
      expect((await put({ body: { ms: '' } })).status).toBe(422)
      expect((await put({ caption: 'K'.repeat(301) })).status).toBe(422)
      const other = await admin.post('/api/stimuli', { kind: 'passage', label: 'Lain', body: { ms: 'Petikan lain.' } })
      const mismatch = await put({ stimulusId: other.body.data.id, caption: 'x' })
      expect(mismatch.status).toBe(422)
      expect(mismatch.body.error.message).toBe(MSG.groupStimulusMismatch)
      expect((await student.put(`/api/admin/papers/${paper}/groups/${groupId}`, { caption: 'x' })).status).toBe(403)
    })

    it('the bank refuses the edit with 409 once the stimulus is served to pupils (its questions are approved)', async () => {
      const { paper, groupId, stimulusId } = await groupOnPaper(true)
      const res = await admin.put(`/api/admin/papers/${paper}/groups/${groupId}`, { caption: 'Terlambat' })
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect((await admin.get(`/api/stimuli/${stimulusId}`)).body.data.caption).toBe('Kapsyen lama')
    })
  })
})
