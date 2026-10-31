import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BIJAK_BUILDER_MESSAGES as MSG,
  BIJAK_BUILDER_PLACEMENT_LINES as PLACE,
  BijakBuilderEditorSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPlacementResultSchema,
  BijakBuilderPublishResultSchema,
  BijakBuilderReviewSchema,
  BijakBuilderStudentViewSchema,
  BijakPaperCoverSchema,
  BijakPoolPreviewSchema,
  envelopeOf,
  listEnvelopeOf,
  BijakBuilderPoolUnitSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { BijakPoolSource } from '../../src/modules/bijak/papers'
import { PapersService } from '../../src/modules/bijak/papers'
import type { LeafFact, QuestionFacts } from '../../src/modules/bijak/papers/exam-core.adapter'
import type { BijakPoolScope } from '../../src/modules/bijak/papers/ports'
import { FakeBank, matBank } from './fakes'
import { ACCOUNTS, bootBuilderApp, count, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Placement = envelopeOf(BijakBuilderPlacementResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)
const Review = envelopeOf(BijakBuilderReviewSchema)
const StudentView = envelopeOf(BijakBuilderStudentViewSchema)
const Pool = listEnvelopeOf(BijakBuilderPoolUnitSchema)
const Preview = envelopeOf(BijakPoolPreviewSchema)
const Cover = envelopeOf(BijakPaperCoverSchema)

// Several tests build a whole paper (7+ requests); the shared test host can be slow.
vi.setConfig({ testTimeout: 120_000 })

/** Pool facts for the fake bank: what `bijak-pool.ts` returns in production (no content, no keys). */
class FakePool implements BijakPoolSource {
  /** question id -> facts overrides; absent from `ids` = not a candidate. */
  ids = new Set<string>()
  noKey = new Set<string>()
  tags: Record<string, string[]> = {}
  constructor(private readonly bank: Record<string, { marks: number; group?: string; position?: number; size?: number }>) {}

  async candidates(_scope: BijakPoolScope): Promise<QuestionFacts[]> {
    void _scope
    return [...this.ids].map((id) => {
      const q = this.bank[id]!
      const leaf: LeafFact = { marks: q.marks, mode: 'mcq', tp: 2, kbat: false, hasKey: !this.noKey.has(id), unit: { nodeId: '9001', level: 'T4', code: '1.0' } }
      return {
        id,
        groupId: q.group ?? null,
        groupPosition: q.position ?? null,
        ...(q.group ? { groupSize: q.size ?? 2 } : {}),
        versionNo: 1,
        tagReview: false,
        unit: { nodeId: '9001', level: 'T4' as const, code: '1.0' },
        formOrigin: 't4' as const,
        pools: this.tags[id] ?? [],
        leaves: [leaf],
      }
    })
  }
  async seen(): Promise<ReadonlySet<string>> {
    return new Set()
  }
}

const FACTS = {
  '700001': { marks: 1 },
  '700002': { marks: 1 },
  '700003': { marks: 1 },
  '700004': { marks: 1 },
  '700005': { marks: 2 },
  '700006': { marks: 2 },
  '700007': { marks: 1 },
  '700008': { marks: 2 },
  '700009': { marks: 1 },
  '700021': { marks: 1, group: '800001', position: 1 },
  '700022': { marks: 1, group: '800001', position: 2 },
}

describe('paper builder R1-B09a: placements, D90 groups, review, publish, copy, generate', () => {
  let t: BuilderTestApp
  let bank: FakeBank
  let pool: FakePool
  let admin: Client
  let student: Client
  let poolTags: [string, string, string]

  beforeAll(async () => {
    bank = matBank()
    // A group whose second member is not servable (D90: the whole group is refused).
    bank.add({ id: '700031', marks: 1, groupId: '800002' }).add({ id: '700032', marks: 1, groupId: '800002', status: 'draft' }).addGroup('800002', ['700031', '700032'])
    // A servable question that is archived/in review, and an 'approved' one (the new servable status).
    bank.add({ id: '700012', marks: 1, status: 'archived' }).add({ id: '700013', marks: 1, status: 'review' }).add({ id: '700014', marks: 1, status: 'approved' })
    pool = new FakePool(FACTS)
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank })
    t.papersPorts.providePoolSource(pool)
    admin = await loginAs(t, ACCOUNTS.admin)
    student = await loginAs(t, ACCOUNTS.student)
    const tags = await t.db.query<{ pool: string }>(
      `select s.pool from blueprint_sections s join blueprints b on b.id = s.blueprint_id where b.code = '1449/2' and b.status = 'active' order by s.position`,
    )
    poolTags = [tags[0]!.pool, tags[1]!.pool, tags[2]!.pool]
  })
  afterAll(async () => {
    await t.close()
  })

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)

  async function newPaper(): Promise<string> {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Created.parse(res.body).data.id
  }
  async function editor(id: string) {
    const res = await admin.get(`/api/admin/papers/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Editor.parse(res.body).data
  }
  async function sections(id: string): Promise<[string, string, string]> {
    const e = await editor(id)
    return [e.paper.sections[0]!.id, e.paper.sections[1]!.id, e.paper.sections[2]!.id]
  }
  async function place(id: string, sectionId: string, questionId: string) {
    return admin.post(`/api/admin/papers/${id}/placements`, { sectionId, questionId })
  }
  async function placeOk(id: string, sectionId: string, questionId: string) {
    const res = await place(id, sectionId, questionId)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Placement.parse(res.body).data
  }
  async function fullPaper(): Promise<string> {
    const id = await newPaper()
    const [a, b, c] = await sections(id)
    for (const qid of ['700001', '700002', '700003']) await placeOk(id, a, qid)
    await placeOk(id, b, '700004')
    for (const qid of ['700005', '700006']) await placeOk(id, c, qid)
    return id
  }
  const publish = async (id: string) => {
    const res = await admin.post(`/api/admin/papers/${id}/publish`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Publish.parse(res.body).data
  }
  const ids = (e: Awaited<ReturnType<typeof editor>>, i: number) => e.paper.sections[i]!.questionIds

  describe('placements and servability', () => {
    it('builds a paper from approved questions, reviews it, Terbit; the student lists, opens and can sit it', async () => {
      const id = await newPaper()
      const [a, b, c] = await sections(id)
      // 700014 is 'approved' (the new servable status) and is accepted like a Terbit one.
      await placeOk(id, a, '700014')
      await placeOk(id, a, '700001')
      await placeOk(id, a, '700002')
      await placeOk(id, b, '700004')
      await placeOk(id, c, '700005')
      await placeOk(id, c, '700006')

      const review = Review.parse((await admin.get(`/api/admin/papers/${id}/review`)).body).data
      expect(review).toMatchObject({ ok: true, blockers: [], status: 'draf', visibleToStudents: false, totalMarks: 6, totalBudget: 6 })
      expect(review.rows).toHaveLength(6)
      expect(review.rows.every((r) => r.ok)).toBe(true)

      // not visible yet
      const listBefore = (await student.get('/api/bijak/papers')).body.data as { id: string }[]
      expect(listBefore.some((p) => p.id === id)).toBe(false)

      expect((await publish(id)).ok).toBe(true)
      const list = (await student.get('/api/bijak/papers')).body.data as { id: string; questionCount: number; marks: number }[]
      expect(list.find((p) => p.id === id)).toMatchObject({ questionCount: 6, marks: 6 })
      const cover = Cover.parse((await student.get(`/api/bijak/papers/${id}`)).body).data
      expect(cover.sections.map((s) => s.questionCount)).toEqual([3, 1, 2])
      const sittable = await t.app.get(PapersService).getSittablePaper(student.userId, id)
      expect(sittable.sections[0]!.questionIds).toEqual(['700014', '700001', '700002'])
      // versions pinned at publish
      const pins = await q(`select question_id::text qid, pinned_version_no v, marks_override m from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by s.position, pl.position`, [id])
      expect(pins.map((p) => [p.qid, p.v, p.m])).toEqual([['700014', 1, 1], ['700001', 1, 1], ['700002', 1, 1], ['700004', 1, 1], ['700005', 1, 2], ['700006', 1, 2]])
      expect((await q('select count(*)::int n from audit_events where action = $1 and target_id = $2', ['bijak.paper.published', id]))[0]!.n).toBe(1)
    })

    it('an unpublished paper (draft, or withdrawn) is invisible to the student', async () => {
      const id = await fullPaper()
      expect(((await student.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => p.id === id)).toBe(false)
      expect((await student.get(`/api/bijak/papers/${id}`)).status).toBe(404)
      expect((await publish(id)).ok).toBe(true)
      expect((await student.get(`/api/bijak/papers/${id}`)).status).toBe(200)
      expect((await admin.post(`/api/admin/papers/${id}/withdraw`)).status).toBe(200)
      expect(((await student.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => p.id === id)).toBe(false)
      expect((await student.get(`/api/bijak/papers/${id}`)).status).toBe(404)
      // back to draf: editable again
      expect((await admin.put(`/api/admin/papers/${id}`, { title: 'Disunting semula' })).status).toBe(200)
    })

    it('refuses a question that is not servable, with a BM reason; nothing is stored', async () => {
      const id = await newPaper()
      const [a] = await sections(id)
      expectError(await place(id, a, '700010'), 'VALIDATION_ERROR', 422, PLACE.notServable('700010', PLACE.statusDraft))
      expectError(await place(id, a, '700012'), 'VALIDATION_ERROR', 422, PLACE.notServable('700012', PLACE.statusArchived))
      expectError(await place(id, a, '700013'), 'VALIDATION_ERROR', 422, PLACE.notServable('700013', PLACE.statusReview))
      expectError(await place(id, a, '700011'), 'VALIDATION_ERROR', 422, PLACE.notServable('700011', PLACE.otherSubject))
      expectError(await place(id, a, '999999'), 'VALIDATION_ERROR', 422, MSG.invalidQuestion)
      expectError(await place(id, '999999', '700001'), 'VALIDATION_ERROR', 422, MSG.invalidSection)
      expect(ids(await editor(id), 0)).toEqual([])
    })

    it('refuses a question that is already on the paper, and any edit of a Terbit paper', async () => {
      const id = await fullPaper()
      const [a, b] = await sections(id)
      expectError(await place(id, b, '700001'), 'VALIDATION_ERROR', 422, PLACE.alreadyPlaced('700001'))
      expect((await publish(id)).ok).toBe(true)
      expectError(await place(id, a, '700007'), 'VALIDATION_ERROR', 422, MSG.paperLocked)
      expectError(await admin.del(`/api/admin/papers/${id}/placements/700001`), 'VALIDATION_ERROR', 422, MSG.paperLocked)
      expectError(await admin.put(`/api/admin/papers/${id}/sections/${a}/order`, { order: ['700001', '700002', '700003'] }), 'VALIDATION_ERROR', 422, MSG.paperLocked)
    })

    it('needs the admin role and the CSRF header (student 403, no CSRF 403)', async () => {
      const id = await newPaper()
      const [a] = await sections(id)
      expect((await student.post(`/api/admin/papers/${id}/placements`, { sectionId: a, questionId: '700001' })).status).toBe(403)
      expect((await admin.noCsrf('post', `/api/admin/papers/${id}/placements`, { sectionId: a, questionId: '700001' })).status).toBe(403)
      expect((await student.get(`/api/admin/papers/${id}/review`)).status).toBe(403)
      expect((await student.post(`/api/admin/papers/${id}/copy`)).status).toBe(403)
      expect((await student.post('/api/admin/papers/generate', { subject: 'MAT', kertas: 2 })).status).toBe(403)
    })

    it('writes the audit rows of the placement operations', async () => {
      const id = await newPaper()
      const [a] = await sections(id)
      await placeOk(id, a, '700001')
      const rows = await q(`select detail->>'op' op from audit_events where action = 'bijak.paper.updated' and target_id = $1`, [id])
      expect(rows.map((r) => r.op)).toContain('place')
    })
  })

  describe('D90: a stimulus group is one unit', () => {
    it('placing ONE member places the whole group, contiguous in group order', async () => {
      const id = await newPaper()
      const [a] = await sections(id)
      await placeOk(id, a, '700001')
      const r = await placeOk(id, a, '700022') // the second member
      expect(r.added).toEqual(['700021', '700022'])
      expect(ids(r.editor, 0)).toEqual(['700001', '700021', '700022'])
      // the group cannot be placed again, nor a single member of it
      expectError(await place(id, a, '700021'), 'VALIDATION_ERROR', 422, PLACE.alreadyPlaced('700021'))
    })

    it('a group with a member that is not servable is refused whole, naming the member', async () => {
      const id = await newPaper()
      const [a] = await sections(id)
      expectError(await place(id, a, '700031'), 'VALIDATION_ERROR', 422, PLACE.groupNotServable('800002', '700032', PLACE.statusDraft))
      expect(ids(await editor(id), 0)).toEqual([])
    })

    it('removing one member removes the whole group', async () => {
      const id = await newPaper()
      const [a] = await sections(id)
      await placeOk(id, a, '700001')
      await placeOk(id, a, '700021')
      const r = Placement.parse((await admin.del(`/api/admin/papers/${id}/placements/700022`)).body).data
      expect(r.removed).toEqual(['700021', '700022'])
      expect(ids(r.editor, 0)).toEqual(['700001'])
      expectError(await admin.del(`/api/admin/papers/${id}/placements/700022`), 'VALIDATION_ERROR', 422, PLACE.notPlaced('700022'))
    })

    it('reordering moves the group as a unit and keeps it contiguous and in order', async () => {
      const id = await newPaper()
      const [a] = await sections(id)
      await placeOk(id, a, '700001')
      await placeOk(id, a, '700021')
      await placeOk(id, a, '700002')
      expect(ids(await editor(id), 0)).toEqual(['700001', '700021', '700022', '700002'])
      // name the group by its SECOND member, in front
      const res = await admin.put(`/api/admin/papers/${id}/sections/${a}/order`, { order: ['700022', '700002', '700001'] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(ids(Placement.parse(res.body).data.editor, 0)).toEqual(['700021', '700022', '700002', '700001'])
      // a list that omits a unit, repeats one or names an unknown id is refused; nothing changes
      for (const order of [['700001', '700002'], ['700001', '700001', '700002'], ['700001', '700002', '999999'], ['700021', '700022', '700001', '700002']]) {
        expectError(await admin.put(`/api/admin/papers/${id}/sections/${a}/order`, { order }), 'VALIDATION_ERROR', 422, PLACE.orderMismatch)
      }
      expect(ids(await editor(id), 0)).toEqual(['700021', '700022', '700002', '700001'])
    })

    it('the student view shows the stimulus ONCE with both questions; marks are the sum of the members', async () => {
      const id = await newPaper()
      const [a, b, c] = await sections(id)
      await placeOk(id, a, '700001')
      await placeOk(id, a, '700021')
      await placeOk(id, b, '700004')
      await placeOk(id, c, '700005')
      await placeOk(id, c, '700006')
      const view = StudentView.parse((await admin.get(`/api/admin/papers/${id}/student-view`)).body).data
      const units = view.sections[0]!.units
      expect(units).toHaveLength(2)
      expect(units[1]).toMatchObject({ groupId: '800001' })
      expect(units[1]!.stimulus).toBeDefined()
      expect(units[1]!.questions.map((x) => [x.id, x.number, x.marks])).toEqual([['700021', 2, 1], ['700022', 3, 1]])
      expect(view.sections[0]!.marks).toBe(3)
      expect(view.questionCount).toBe(6)
      expect(JSON.stringify(view)).not.toMatch(/scheme|answerKey|correct/i)
    })

    it('a PUT with a lone member brings the whole group; the publish check flags legacy data that split a group', async () => {
      const id = await fullPaper()
      const [a] = await sections(id)
      // legacy rows: the first member only (written by SQL, the API can no longer produce this)
      await q('delete from paper_placements where paper_section_id = $1', [a])
      await q('insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, 700001, 1, 1), ($1, 700021, 1, 2), ($1, 700002, 1, 3)', [a])
      const review = Review.parse((await admin.get(`/api/admin/papers/${id}/review`)).body).data
      expect(review.ok).toBe(false)
      expect(review.blockers).toContain(LINES.sectionLine('Bahagian A', LINES.groupIncomplete('800001', 1)))
      const pub = await publish(id)
      expect(pub.ok).toBe(false)
    })

    it('the section pool offers a group as ONE unit with the stimulus once', async () => {
      pool.ids = new Set(Object.keys(FACTS))
      pool.tags = {}
      const id = await newPaper()
      const [a] = await sections(id)
      await placeOk(id, a, '700001')
      const res = await admin.get(`/api/admin/papers/${id}/sections/${a}/pool?pageSize=100`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const units = Pool.parse(res.body).data
      const group = units.find((u) => u.groupId === '800001')!
      expect(group.questionIds).toEqual(['700021', '700022'])
      expect(group.stimulus).toBeDefined()
      expect(group.marks).toBe(2)
      expect(units.find((u) => u.questionIds.includes('700001'))!.placed).toBe(true)
      expect(units.filter((u) => u.questionIds.includes('700022'))).toHaveLength(1)
      // filters: level and DSKP unit
      const none = Pool.parse((await admin.get(`/api/admin/papers/${id}/sections/${a}/pool?level=t5`)).body)
      expect(none.data).toHaveLength(0)
      const byUnit = Pool.parse((await admin.get(`/api/admin/papers/${id}/sections/${a}/pool?unit=9001&level=t4`)).body)
      expect(byUnit.meta.totalItems).toBe(units.length)
      expectError(await admin.get(`/api/admin/papers/${id}/sections/999999/pool`), 'VALIDATION_ERROR', 422, MSG.invalidSection)
    })
  })

  describe('publish check (structural tier), pinning, copy, header', () => {
    it('a placed question that is not eligible blocks Terbit with a BM line; standard-tier findings never block', async () => {
      pool.ids = new Set(Object.keys(FACTS))
      pool.tags = {}
      pool.noKey = new Set(['700001'])
      const id = await fullPaper()
      const pub = await publish(id)
      expect(pub.ok).toBe(false)
      expect(pub.errors).toEqual([LINES.sectionLine('Bahagian A', LINES.ineligible('700001', 'tiada kunci jawapan'))])
      pool.noKey = new Set()
      const ok = await publish(id)
      expect(ok).toMatchObject({ ok: true, errors: [] })
      const report = await q('select standard_report from papers where id = $1', [id])
      expect(report[0]!.standard_report).toMatchObject({ blueprintVersion: 1 })
    })

    it('pinned versions stay after a question edit; a draft pins the version in force when placed', async () => {
      const v2 = bank.edit('700003', { marks: 1 }) // version 2 before the paper is built
      expect(v2).toBe(2)
      const id = await fullPaper()
      const pin = async (qid: string) => (await q('select pinned_version_no v from paper_placements where question_id = $1 and paper_section_id in (select id from paper_sections where paper_id = $2)', [qid, id]))[0]!.v
      expect(await pin('700003')).toBe(2)
      expect((await publish(id)).ok).toBe(true)
      const marksBefore = Cover.parse((await student.get(`/api/bijak/papers/${id}`)).body).data.marks
      bank.edit('700001', { marks: 3 }) // version 2 of a placed question
      expect(await pin('700001')).toBe(1)
      expect(Cover.parse((await student.get(`/api/bijak/papers/${id}`)).body).data.marks).toBe(marksBefore)
      bank.edit('700001', { marks: 1 }) // restore the marks so later papers conform again
    })

    it('Salin set: a new draf with the same sections and questions, titled "(Salinan)", nothing pinned', async () => {
      const id = await fullPaper()
      expect((await publish(id)).ok).toBe(true)
      const before = (await editor(id)).paper
      const res = await admin.post(`/api/admin/papers/${id}/copy`)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const copyId = Created.parse(res.body).data.id
      const copy = (await editor(copyId)).paper
      expect(copy.title).toBe(`${before.title}${PLACE.copySuffix}`)
      expect(copy.status).toBe('draf')
      expect(copy.sections.map((s) => s.questionIds)).toEqual(before.sections.map((s) => s.questionIds))
      expect(copy.sections.map((s) => s.label)).toEqual(before.sections.map((s) => s.label))
      expect((await q('select count(*)::int n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 and pl.marks_override is not null', [copyId]))[0]!.n).toBe(0)
      expect(((await student.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => p.id === copyId)).toBe(false)
      expect((await publish(copyId)).ok).toBe(true)
      expectError(await admin.post('/api/admin/papers/999999/copy'), 'NOT_FOUND')
    })

    it('updates the header: title, year, duration and the cover instructions', async () => {
      const id = await newPaper()
      const res = await admin.put(`/api/admin/papers/${id}`, { title: 'Set Percubaan A', year: 2026, durationMin: 120, instructions: ['Jawab semua soalan.', 'Tulis dengan jelas.'] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(Editor.parse(res.body).data.paper).toMatchObject({ title: 'Set Percubaan A', year: 2026, durationMin: 120, instructions: ['Jawab semua soalan.', 'Tulis dengan jelas.'] })
      expect((await admin.put(`/api/admin/papers/${id}`, { instructions: [''] })).status).toBe(422)
    })
  })

  describe('Pratonton kolam and admin generate (exact or refuse)', () => {
    function setPools(available: { a: string[]; b: string[]; c: string[] }) {
      pool.ids = new Set([...available.a, ...available.b, ...available.c])
      pool.tags = {}
      const add = (list: string[], tag: string) => list.forEach((id) => (pool.tags[id] = [...(pool.tags[id] ?? []), tag]))
      add(available.a, poolTags[0])
      add(available.b, poolTags[1])
      add(available.c, poolTags[2])
    }
    const generate = () => admin.post('/api/admin/papers/generate', { subject: 'MAT', kertas: 2 })

    it('fills a DRAFT paper exactly from the blueprint; a stimulus group is one unit and its marks are summed', async () => {
      // Bahagian A has exactly the single 700001 and the group 700021+700022: the group must come whole.
      setPools({ a: ['700001', '700021', '700022'], b: ['700004'], c: ['700005', '700006'] })
      const res = await generate()
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const paperId = (res.body.data as { paperId: string }).paperId
      const e = await editor(paperId)
      expect(e.paper.status).toBe('draf')
      expect([...ids(e, 0)].sort()).toEqual(['700001', '700021', '700022'])
      const a = ids(e, 0)
      expect(a.indexOf('700022')).toBe(a.indexOf('700021') + 1) // contiguous, in group order
      expect(ids(e, 1)).toEqual(['700004'])
      expect([...ids(e, 2)].sort()).toEqual(['700005', '700006'])
      const row = (await q('select status, standard_report is not null has_report from papers where id = $1', [paperId]))[0]!
      expect(row).toEqual({ status: 'draft', has_report: true })
      // never visible until Terbit; and it passes the publish check
      expect(((await student.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => p.id === paperId)).toBe(false)
      const review = Review.parse((await admin.get(`/api/admin/papers/${paperId}/review`)).body).data
      expect(review).toMatchObject({ ok: true, totalMarks: 6 })
      expect((await publish(paperId)).ok).toBe(true)
    })

    it('a pool that is one question short refuses with the shortage report and creates nothing', async () => {
      // A group counts as ONE unit: with the single plus an incomplete group (one member missing) only 1 of 3 is usable.
      setPools({ a: ['700001', '700021'], b: ['700004'], c: ['700005', '700006'] })
      const before = await count(t.db, `select count(*) n from papers where kind = 'pilihan'`)
      const res = await generate()
      const err = expectError(res, 'SHORTAGE', 422)
      const shortages = (err.details as { shortages: { section: string; need: number; have: number }[] }).shortages
      expect(shortages[0]).toMatchObject({ section: 'Bahagian A', need: 3 })
      expect(shortages[0]!.have).toBeLessThan(3)
      expect(await count(t.db, `select count(*) n from papers where kind = 'pilihan'`)).toBe(before)

      const preview = Preview.parse((await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=2')).body).data
      expect(preview.verdict).toBe('tidak_boleh')
      expect(preview.firstFailure).toMatchObject({ section: 'Bahagian A' })
      expect(preview.sections).toHaveLength(3)
      expect(preview.sections[0]!.counts.short).toBeGreaterThan(0)
    })

    it('Pratonton kolam says boleh on a sufficient pool; 404 without a blueprint; 422 on a bad query', async () => {
      setPools({ a: ['700001', '700002', '700003'], b: ['700004'], c: ['700005', '700006'] })
      const preview = Preview.parse((await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=2')).body).data
      expect(preview).toMatchObject({ verdict: 'boleh', firstFailure: null, publishedTotal: 6 })
      expect(preview.sections.map((s) => s.counts.short)).toEqual([0, 0, 0])
      expectError(await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=9'), 'NOT_FOUND', 404)
      expectError(await admin.get('/api/admin/papers/pool-preview?subject=MAT'), 'VALIDATION_ERROR', 422)
      expect((await student.get('/api/admin/papers/pool-preview?subject=MAT&kertas=2')).status).toBe(403)
      expectError(await admin.post('/api/admin/papers/generate', { subject: 'MAT', kertas: 9 }), 'NO_BLUEPRINT', 422)
      expectError(await admin.post('/api/admin/papers/generate', { subject: 'MAT' }), 'VALIDATION_ERROR', 422)
    })
  })
})
