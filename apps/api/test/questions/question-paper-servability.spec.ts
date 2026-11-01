import { QuestionPaperServabilityRowSchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
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
    svc = t.app.get(QuestionsService)
    admin = await loginAs(t, 'admin')
    guru = await loginAs(t, 'teacher')
    pupil = await loginAs(t, 'student')
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
  })

  it('a question on no published paper gives an empty list', async () => {
    const lone = await question(true)
    await paper('Kertas F draf sahaja', 'draft', [lone])
    const res = await admin.get(url(lone))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('a pupil and a teacher get 403, an anonymous caller 401', async () => {
    const id = await question(true)
    expectError(await pupil.get(url(id)), 'FORBIDDEN')
    expectError(await guru.get(url(id)), 'FORBIDDEN')
    expectError(await t.http().get(url(id)), 'UNAUTHORIZED')
  })

  it('an unknown or malformed id is 404', async () => {
    for (const id of ['999999999', 'abc', '1;drop', '-1']) expectError(await admin.get(url(id)), 'NOT_FOUND')
  })

  it('reads live: a paper that is withdrawn drops out of the list on the next call', async () => {
    const id = await question(true)
    const p = await paper('Kertas G kemudian ditarik balik', 'published', [id])
    expect((await admin.get(url(id))).body.data.map((r: { paperId: string }) => r.paperId)).toEqual([p])
    await t.db.query(`update papers set status = 'withdrawn', published_at = null where id = $1`, [p])
    expect((await admin.get(url(id))).body.data).toEqual([])
  })
})
