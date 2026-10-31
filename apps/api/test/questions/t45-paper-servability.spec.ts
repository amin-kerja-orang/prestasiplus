import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { PaperServabilityService, PAPER_ACTIVITIES } from '../../src/modules/questions/serving/paper-servability.service'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * R1-T45 / AC-04.3 (v2-admin-student-pipeline US-04): for any paper (draft, ready, published, withdrawn) the review says whether pupils
 * can open it and where (Simulasi, Kuiz), and for a paper that is not open what stands in the way. The per-question rows are
 * `servability-reads` (T30); this is the paper-level line.
 */
describe('AC-04.3 paper-level "where can pupils open it"', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let paperSvc: PaperServabilityService
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let n = 0

  /** A question; `approved` writes the live version the way the other servability specs do. */
  async function question(approved: boolean): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: `Soalan kertas peringkat ${String(++n)} untuk ujian kebolehhidangan.`, tag: tagBody(tag, 3) }), admin)
    if (approved) {
      await t.db.query(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
      await t.db.query(`update questions set live_version_no = 1 where id = $1`, [created.id])
    }
    return created.id
  }
  async function paper(status: string, questionIds: string[], kind = 'pilihan'): Promise<string> {
    const p = await t.db.prisma.paper.create({
      data: {
        kind,
        title: `Kertas ${String(++n)}`,
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
  const setStatus = (id: string, status: string) =>
    t.db.query(`update papers set status = $2, published_at = case when $2 = 'published' then now() else null end where id = $1`, [id, status])
  const codes = (r: NonNullable<Awaited<ReturnType<PaperServabilityService['report']>>>, a: string) => r.activities.find((x) => x.activity === a)?.reasons.map((e) => e.code)

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    paperSvc = t.app.get(PaperServabilityService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  it('a published paper of servable questions is open in Simulasi and in its Kuiz', async () => {
    const id = await paper('published', [await question(true), await question(true)])
    const r = (await paperSvc.report(id))!
    expect(r).toMatchObject({ paperId: id, status: 'published', kind: 'pilihan', open: true, questionCount: 2, attention: [], servedCount: 2, total: 2 })
    expect(r.activities.map((a) => a.activity)).toEqual([...PAPER_ACTIVITIES])
    expect(r.activities.map((a) => a.label)).toEqual(['Simulasi (kertas)', 'Simulasi Kuiz'])
    expect(r.activities.every((a) => a.served && a.reasons.length === 0)).toBe(true)
  })

  it('a draft, ready or withdrawn paper is open nowhere: both lines say Kertas belum diterbitkan', async () => {
    const ids = [await question(true)]
    for (const status of ['draft', 'ready', 'withdrawn']) {
      const r = (await paperSvc.report(await paper(status, ids)))!
      expect(r.open, status).toBe(false)
      expect(r.servedCount, status).toBe(0)
      expect(codes(r, 'simulasi_paper'), status).toEqual(['paper_not_published'])
      expect(codes(r, 'simulasi_kuiz'), status).toEqual(['paper_not_published'])
      expect(r.activities[0]?.reasons[0]?.message).toBe('Kertas belum diterbitkan.')
    }
  })

  it('a placed question that is not servable is listed with its reason, and keeps a published paper out of Simulasi', async () => {
    const good = await question(true)
    const bad = await question(false) // still a draft: the bridge cannot serve it
    const draftPaper = await paper('draft', [good, bad])
    const d = (await paperSvc.report(draftPaper))!
    expect(d.attention).toHaveLength(1)
    expect(d.attention[0]).toMatchObject({ questionId: bad })
    expect(d.attention[0]?.reasons[0]?.code).toBe('not_approved')

    await setStatus(draftPaper, 'published')
    const p = (await paperSvc.report(draftPaper))!
    expect(p.open).toBe(false)
    expect(codes(p, 'simulasi_paper')).toEqual(['bridge_refused'])
    expect(p.activities[0]?.reasons[0]?.detail).toBe('1 soalan')
    expect(codes(p, 'simulasi_kuiz')).toEqual([]) // the per-paper quiz needs only a published paper
  })

  it('re-reads on the next view: publish opens the paper, withdraw closes it, no job in between', async () => {
    const id = await paper('draft', [await question(true)])
    expect((await paperSvc.report(id))!.open).toBe(false)
    await setStatus(id, 'published')
    expect((await paperSvc.report(id))!.open).toBe(true)
    await setStatus(id, 'withdrawn')
    const r = (await paperSvc.report(id))!
    expect(r.open).toBe(false)
    expect(codes(r, 'simulasi_paper')).toEqual(['paper_not_published'])
  })

  it('a paper with no question is not a quiz; an unknown or malformed paper id has no report', async () => {
    const r = (await paperSvc.report(await paper('published', [])))!
    expect(r.questionCount).toBe(0)
    expect(codes(r, 'simulasi_kuiz')).toEqual(['shape_unsupported'])
    expect(await paperSvc.report('999999999')).toBeNull()
    expect(await paperSvc.report('not-an-id')).toBeNull()
  })
})
