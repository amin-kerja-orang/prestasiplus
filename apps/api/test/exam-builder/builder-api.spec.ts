import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BIJAK_BUILDER_MESSAGES as MSG,
  BijakBuilderEditorSchema,
  BijakBuilderOkSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPreviewSchema,
  BijakBuilderPublishResultSchema,
  envelopeOf,
  listEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FakeBank, matBank } from './fakes'
import { ACCOUNTS, auditRows, bootBuilderApp, count, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)
const Ok = envelopeOf(BijakBuilderOkSchema)
const Summaries = listEnvelopeOf(BijakBuilderPaperSummarySchema)
const Preview = envelopeOf(BijakBuilderPreviewSchema)

const A = ['700001', '700002', '700003']
const B = ['700004']
const C = ['700005', '700006']

interface Lists {
  A: string[]
  B: string[]
  C: string[]
}

describe('paper builder API', () => {
  let t: BuilderTestApp
  let bank: FakeBank
  let admin: Client
  let student: Client

  beforeAll(async () => {
    bank = matBank()
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank })
    admin = await loginAs(t, ACCOUNTS.admin)
    student = await loginAs(t, ACCOUNTS.student)
  })
  afterAll(async () => {
    await t.close()
  })

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)

  async function newPaper(body: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, ...body })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Created.parse(res.body).data.id
  }
  async function editor(id: string) {
    const res = await admin.get(`/api/admin/papers/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Editor.parse(res.body).data
  }
  async function fill(id: string, lists: Lists) {
    const e = await editor(id)
    const [sa, sb, sc] = e.paper.sections
    const res = await admin.put(`/api/admin/papers/${id}`, {
      sections: [
        { id: sa!.id, questionIds: lists.A },
        { id: sb!.id, questionIds: lists.B },
        { id: sc!.id, questionIds: lists.C },
      ],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Editor.parse(res.body).data
  }
  async function publish(id: string) {
    const res = await admin.post(`/api/admin/papers/${id}/publish`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Publish.parse(res.body).data
  }
  const dbStatus = async (id: string) => (await q('select status from papers where id = $1', [id]))[0]?.status

  describe('AC1 assembling a draft', () => {
    it('creates a draft from the MAT kertas 2 blueprint, places questions in order and shows them in the editor and the list', async () => {
      const id = await newPaper()
      const empty = await editor(id)
      expect(empty.blueprint?.code).toBe('1449/2')
      expect(empty.paper).toMatchObject({ subject: 'MAT', kertas: 2, code: '1449/2', status: 'draf', durationMin: 150 })
      expect(empty.paper.title).toBe(`Percubaan SPM ${empty.blueprint!.subjectName} Kertas 2 (draf)`)
      expect(empty.paper.sections.map((s) => [s.label, s.questionCount, s.markBudget, s.questionIds.length])).toEqual([
        ['Bahagian A', 3, 3, 0],
        ['Bahagian B', 1, 1, 0],
        ['Bahagian C', 2, 2, 0],
      ])
      expect(empty.paper.sections[2]!.rule).toEqual({ type: 'choose', n: 1 })
      expect(empty.paper.reference?.[0]?.title).toBe('Rumus (ringkas)')
      // candidates are the published MAT kertas 2 questions only
      const ids = empty.questions.map((x) => x.id)
      expect(ids).toContain('700001')
      expect(ids).not.toContain('700010')
      expect(ids).not.toContain('700011')

      const filled = await fill(id, { A: ['700003', '700001', '700002'], B, C })
      expect(filled.paper.sections.map((s) => s.questionIds)).toEqual([['700003', '700001', '700002'], B, C])
      expect(filled.paper.status).toBe('draf')
      expect((await editor(id)).paper.sections[0]!.questionIds).toEqual(['700003', '700001', '700002'])

      const list = Summaries.parse((await admin.get('/api/admin/papers?status=draf')).body)
      const row = list.data.find((r) => r.id === id)
      expect(row).toMatchObject({ questionCount: 6, marks: 6, budget: 6, ok: true, status: 'draf', subject: 'MAT', code: '1449/2' })
    })

    it('summary of a non-conforming paper has ok false and the marks and budget', async () => {
      const id = await newPaper()
      await fill(id, { A: ['700001'], B: [], C: [] })
      const row = Summaries.parse((await admin.get('/api/admin/papers?status=draf')).body).data.find((r) => r.id === id)
      expect(row).toMatchObject({ questionCount: 1, marks: 1, budget: 6, ok: false })
    })

    /**
     * D90: the API never stores a split group (PUT/placements normalize it). A broken group can only exist as
     * legacy data, so the group cases write the rows with SQL and the publish check must still flag them.
     */
    async function fillRaw(id: string, lists: Lists) {
      const e = await editor(id)
      const all = [lists.A, lists.B, lists.C]
      for (const [i, s] of e.paper.sections.entries()) {
        await q('delete from paper_placements where paper_section_id = $1', [s.id])
        for (const [pos, qid] of (all[i] ?? []).entries()) {
          await q('insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)', [s.id, qid, pos + 1])
        }
      }
    }
    const cases: { rule: string; lists: Lists; lines: string[]; raw?: boolean }[] = [
      {
        rule: 'too few questions',
        lists: { A: ['700001', '700002'], B, C },
        lines: [LINES.sectionLine('Bahagian A', LINES.tooFew(3, 2)), LINES.sectionLine('Bahagian A', LINES.marksMismatch(2, 3))],
      },
      {
        rule: 'too many questions',
        lists: { A: [...A, '700007'], B, C },
        lines: [LINES.sectionLine('Bahagian A', LINES.tooMany(3, 4)), LINES.sectionLine('Bahagian A', LINES.marksMismatch(4, 3))],
      },
      {
        rule: 'marks budget',
        lists: { A: ['700001', '700002', '700008'], B, C },
        lines: [LINES.sectionLine('Bahagian A', LINES.marksMismatch(4, 3))],
      },
      {
        rule: 'choose-N (the largest N must reach the budget)',
        lists: { A, B, C: ['700007', '700009'] },
        lines: [LINES.sectionLine('Bahagian C', LINES.marksMismatch(1, 2))],
      },
      {
        rule: 'stimulus group split between sections',
        lists: { A: ['700001', '700002', '700021'], B: ['700022'], C },
        raw: true,
        lines: [
          LINES.groupSplit('800001'),
          LINES.sectionLine('Bahagian A', LINES.groupIncomplete('800001', 1)),
          LINES.sectionLine('Bahagian B', LINES.groupIncomplete('800001', 1)),
        ],
      },
      {
        rule: 'group not consecutive',
        lists: { A: ['700021', '700001', '700022'], B, C },
        raw: true,
        lines: [LINES.sectionLine('Bahagian A', LINES.groupNotConsecutive('800001'))],
      },
      {
        rule: 'group incomplete',
        lists: { A: ['700001', '700002', '700021'], B, C },
        raw: true,
        lines: [LINES.sectionLine('Bahagian A', LINES.groupIncomplete('800001', 1))],
      },
      {
        rule: 'group out of order (D90)',
        lists: { A: ['700001', '700022', '700021'], B, C },
        raw: true,
        lines: [LINES.sectionLine('Bahagian A', LINES.groupOutOfOrder('800001'))],
      },
      {
        rule: 'question not Terbit',
        lists: { A: ['700001', '700002', '700010'], B, C },
        lines: [LINES.sectionLine('Bahagian A', LINES.notPublished(1))],
      },
      {
        rule: 'question repeated across sections',
        lists: { A, B: ['700001'], C },
        lines: [LINES.duplicateQuestion(['700001'])],
      },
    ]
    it.each(cases)('publish refuses a paper that breaks: $rule', async ({ lists, lines, raw }) => {
      const id = await newPaper()
      if (raw) await fillRaw(id, lists)
      else await fill(id, lists) // saving is accepted, publish reports
      const before = await count(t.db, `select count(*) n from audit_events where action = 'bijak.paper.published'`)
      const res = await admin.post(`/api/admin/papers/${id}/publish`)
      expect(res.status).toBe(200)
      expect(Publish.parse(res.body).data).toEqual({ ok: false, errors: lines })
      expect(await dbStatus(id)).toBe('draft')
      expect(await count(t.db, `select count(*) n from audit_events where action = 'bijak.paper.published'`)).toBe(before)
      const pinned = await count(t.db, `select count(*) n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 and pl.marks_override is not null`, [id])
      expect(pinned).toBe(0)
    })

    it('an empty paper lists every section gap', async () => {
      const id = await newPaper()
      const res = await admin.post(`/api/admin/papers/${id}/publish`)
      expect(Publish.parse(res.body).data.errors).toEqual([
        LINES.sectionLine('Bahagian A', LINES.tooFew(3, 0)),
        LINES.sectionLine('Bahagian A', LINES.marksMismatch(0, 3)),
        LINES.sectionLine('Bahagian B', LINES.tooFew(1, 0)),
        LINES.sectionLine('Bahagian B', LINES.marksMismatch(0, 1)),
        LINES.sectionLine('Bahagian C', LINES.tooFew(2, 0)),
        LINES.sectionLine('Bahagian C', LINES.marksMismatch(0, 2)),
      ])
    })
  })

  describe('AC2 publish pins versions', () => {
    it('publishes a conforming paper, pins versions and marks, and a later question edit changes nothing the student or editor sees', async () => {
      const id = await newPaper({ title: '  Set Pin  ' })
      await fill(id, { A, B, C })
      expect(await publish(id)).toEqual({ ok: true, errors: [] })
      expect(await dbStatus(id)).toBe('published')
      const rows = await q(
        `select pl.question_id::text qid, pl.pinned_version_no v, pl.marks_override m from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by s.position, pl.position`,
        [id],
      )
      expect(rows.map((r) => [r.qid, r.v, r.m])).toEqual([
        ['700001', 1, 1],
        ['700002', 1, 1],
        ['700003', 1, 1],
        ['700004', 1, 1],
        ['700005', 1, 2],
        ['700006', 1, 2],
      ])
      const before = (await q('select updated_at from papers where id = $1', [id]))[0]!.updated_at

      // the question is edited: version 2 with other marks
      expect(bank.edit('700001', { marks: 5 })).toBe(2)

      const e = await editor(id)
      expect(e.questions.find((x) => x.id === '700001')?.marks).toBe(1)
      expect(e.paper.status).toBe('terbit')
      const listRow = Summaries.parse((await admin.get('/api/admin/papers?status=terbit')).body).data.find((r) => r.id === id)
      expect(listRow).toMatchObject({ marks: 6, ok: true })

      const studentList = (await student.get('/api/bijak/papers')).body.data as { id: string; marks: number; title: string }[]
      expect(studentList.find((p) => p.id === id)).toMatchObject({ marks: 6, title: 'Set Pin' })
      const cover = (await student.get(`/api/bijak/papers/${id}`)).body.data as { marks: number; sections: { label: string; marks: number }[] }
      expect(cover.marks).toBe(6)
      expect(cover.sections.map((s) => s.marks)).toEqual([3, 1, 2])

      // a second publish of the terbit paper changes nothing (no re-pin)
      expect(await publish(id)).toEqual({ ok: true, errors: [] })
      expect((await q('select pinned_version_no v from paper_placements where question_id = 700001 and paper_section_id in (select id from paper_sections where paper_id = $1)', [id]))[0]!.v).toBe(1)
      expect((await q('select updated_at from papers where id = $1', [id]))[0]!.updated_at).toEqual(before)

      // a draft sees version 2; publishing it pins version 2
      const id2 = await newPaper()
      await fill(id2, { A: ['700001', '700002', '700003'], B, C: ['700005', '700006'] })
      // 700001 now counts 5, so the section no longer matches its budget
      expect((await publish(id2)).errors).toEqual([LINES.sectionLine('Bahagian A', LINES.marksMismatch(7, 3))])
      await fill(id2, { A: ['700001', '700007', '700009'], B, C })
      expect((await publish(id2)).errors).toEqual([LINES.sectionLine('Bahagian A', LINES.marksMismatch(7, 3))])
      bank.edit('700001', { marks: 1 }) // version 3 back to 1 mark
      expect((await publish(id2)).ok).toBe(true)
      expect((await q('select pinned_version_no v, marks_override m from paper_placements where question_id = 700001 and paper_section_id in (select id from paper_sections where paper_id = $1)', [id2]))[0]).toEqual({ v: 3, m: 1 })
    })

    it('a terbit paper cannot be edited: 422 paperLocked without fields', async () => {
      const id = await newPaper()
      await fill(id, { A: ['700001', '700002', '700003'], B, C })
      expect((await publish(id)).ok).toBe(true)
      const res = await admin.put(`/api/admin/papers/${id}`, { title: 'Lain' })
      const err = expectError(res, 'VALIDATION_ERROR', 422, MSG.paperLocked)
      expect(err.fields).toBeUndefined()
      expect((await q('select title from papers where id = $1', [id]))[0]!.title).not.toBe('Lain')
    })
  })

  describe('AC3 groups and duplicates', () => {
    it('D90: a PUT with one member of a group places the whole group; a group split between sections is refused', async () => {
      const id = await newPaper()
      const e = await editor(id)
      const [sa, sb, sc] = e.paper.sections
      const res = await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: sa!.id, questionIds: ['700001', '700022'] }] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const got = Editor.parse(res.body).data
      expect(got.paper.sections[0]!.questionIds).toEqual(['700001', '700021', '700022'])
      // the group appears once in the editor data with its stimulus
      expect(got.groups).toHaveLength(1)
      expect(got.groups[0]).toMatchObject({ id: '800001', questionIds: ['700021', '700022'] })
      // putting the same group in a second section is a duplicate
      const split = await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: sb!.id, questionIds: ['700021'] }, { id: sc!.id, questionIds: [] }] })
      expectError(split, 'VALIDATION_ERROR', 422, LINES.duplicateQuestion(['700021', '700022']))
    })

    it('a duplicate inside one section is refused with 422 and the duplicate line; nothing is saved', async () => {
      const id = await newPaper()
      const e = await editor(id)
      const res = await admin.put(`/api/admin/papers/${id}`, { title: 'X', sections: [{ id: e.paper.sections[0]!.id, questionIds: ['700001', '700002', '700001'] }] })
      expectError(res, 'VALIDATION_ERROR', 422, LINES.duplicateQuestion(['700001']))
      expect((await editor(id)).paper.title).not.toBe('X')
    })
  })

  describe('AC4 visibility to students', () => {
    it('a published paper is in the student list and cover; withdraw hides it; re-publish raises the version', async () => {
      const id = await newPaper()
      await fill(id, { A: ['700001', '700002', '700003'], B, C })
      expect((await student.get('/api/bijak/papers')).body.data.map((p: { id: string }) => p.id)).not.toContain(id)
      await publish(id)
      expect((await student.get('/api/bijak/papers')).body.data.map((p: { id: string }) => p.id)).toContain(id)
      expect((await student.get(`/api/bijak/papers/${id}`)).status).toBe(200)

      const w = await admin.post(`/api/admin/papers/${id}/withdraw`)
      expect(w.status).toBe(200)
      expect(Ok.parse(w.body).data).toEqual({ ok: true })
      expect((await student.get('/api/bijak/papers')).body.data.map((p: { id: string }) => p.id)).not.toContain(id)
      expect((await student.get(`/api/bijak/papers/${id}`)).status).toBe(404)
      const row = (await q('select status, version, published_at from papers where id = $1', [id]))[0]!
      expect(row).toMatchObject({ status: 'withdrawn', version: 1, published_at: null })
      expect(await count(t.db, `select count(*) n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 and pl.marks_override is not null`, [id])).toBe(0)
      const e = await editor(id)
      expect(e.paper.status).toBe('draf')
      expect(e.paper.publishedAt).toBeUndefined()

      // editable again, then published again: version 2
      expect((await admin.put(`/api/admin/papers/${id}`, { title: 'Semula' })).status).toBe(200)
      expect((await publish(id)).ok).toBe(true)
      expect((await q('select version from papers where id = $1', [id]))[0]!.version).toBe(2)
      expect((await student.get('/api/bijak/papers')).body.data.map((p: { id: string }) => p.id)).toContain(id)
      expect((await editor(id)).paper.publishedAt).toBeDefined()
    })

    it('withdraw of a draft changes nothing and writes no audit row', async () => {
      const id = await newPaper()
      const n = await count(t.db, `select count(*) n from audit_events where action = 'bijak.paper.withdrawn'`)
      expect((await admin.post(`/api/admin/papers/${id}/withdraw`)).status).toBe(200)
      expect(await dbStatus(id)).toBe('draft')
      expect(await count(t.db, `select count(*) n from audit_events where action = 'bijak.paper.withdrawn'`)).toBe(n)
    })
  })

  describe('AC8 audit', () => {
    it('writes one audit row per state change with actor, target, from and to', async () => {
      const id = await newPaper()
      await fill(id, { A, B, C })
      await publish(id)
      await admin.post(`/api/admin/papers/${id}/withdraw`)
      expect((await admin.del(`/api/admin/papers/${id}`)).status).toBe(200)
      for (const [action, from, to] of [
        ['bijak.paper.created', null, 'draf'],
        ['bijak.paper.updated', 'draf', 'draf'],
        ['bijak.paper.published', 'draf', 'terbit'],
        ['bijak.paper.withdrawn', 'terbit', 'draf'],
        ['bijak.paper.deleted', 'draf', null],
      ] as const) {
        const rows = (await auditRows(t.db, action)).filter((r) => r.target_id === id)
        expect(rows, action).toHaveLength(1)
        expect(rows[0]!.actor_user_id).toBe(admin.userId)
        expect(rows[0]!.target_type).toBe('bijak_paper')
        expect(rows[0]!.detail).toMatchObject({ from, to })
      }
      const created = (await auditRows(t.db, 'bijak.paper.created')).find((r) => r.target_id === id)!
      expect(JSON.stringify(created.detail)).not.toContain('Percubaan')
    })

    it('a refused publish and a refused edit write no audit row', async () => {
      const id = await newPaper()
      const total = () => count(t.db, `select count(*) n from audit_events where target_id = $1 and target_type = 'bijak_paper'`, [id])
      const n = await total()
      await admin.post(`/api/admin/papers/${id}/publish`)
      await admin.put(`/api/admin/papers/${id}`, { title: '   ' })
      expect(await total()).toBe(n)
    })
  })

  describe('create, update, delete rules', () => {
    it('create without a blueprint, or with a Draf-source blueprint, is 422 noBlueprint', async () => {
      for (const body of [{ subject: 'SEJ', kertas: 1 }, { subject: 'XYZ', kertas: 1 }]) {
        const err = expectError(await admin.post('/api/admin/papers', body), 'VALIDATION_ERROR', 422, MSG.noBlueprint)
        expect(err.fields).toBeUndefined()
      }
      await q(`update blueprints set source = 'draft' where code = '4541/1'`)
      expectError(await admin.post('/api/admin/papers', { subject: 'SN', kertas: 1 }), 'VALIDATION_ERROR', 422, MSG.noBlueprint)
      await q(`update blueprints set source = 'spec' where code = '4541/1'`)
      expect((await admin.post('/api/admin/papers', { subject: 'SN', kertas: 1 })).status).toBe(201)
    })

    it('create with a kertas beyond the smallint range is 422 noBlueprint, not a 500', async () => {
      for (const kertas of [32768, 40000, 99999999999]) {
        const err = expectError(await admin.post('/api/admin/papers', { subject: 'MAT', kertas }), 'VALIDATION_ERROR', 422, MSG.noBlueprint)
        expect(err.fields).toBeUndefined()
      }
    })

    it('list status filter: a withdrawn paper is draf, not terbit', async () => {
      const id = await newPaper()
      await fill(id, { A, B, C })
      await publish(id)
      const ids = async (status: string) => Summaries.parse((await admin.get(`/api/admin/papers?status=${status}&pageSize=100`)).body).data.map((r) => r.id)
      expect(await ids('terbit')).toContain(id)
      expect(await ids('draf')).not.toContain(id)
      await admin.post(`/api/admin/papers/${id}/withdraw`)
      expect(await ids('terbit')).not.toContain(id)
      expect(await ids('draf')).toContain(id)
    })

    it('concurrency: double publish gives one audit row; PUT racing publish ends coherent', async () => {
      const id = await newPaper()
      await fill(id, { A, B, C })
      const both = await Promise.all([admin.post(`/api/admin/papers/${id}/publish`), admin.post(`/api/admin/papers/${id}/publish`)])
      for (const r of both) expect(Publish.parse(r.body).data).toEqual({ ok: true, errors: [] })
      expect((await auditRows(t.db, 'bijak.paper.published')).filter((r) => r.target_id === id)).toHaveLength(1)
      expect((await q('select version from papers where id = $1', [id]))[0]!.version).toBe(1)

      const id2 = await newPaper()
      const e = await fill(id2, { A, B, C })
      const [put, pub] = await Promise.all([
        admin.put(`/api/admin/papers/${id2}`, { sections: [{ id: e.paper.sections[0]!.id, questionIds: ['700003', '700002', '700001'] }] }),
        admin.post(`/api/admin/papers/${id2}/publish`),
      ])
      expect([200, 422]).toContain(put.status)
      if (put.status === 422) expectError(put, 'VALIDATION_ERROR', 422, MSG.paperLocked)
      expect(Publish.parse(pub.body).data.ok).toBe(true)
      expect(await dbStatus(id2)).toBe('published')
      expect(await count(t.db, `select count(*) n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [id2])).toBe(6)
      expect(await count(t.db, `select count(*) n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 and pl.marks_override is null`, [id2])).toBe(0)
      expect((await auditRows(t.db, 'bijak.paper.published')).filter((r) => r.target_id === id2)).toHaveLength(1)
    })

    it('create validates the body; a blank title gets the default, a given title is trimmed', async () => {
      expectError(await admin.post('/api/admin/papers', { subject: 'MAT' }), 'VALIDATION_ERROR', 422)
      const blank = await editor(await newPaper({ title: '   ' }))
      expect(blank.paper.title).toMatch(/^Percubaan SPM .+ Kertas 2 \(draf\)$/)
      expect((await editor(await newPaper({ title: '  Set Khas  ' }))).paper.title).toBe('Set Khas')
      const row = (await q(`select kind, status, created_by_id::text c, is_test, year from papers where id = $1`, [await newPaper()]))[0]!
      expect(row).toMatchObject({ kind: 'pilihan', status: 'draft', c: admin.userId, is_test: false, year: 2026 })
    })

    it('PUT: blank title, invalid section and invalid questions are 422 with the contract messages', async () => {
      const id = await newPaper()
      const e = await editor(id)
      const sid = e.paper.sections[0]!.id
      const blank = await admin.put(`/api/admin/papers/${id}`, { title: '   ' })
      expect(expectError(blank, 'VALIDATION_ERROR', 422).fields?.title).toBe(MSG.titleRequired)

      const other = await newPaper()
      const foreign = (await editor(other)).paper.sections[0]!.id
      for (const bad of [foreign, 'abc']) {
        const r = await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: bad, questionIds: [] }] })
        expect(expectError(r, 'VALIDATION_ERROR', 422, MSG.invalidSection).fields).toBeUndefined()
      }
      for (const bad of ['999999', '700011', 'abc', '0700001']) {
        const r = await admin.put(`/api/admin/papers/${id}`, { sections: [{ id: sid, questionIds: ['700001', bad] }] })
        expect(expectError(r, 'VALIDATION_ERROR', 422, MSG.invalidQuestion).fields).toBeUndefined()
      }
      expect((await editor(id)).paper.sections[0]!.questionIds).toEqual([])
    })

    it('PUT changes only the keys sent; year, duration and a not-listed section stay', async () => {
      const id = await newPaper()
      const e = await fill(id, { A, B, C })
      const res = await admin.put(`/api/admin/papers/${id}`, { year: 2024, durationMin: 120, sections: [{ id: e.paper.sections[0]!.id, questionIds: ['700003'] }] })
      const out = Editor.parse(res.body).data
      expect(out.paper).toMatchObject({ year: 2024, durationMin: 120 })
      expect(out.paper.sections.map((s) => s.questionIds)).toEqual([['700003'], B, C])
      const stored = (await q('select printed_duration_min d, year from papers where id = $1', [id]))[0]
      expect(stored).toEqual({ d: 120, year: 2024 })
      expect((await q('select pinned_version_no v, marks_override m from paper_placements where question_id = 700003 and paper_section_id = $1', [e.paper.sections[0]!.id]))[0]).toEqual({ v: 1, m: null })
    })

    it('delete: a draft is removed with its sections and placements, a second delete is ok, a terbit paper is refused', async () => {
      const id = await newPaper()
      await fill(id, { A, B, C })
      const del = await admin.del(`/api/admin/papers/${id}`)
      expect(Ok.parse(del.body).data).toEqual({ ok: true })
      expect(await count(t.db, 'select count(*) n from papers where id = $1', [id])).toBe(0)
      expect(await count(t.db, 'select count(*) n from paper_sections where paper_id = $1', [id])).toBe(0)
      expect((await admin.del(`/api/admin/papers/${id}`)).status).toBe(200)
      expect(await count(t.db, `select count(*) n from audit_events where action = 'bijak.paper.deleted' and target_id = $1`, [id])).toBe(1)

      const live = await newPaper()
      await fill(live, { A, B, C })
      await publish(live)
      expectError(await admin.del(`/api/admin/papers/${live}`), 'VALIDATION_ERROR', 422, MSG.deleteTerbit)
      expect(await count(t.db, 'select count(*) n from papers where id = $1', [live])).toBe(1)
      // a seeded published paper too
      const seeded = (await q(`select id::text from papers where kind = 'pilihan' and status = 'published' order by id limit 1`))[0]!.id
      expectError(await admin.del(`/api/admin/papers/${String(seeded)}`), 'VALIDATION_ERROR', 422, MSG.deleteTerbit)
    })

    it('preview answers questions with no-store and a schema-valid body; unknown ids are left out', async () => {
      const res = await admin.post('/api/admin/papers/preview', { ids: ['700001', '700021', '999999'] })
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(Preview.parse(res.body).data.questions.map((x) => x.id)).toEqual(['700001', '700021'])
      expectError(await admin.post('/api/admin/papers/preview', { ids: 'x' }), 'VALIDATION_ERROR', 422)
      // other routes are not no-store
      expect((await admin.get('/api/admin/papers')).headers['cache-control']).not.toBe('no-store')
    })

    it('list pages, filters by status and orders by latest update', async () => {
      const all = Summaries.parse((await admin.get('/api/admin/papers?pageSize=100')).body)
      expect(all.meta.totalItems).toBe(all.data.length)
      const terbit = Summaries.parse((await admin.get('/api/admin/papers?status=terbit&pageSize=100')).body)
      const draf = Summaries.parse((await admin.get('/api/admin/papers?status=draf&pageSize=100')).body)
      expect(terbit.data.every((r) => r.status === 'terbit')).toBe(true)
      expect(draf.data.every((r) => r.status === 'draf')).toBe(true)
      expect(terbit.data.length + draf.data.length).toBe(all.data.length)
      const times = all.data.map((r) => r.updatedAt)
      expect(times).toEqual([...times].sort().reverse())
      const p1 = Summaries.parse((await admin.get('/api/admin/papers?pageSize=2&page=1')).body)
      const p2 = Summaries.parse((await admin.get('/api/admin/papers?pageSize=2&page=2')).body)
      expect(p1.data).toHaveLength(2)
      expect(p1.meta).toMatchObject({ page: 1, pageSize: 2, totalItems: all.data.length })
      expect(p2.data.map((r) => r.id)).toEqual(all.data.slice(2, 4).map((r) => r.id))
      expectError(await admin.get('/api/admin/papers?status=lain'), 'VALIDATION_ERROR', 422)
      expectError(await admin.get('/api/admin/papers?page=0'), 'VALIDATION_ERROR', 422)
    })
  })
})
