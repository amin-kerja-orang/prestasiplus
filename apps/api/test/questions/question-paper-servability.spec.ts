import { QuestionPaperServabilityRowSchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { stubPlacedQuestions } from '../support/db'
import { ServabilityService } from '../../src/modules/questions/serving'
import { PaperServabilityService, QUESTION_PAPERS_MAX } from '../../src/modules/questions/serving/paper-servability.service'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'

const Rows = z.array(QuestionPaperServabilityRowSchema)

/**
 * REQ-A-018 (AC-04.3 / AC-04.4, V2 question detail "Dilihat murid di"): `GET /api/admin/questions/:id/paper-servability` lists the published
 * papers that carry the question, whether pupils can open each and why not. Admin Pusat only. (The T45b `placements` list on the question
 * detail has the papers but no served flag or reasons, so this is a new read, built on `PaperServabilityService`.)
 */
describe('REQ-A-018 GET /api/admin/questions/:id/paper-servability', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let admin: Client
  let guru: Client
  let pupil: Client
  let schoolAdmin: Client
  let tag: Tag
  let n = 0
  const url = (id: string) => `/api/admin/questions/${id}/paper-servability`

  async function question(approved: boolean): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: `Soalan kertas servability ${String(++n)} untuk ujian laluan.`, tag: tagBody(tag, 3) }), await adminActor(t.db))
    if (approved) {
      await t.db.query(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
      await t.db.query(`update questions set live_version_no = 1 where id = $1`, [created.id])
    }
    return created.id
  }
  async function paper(title: string, status: string, questionIds: string[]): Promise<string> {
    const p = await t.db.prisma.paper.create({
      data: {
        kind: 'pilihan',
        title,
        subjectId: BigInt(tag.subjectId),
        kertas: 2,
        paperCode: '1449/2',
        printedDurationMin: 60,
        status,
        publishedAt: status === 'published' ? new Date() : null,
        sections: { create: [{ position: 1, label: 'Bahagian A', questionCount: questionIds.length, markBudget: 0, placements: { create: questionIds.map((q, i) => ({ questionId: BigInt(q), position: i + 1, pinnedVersionNo: 1 })) } }] },
      },
    })
    return p.id.toString()
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    await stubPlacedQuestions(t.db) // DM-11: a placement of an id the bank does not hold needs a question row
    svc = t.app.get(QuestionsService)
    admin = await loginAs(t, 'admin')
    guru = await loginAs(t, 'teacher')
    pupil = await loginAs(t, 'student')
    schoolAdmin = await loginAs(t, 'schoolAdmin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  it('admin: one row per published paper with the served flag and the reasons (served, not served with its reason, and a placement on a missing question)', async () => {
    const shared = await question(true)
    const draftQuestion = await question(false) // not approved: the bridge cannot serve it
    const gone = '987654321012' // a placement that points at no question
    const okPaper = await paper('Kertas A boleh dibuka', 'published', [shared, await question(true)])
    const badPaper = await paper('Kertas B soalan tidak lulus', 'published', [shared, draftQuestion])
    const missingPaper = await paper('Kertas C soalan hilang', 'published', [shared, gone])
    await paper('Kertas D draf', 'draft', [shared]) // not published: not listed
    await paper('Kertas E tarik balik', 'withdrawn', [shared]) // not published: not listed

    const res = await admin.get(url(shared))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const rows = Rows.parse(res.body.data)
    expect(rows.map((r) => r.paperId)).toEqual([okPaper, badPaper, missingPaper])
    expect(rows[0]).toEqual({ paperId: okPaper, title: 'Kertas A boleh dibuka', served: true, reasons: [] })
    expect(rows[1]).toMatchObject({ paperId: badPaper, title: 'Kertas B soalan tidak lulus', served: false })
    expect(rows[1]!.reasons.map((r) => r.code)).toEqual(['not_approved'])
    expect(rows[1]!.reasons[0]!.detail).toMatch(new RegExp(`^${draftQuestion}`))
    expect(rows[2]).toMatchObject({ paperId: missingPaper, served: false })
    expect(rows[2]!.reasons.map((r) => r.code)).toEqual(['question_missing'])
    expect(rows[2]!.reasons[0]!.detail).toBe(gone)
    expect(rows[2]!.reasons[0]!.message).toContain('tiada dalam bank soalan')
    expect(res.body.meta).toEqual({ total: 3, truncated: false })
    // parity: the one batched read gives each paper the same answer as the single-paper report (`report`), reasons included
    const single = t.app.get(PaperServabilityService)
    for (const r of rows) {
      const one = (await single.report(r.paperId))!
      expect(r.served, r.paperId).toBe(one.open)
      const codes = (x: { code: string; detail?: string | undefined }[]) => x.map((y) => `${y.code}|${y.detail ?? ''}`).sort()
      const fromOne = one.open ? [] : one.attention.flatMap((a) => a.reasons.map((y) => ({ code: y.code, detail: y.detail === undefined ? a.questionId : `${a.questionId}: ${y.detail}` })))
      expect(codes(r.reasons), r.paperId).toEqual(codes(fromOne))
    }
  })

  it('a pupil\'s generated (Jana) paper is never listed, nor counted: only the admin papers that place the question', async () => {
    const id = await question(true)
    const curated = await paper('Kertas H pilihan', 'published', [id])
    const pupilId = (await t.db.query<{ id: string }>(`select id::text id from users where email = 'pelajar@demo.test'`))[0]!.id
    await t.db.prisma.paper.create({
      data: {
        kind: 'jana', title: 'Kertas Jana peribadi pelajar', subjectId: BigInt(tag.subjectId), kertas: 2, paperCode: '1449/2', printedDurationMin: 60,
        status: 'published', publishedAt: new Date(), generatedForUserId: BigInt(pupilId), createdById: BigInt(pupilId),
        sections: { create: [{ position: 1, label: 'A', questionCount: 1, markBudget: 0, placements: { create: [{ questionId: BigInt(id), position: 1, pinnedVersionNo: 1 }] } }] },
      },
    })
    const res = await admin.get(url(id))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.map((r: { paperId: string }) => r.paperId)).toEqual([curated])
    expect(JSON.stringify(res.body)).not.toContain('Kertas Jana peribadi pelajar')
    expect(res.body.meta).toEqual({ total: 1, truncated: false })
  })

  it('ONE batched servability read serves every listed paper: the guard call plus one batch over the union of the placed ids (no read per paper)', async () => {
    const shared = await question(true)
    const [a, b, c, d] = [await question(true), await question(true), await question(false), await question(true)]
    await paper('Kertas I', 'published', [shared, a])
    await paper('Kertas J', 'published', [shared, b, c])
    await paper('Kertas K', 'published', [shared, a, d])
    const serv = t.app.get(ServabilityService)
    const spy = vi.spyOn(serv, 'reports')
    try {
      const res = await admin.get(url(shared))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toHaveLength(3)
      // call 1 is the 404 guard (`report(id)`), call 2 the one batch over the union of the three papers' questions
      expect(spy.mock.calls).toHaveLength(2)
      expect([...spy.mock.calls[0]![0]]).toEqual([shared])
      expect([...spy.mock.calls[1]![0]].sort()).toEqual([shared, a, b, c, d].sort())
    } finally {
      spy.mockRestore()
    }
  })

  it('at most QUESTION_PAPERS_MAX papers are read, the first by id; meta.total counts all and meta.truncated says the list is cut', async () => {
    const id = await question(true)
    const made = await t.db.prisma.paper.createManyAndReturn({
      data: Array.from({ length: QUESTION_PAPERS_MAX + 1 }, (_v, i) => ({ kind: 'pilihan', title: `Kertas banyak ${String(i)}`, subjectId: BigInt(tag.subjectId), kertas: 2, paperCode: '1449/2', printedDurationMin: 60, status: 'published', publishedAt: new Date() })),
      select: { id: true },
    })
    const sections = await t.db.prisma.paperSection.createManyAndReturn({
      data: made.map((p) => ({ paperId: p.id, position: 1, label: 'Bahagian A', questionCount: 1, markBudget: 0 })),
      select: { id: true },
    })
    await t.db.prisma.paperPlacement.createMany({ data: sections.map((s) => ({ paperSectionId: s.id, questionId: BigInt(id), position: 1, pinnedVersionNo: 1 })) })
    const created = made.map((p) => p.id).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)).map(String)
    const res = await admin.get(url(id))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toHaveLength(QUESTION_PAPERS_MAX)
    expect(res.body.data.map((r: { paperId: string }) => r.paperId)).toEqual(created.slice(0, QUESTION_PAPERS_MAX))
    expect(res.body.meta).toEqual({ total: QUESTION_PAPERS_MAX + 1, truncated: true })
  })

  it('a PKSK question and a primary-level (Darjah) question are 404, like an unknown id', async () => {
    const pksk = await question(true)
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1::bigint, 'pksk_domain', 'ujian')`, [pksk])
    const darjah = await question(true)
    await t.db.query(`update question_versions set education_level_id = (select id from education_levels where stage = 'primary' order by id limit 1) where question_id = $1`, [darjah])
    expectError(await admin.get(url(pksk)), 'NOT_FOUND')
    expectError(await admin.get(url(darjah)), 'NOT_FOUND')
  })

  it('a question on no published paper gives an empty list', async () => {
    const lone = await question(true)
    await paper('Kertas F draf sahaja', 'draft', [lone])
    const res = await admin.get(url(lone))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('a pupil, a teacher and a school admin get 403, an anonymous caller 401', async () => {
    const id = await question(true)
    expectError(await schoolAdmin.get(url(id)), 'FORBIDDEN')
    expectError(await pupil.get(url(id)), 'FORBIDDEN')
    expectError(await guru.get(url(id)), 'FORBIDDEN')
    expectError(await t.http().get(url(id)), 'UNAUTHORIZED')
  })

  it('an unknown or malformed id is 404', async () => {
    for (const id of ['999999999', 'abc', '1;drop', '-1', '0', '007', '+1', '1e3', '99999999999999999999999']) expectError(await admin.get(url(id)), 'NOT_FOUND')
  })

  it('reads live: a paper that is withdrawn drops out of the list on the next call', async () => {
    const id = await question(true)
    const p = await paper('Kertas G kemudian ditarik balik', 'published', [id])
    expect((await admin.get(url(id))).body.data.map((r: { paperId: string }) => r.paperId)).toEqual([p])
    await t.db.query(`update papers set status = 'withdrawn', published_at = null where id = $1`, [p])
    expect((await admin.get(url(id))).body.data).toEqual([])
  })
})
