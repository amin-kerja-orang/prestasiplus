import { BIJAK_BUILDER_MESSAGES as M, BijakBuilderEditorSchema, BijakBuilderPaperSummarySchema, BijakBuilderPublishResultSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { giveBab } from '../support/bab'
import { ACCOUNTS, auditRows } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * S3-T06 (PRD30 Q-18, API-BIJAK-10 with `surface = 'subjektif'`): the admin Kertas Subjektif lane on /api/admin/papers. Real BE-09 bank and
 * ServabilityService. A Kertas Subjektif has no Kontrak (create and Terbit); the Simulasi create and list are unchanged.
 */
describe('S3-T06 Kertas Subjektif admin lane on /api/admin/papers', () => {
  let t: FullApp
  let admin: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function approve(ids: string[]): Promise<void> {
    await giveBab(t.db, ids)
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data, `${action}: ${JSON.stringify(res.body.data)}`).toMatchObject({ affected: ids.length, failed: [] })
    }
  }
  /** An approved MCQ (1 mark, with a key) or a written question (2 marks, with a point scheme). */
  async function question(kind: 'mcq' | 'written'): Promise<string> {
    const res = await admin.post(
      '/api/questions',
      kind === 'mcq'
        ? { subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionType: 'mcq', questionText: 'Berapakah hasil tambah 2 dan 3?', options: ['4', '5', '6', '7'], correctAnswer: 1, cognitiveLevel: 'mengaplikasi', kertas: '2', tag }
        : {
            subjectId: subject,
            educationLevelId: level,
            difficultyLevel: 3,
            questionType: 'essay',
            questionText: 'Terangkan cara mengira luas segi empat tepat.',
            kertas: '2',
            tag,
            parts: [{ label: 'a', mode: 'working', cognitiveLevel: 'mengaplikasi', prompt: { ms: 'Kira luas segi empat tepat itu.' }, marks: 2, key: { kind: 'points', marks: 2, points: [{ id: 'p1', code: 'M', label: 'Darabkan', marks: 2, text: { ms: 'panjang darab lebar' } }] } }],
          },
    )
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await approve([id])
    return id
  }
  const dropKey = (questionId: string) =>
    q(`delete from answer_keys where part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1)`, [questionId])

  const BODY = { subject: 'MAT', kertas: 3, surface: 'subjektif', title: 'Percubaan Negeri A', examBoard: 'Selangor', year: 2024, totalMarks: 3, durationMinutes: 90 }
  const create = (over: Record<string, unknown> = {}) => admin.post('/api/admin/papers', { ...BODY, ...over })
  async function made(over: Record<string, unknown> = {}): Promise<string> {
    const res = await create(over)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const editor = async (id: string) => BijakBuilderEditorSchema.parse((await admin.get(`/api/admin/papers/${id}`)).body.data)
  const sectionOf = async (id: string) => (await editor(id)).paper.sections[0]!.id
  const place = (paper: string, sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${paper}/placements`, { sectionId, questionId })
  const publish = async (id: string, body?: Record<string, unknown>) => {
    const res = await admin.post(`/api/admin/papers/${id}/publish`, body)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return BijakBuilderPublishResultSchema.parse(res.body.data)
  }
  const status = async (id: string) => String((await q(`select status from papers where id = $1`, [id]))[0]?.status)

  beforeAll(async () => {
    t = await bootFullApp()
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

  describe('create', () => {
    it.each([
      ['title missing', { title: undefined }, M.subjektifTitleRequired],
      ['title blank', { title: '   ' }, M.subjektifTitleRequired],
      ['title over 150', { title: 'x'.repeat(151) }, M.subjektifTitleTooLong],
      ['title over 200 still gets the 150 message', { title: 'x'.repeat(201) }, M.subjektifTitleTooLong],
      ['examBoard missing', { examBoard: undefined }, M.examBoardRequired],
      ['year missing', { year: undefined }, M.yearRequired],
      ['totalMarks missing', { totalMarks: undefined }, M.totalMarksRange],
      ['totalMarks over 200', { totalMarks: 201 }, M.totalMarksRange],
      ['totalMarks zero', { totalMarks: 0 }, M.totalMarksRange],
      ['durationMinutes over 300', { durationMinutes: 301 }, M.durationRange],
      ['durationMinutes negative', { durationMinutes: -1 }, M.durationRange],
      ['kertas 1', { kertas: 1 }, M.kertasInvalid],
      ['kertas 5', { kertas: 5 }, M.kertasInvalid],
    ])('422: %s', async (_name, over, message) => {
      const before = (await q(`select count(*)::int n from papers`))[0]!.n
      const res = await create(over)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(JSON.stringify(res.body)).toContain(message)
      expect((await q(`select count(*)::int n from papers`))[0]!.n).toBe(before)
    })

    it('Negeri, Tahun, Tempoh and Jumlah Markah are refused on a Simulasi create', async () => {
      const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, totalMarks: 10 })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(JSON.stringify(res.body)).toContain(M.subjektifOnly)
    })

    it('201 with no Kontrak for that subject and kertas: no blueprint, no paper code, not restricted, one empty Bahagian A, K3 on reads', async () => {
      expect((await q(`select count(*)::int n from blueprints where subject_id = $1 and kertas = 3`, [subject]))[0]!.n).toBe(0)
      const id = await made({ examBoard: ' Negeri Sembilan ', durationMinutes: 90 })
      const row = (await q(`select kind, status, surface, blueprint_id, paper_code, level_scope, exam_board, year, total_marks, duration_minutes, printed_duration_min from papers where id = $1`, [id]))[0]!
      expect(row).toMatchObject({ kind: 'pilihan', status: 'draft', surface: 'subjektif', blueprint_id: null, paper_code: null, level_scope: null, exam_board: 'negeri-sembilan', year: 2024, total_marks: 3, duration_minutes: 90, printed_duration_min: 90 })
      const secs = await q(`select label, rule_type, rule_n, question_count, mark_budget, admin_created, compulsory from paper_sections where paper_id = $1`, [id])
      expect(secs).toEqual([{ label: 'Bahagian A', rule_type: 'all', rule_n: null, question_count: 0, mark_budget: 0, admin_created: true, compulsory: false }])
      const e = await editor(id)
      expect(e.blueprint).toBeNull()
      expect(e.paper).toMatchObject({ surface: 'subjektif', code: 'K3', examBoard: 'negeri-sembilan', durationMinutes: 90, durationMin: 90, totalMarks: 3, year: 2024, status: 'draf' })
      expect((await auditRows(t.db, 'bijak.paper.created')).some((r) => r.target_id === id)).toBe(true)
    })

    it('Tempoh omitted or 0 is untimed: duration_minutes null/0 and printed_duration_min 0', async () => {
      const none = await made({ durationMinutes: undefined })
      const zero = await made({ durationMinutes: 0 })
      expect((await q(`select duration_minutes, printed_duration_min from papers where id = $1`, [none]))[0]).toEqual({ duration_minutes: null, printed_duration_min: 0 })
      expect((await q(`select duration_minutes, printed_duration_min from papers where id = $1`, [zero]))[0]).toEqual({ duration_minutes: 0, printed_duration_min: 0 })
      expect((await editor(none)).paper.durationMin).toBe(0)
    })

    it('the Simulasi create is unchanged (needs a Kontrak, keeps its Kontrak sections and code)', async () => {
      const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const row = (await q(`select surface, blueprint_id, paper_code from papers where id = $1`, [res.body.data.id]))[0]!
      expect(row.surface).toBe('simulasi')
      expect(row.blueprint_id).not.toBeNull()
      expect((await editor(res.body.data.id as string)).paper).toMatchObject({ surface: 'simulasi', code: expect.stringMatching(/\d/) })
      const none = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 3 })
      expect(none.status).toBe(422)
    })
  })

  describe('list', () => {
    let a: string
    let b: string
    let simulasi: string

    beforeAll(async () => {
      a = await made({ title: 'Senarai A', kertas: 2, examBoard: 'Johor', year: 2023, totalMarks: 1 })
      b = await made({ title: 'Senarai B', kertas: 4, examBoard: 'Perak', year: 2022, totalMarks: 2 })
      expect((await place(a, await sectionOf(a), await question('mcq'))).status).toBe(201)
      const noScheme = await question('written')
      await dropKey(noScheme)
      expect((await place(b, await sectionOf(b), noScheme)).status).toBe(201)
      simulasi = (await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })).body.data.id as string
    })

    const list = async (qs = '') => {
      const res = await admin.get(`/api/admin/papers?pageSize=100${qs}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return res.body as { data: { id: string; surface: string }[]; meta: { totalItems: number; counts?: Record<string, number> } }
    }

    it('the default list is the Set Builder list: no subjektif row and no counts', async () => {
      const res = await list()
      expect(res.data.map((r) => r.id)).toContain(simulasi)
      expect(res.data.every((r) => r.surface === 'simulasi')).toBe(true)
      expect(res.data.map((r) => r.id)).not.toContain(a)
      expect(res.meta.counts).toBeUndefined()
      expect((await list('&surface=simulasi')).data.map((r) => r.id)).not.toContain(b)
    })

    it('surface=subjektif lists only Kertas Subjektif rows with the S3-T06 columns', async () => {
      const res = await list('&surface=subjektif')
      expect(res.data.every((r) => r.surface === 'subjektif')).toBe(true)
      expect(res.data.map((r) => r.id)).not.toContain(simulasi)
      const row = BijakBuilderPaperSummarySchema.parse(res.data.find((r) => r.id === a))
      expect(row).toMatchObject({ code: 'K2', examBoard: 'johor', year: 2023, totalMarks: 1, budget: 1, durationMinutes: 90, questionCount: 1, schemeCount: 1, marks: 1 })
      const other = BijakBuilderPaperSummarySchema.parse(res.data.find((r) => r.id === b))
      expect(other).toMatchObject({ questionCount: 1, schemeCount: 0, budget: 2, examBoard: 'perak' })
    })

    it('filters kertas, year and negeri (by slug)', async () => {
      const ids = async (qs: string) => (await list(`&surface=subjektif${qs}`)).data.map((r) => r.id)
      expect(await ids('&kertas=4')).toEqual([b])
      expect(await ids('&year=2023')).toEqual([a])
      expect(await ids('&negeri=Johor')).toEqual([a])
      expect(await ids('&negeri=perak&year=2022&kertas=4')).toEqual([b])
      expect(await ids('&negeri=perak&year=2023')).toEqual([])
    })

    it('meta.counts = {total, published, withScheme} over the filtered set, total and published from the DB', async () => {
      const res = await list('&surface=subjektif')
      const dbTotal = (await q(`select count(*)::int n from papers where surface = 'subjektif'`))[0]!.n
      expect(res.meta.counts!.total).toBe(dbTotal)
      expect(res.meta.totalItems).toBe(dbTotal)
      expect(res.meta.counts!.published).toBe(0)
      expect((await list('&surface=subjektif&negeri=johor')).meta.counts).toEqual({ total: 1, published: 0, withScheme: 1 })
      expect((await list('&surface=subjektif&negeri=perak')).meta.counts).toEqual({ total: 1, published: 0, withScheme: 0 })
      // the status tab does not change the counts
      expect((await list('&surface=subjektif&negeri=johor&status=terbit')).meta.counts).toEqual({ total: 1, published: 0, withScheme: 1 })
    })

    it('a draft question and an MCQ with no key are not bersekema (count, row and Terbit gate agree)', async () => {
      const draft = await admin.post('/api/questions', { subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionType: 'essay', questionText: 'Soalan draf tanpa skema', kertas: '2', tag, parts: [{ label: 'a', mode: 'working', cognitiveLevel: 'mengaplikasi', prompt: { ms: 'Kira.' }, marks: 1, key: { kind: 'points', marks: 1, points: [{ id: 'p1', code: 'M', label: 'Kira', marks: 1, text: { ms: 'jawapan' } }] } }] })
      expect(draft.status, JSON.stringify(draft.body)).toBe(201)
      const draftId = draft.body.data.id as string
      await dropKey(draftId)
      const keyless = await question('mcq')
      await dropKey(keyless)
      const keyed = await question('mcq')
      const pd = await made({ title: 'Draf tanpa skema', kertas: 2, examBoard: 'Sabah', year: 2020, totalMarks: 1 })
      const pk = await made({ title: 'MCQ tanpa kunci', kertas: 2, examBoard: 'Sabah', year: 2020, totalMarks: 1 })
      const pg = await made({ title: 'Bersekema penuh', kertas: 2, examBoard: 'Sabah', year: 2020, totalMarks: 1 })
      const sid = await sectionOf(pd)
      await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [sid, draftId])
      expect((await place(pk, await sectionOf(pk), keyless)).status).toBe(201)
      expect((await place(pg, await sectionOf(pg), keyed)).status).toBe(201)
      const res = await list('&surface=subjektif&negeri=sabah')
      expect(res.meta.counts).toEqual({ total: 3, published: 0, withScheme: 1 })
      const schemeOf = (id: string) => (res.data.find((r) => r.id === id) as unknown as { schemeCount: number }).schemeCount
      expect([schemeOf(pd), schemeOf(pk), schemeOf(pg)]).toEqual([0, 0, 1])
      for (const [paper, qid] of [[pd, draftId], [pk, keyless]] as const) {
        const refused = await publish(paper)
        expect(refused.ok).toBe(false)
        expect(refused.blockerDetails?.some((b) => b.code === 'NO_SCHEME' && b.questionId === qid && !b.overridable)).toBe(true)
        expect(refused.errors).toContain(`Soalan ${qid} ${M.subjektifNoScheme}`)
      }
      expect((await publish(pg)).ok).toBe(true)
      expect((await list('&surface=subjektif&negeri=sabah')).meta.counts).toEqual({ total: 3, published: 1, withScheme: 1 })
    })
  })

  describe('update', () => {
    it('Negeri, Tempoh and Jumlah Markah change on a Kertas Subjektif; printed_duration_min follows', async () => {
      const id = await made({ title: 'Kemas kini', totalMarks: 5 })
      const res = await admin.put(`/api/admin/papers/${id}`, { examBoard: 'Kelantan', durationMinutes: 45, totalMarks: 6, title: 'Tajuk baharu', year: 2021 })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(BijakBuilderEditorSchema.parse(res.body.data).paper).toMatchObject({ examBoard: 'kelantan', durationMinutes: 45, durationMin: 45, totalMarks: 6, title: 'Tajuk baharu', year: 2021 })
      const untimed = await admin.put(`/api/admin/papers/${id}`, { durationMinutes: null })
      expect(untimed.status, JSON.stringify(untimed.body)).toBe(200)
      expect((await q(`select duration_minutes, printed_duration_min from papers where id = $1`, [id]))[0]).toEqual({ duration_minutes: null, printed_duration_min: 0 })
      const zero = await admin.put(`/api/admin/papers/${id}`, { durationMinutes: 0 })
      expect(zero.status).toBe(200)
      expect((await editor(id)).paper.durationMin).toBe(0)
    })

    it.each([
      ['empty title', { title: '  ' }, M.subjektifTitleRequired],
      ['title over 150', { title: 'y'.repeat(151) }, M.subjektifTitleTooLong],
      ['title over 200 still gets the 150 message', { title: 'y'.repeat(201) }, M.subjektifTitleTooLong],
      ['durationMin (the Simulasi key)', { durationMin: 30 }, M.durationRange],
      ['empty examBoard', { examBoard: '' }, M.examBoardRequired],
      ['Tempoh over 300', { durationMinutes: 301 }, M.durationRange],
      ['Jumlah Markah 0', { totalMarks: 0 }, M.totalMarksRange],
      ['Jumlah Markah 201', { totalMarks: 201 }, M.totalMarksRange],
    ])('422 on a Kertas Subjektif: %s', async (_n, body, message) => {
      const id = await made()
      const res = await admin.put(`/api/admin/papers/${id}`, body)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(JSON.stringify(res.body)).toContain(message)
    })

    it('code is ignored on a Kertas Subjektif (K{kertas} stays) and a copy is refused with 422', async () => {
      const id = await made({ title: 'Kod', kertas: 3 })
      const res = await admin.put(`/api/admin/papers/${id}`, { code: '9999/1' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(BijakBuilderEditorSchema.parse(res.body.data).paper.code).toBe('K3')
      expect((await q(`select paper_code from papers where id = $1`, [id]))[0]!.paper_code).toBeNull()
      const copy = await admin.post(`/api/admin/papers/${id}/copy`)
      expect(copy.status, JSON.stringify(copy.body)).toBe(422)
    })

    it('a Simulasi paper refuses Negeri, Tempoh and Jumlah Markah with 422', async () => {
      const sim = (await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })).body.data.id as string
      for (const body of [{ examBoard: 'Johor' }, { durationMinutes: 30 }, { totalMarks: 10 }]) {
        const res = await admin.put(`/api/admin/papers/${sim}`, body)
        expect(res.status, JSON.stringify(res.body)).toBe(422)
      }
      expect((await admin.put(`/api/admin/papers/${sim}`, { title: 'Tajuk simulasi 160 ' + 'z'.repeat(150) })).status).toBe(200)
    })
  })

  describe('publish, withdraw and delete', () => {
    it('refuses a paper with no placed question (hard, no Kontrak line)', async () => {
      const id = await made({ title: 'Kosong' })
      const res = await publish(id)
      expect(res).toMatchObject({ ok: false, errors: [M.subjektifNoContent.replace('{title}', 'Kosong')], canOverride: false })
      expect(res.blockerDetails?.[0]).toMatchObject({ code: 'NO_QUESTIONS', overridable: false })
      const forced = await publish(id, { override: true, reason: 'sebab yang sah' })
      expect(forced.ok).toBe(false)
      expect(await status(id)).toBe('draft')
    })

    it('refuses when Jumlah Markah differs from the placed marks, with a = Jumlah Markah and b = the sum', async () => {
      const id = await made({ title: 'Markah', totalMarks: 5 })
      expect((await place(id, await sectionOf(id), await question('mcq'))).status).toBe(201)
      const res = await publish(id)
      expect(res.ok).toBe(false)
      expect(res.errors).toEqual([M.totalMarksMismatch.replace('{a}', '5').replace('{b}', '1')])
      expect(res.blockerDetails?.[0]).toMatchObject({ code: 'TOTAL_MARKS_MISMATCH', overridable: false })
      expect(res.canOverride).toBe(false)
      expect(await status(id)).toBe('draft')
    })

    it('refuses a placed question with no scheme, naming it (FR-ADM-Q18.8); the override cannot lift it', async () => {
      const bad = await question('written')
      await dropKey(bad)
      const id = await made({ title: 'Tanpa skema', totalMarks: 2 })
      expect((await place(id, await sectionOf(id), bad)).status).toBe(201)
      const res = await publish(id)
      expect(res.ok).toBe(false)
      expect(res.errors).toEqual([`Soalan ${bad} ${M.subjektifNoScheme}`])
      expect(res.blockerDetails?.[0]).toMatchObject({ code: 'NO_SCHEME', overridable: false, questionId: bad })
      expect((await publish(id, { override: true, reason: 'sebab yang sah' })).ok).toBe(false)
      expect(await status(id)).toBe('draft')
      const review = (await admin.get(`/api/admin/papers/${id}/review`)).body.data as { blockers: string[]; canOverride: boolean }
      expect(review.blockers).toEqual(res.errors)
    })

    it('keeps the question-level gate: a question that is not Terbit blocks', async () => {
      const draft = await admin.post('/api/questions', { subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionType: 'mcq', questionText: 'Soalan draf', options: ['1', '2', '3', '4'], correctAnswer: 0, cognitiveLevel: 'mengaplikasi', kertas: '2', tag })
      expect(draft.status, JSON.stringify(draft.body)).toBe(201)
      const id = await made({ title: 'Soalan draf', totalMarks: 1 })
      const placed = await place(id, await sectionOf(id), draft.body.data.id as string)
      // The placement itself refuses a question that is not Terbit (existing rule), so the paper stays unpublishable.
      expect(placed.status).toBe(422)
      expect((await publish(id)).ok).toBe(false)
    })

    it('publishes with no Kontrak when the paper has content, a scheme and matching marks; then withdraw and delete work', async () => {
      const m = await question('mcq')
      const w = await question('written')
      const id = await made({ title: 'Boleh terbit', totalMarks: 3 })
      const sid = await sectionOf(id)
      expect((await place(id, sid, m)).status).toBe(201)
      expect((await place(id, sid, w)).status).toBe(201)
      const res = await publish(id)
      expect(res, JSON.stringify(res)).toMatchObject({ ok: true, errors: [] })
      expect(await status(id)).toBe('published')
      expect((await q(`select blueprint_id, standard_report from papers where id = $1`, [id]))[0]).toEqual({ blueprint_id: null, standard_report: null })
      // a published paper cannot be deleted; withdraw returns it to Draf
      expect((await admin.del(`/api/admin/papers/${id}`)).status).toBe(422)
      expect((await admin.post(`/api/admin/papers/${id}/withdraw`)).status).toBe(200)
      expect(await status(id)).toBe('withdrawn')
      expect((await editor(id)).paper.status).toBe('draf')
      // Terbit again, then withdraw and Padam
      expect((await publish(id)).ok).toBe(true)
      expect((await list2()).meta.counts!.published).toBeGreaterThanOrEqual(1)
      expect((await admin.post(`/api/admin/papers/${id}/withdraw`)).status).toBe(200)
      expect((await admin.del(`/api/admin/papers/${id}`)).status).toBe(200)
      expect((await q(`select 1 from papers where id = $1`, [id])).length).toBe(0)
      expect((await admin.get(`/api/admin/papers/${id}`)).status).toBe(404)
    })

    it('Padam deletes a Draf Kertas Subjektif', async () => {
      const id = await made({ title: 'Padam saya' })
      expect((await admin.del(`/api/admin/papers/${id}`)).status).toBe(200)
      expect((await q(`select 1 from papers where id = $1`, [id])).length).toBe(0)
    })

    async function list2() {
      return (await admin.get('/api/admin/papers?surface=subjektif&pageSize=100')).body as { meta: { counts: Record<string, number> } }
    }
  })
})
