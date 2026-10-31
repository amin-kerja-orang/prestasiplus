import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ServabilityActivity, ServabilityReport } from '@pp/contract'

import { QuestionsService } from '../../src/modules/questions'
import { ServabilityService } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * R1-T45 / AC-04.5 (v2-admin-student-pipeline US-04): the "Dilihat murid di" indicators are correct on the NEXT view after approve, tag
 * edit, paper publish and withdraw, with no job in between. The servability report is computed on read (no cache, no facts table), so
 * every step reads it again straight after the change and checks the exact activity verdicts.
 */
describe('AC-04.5 servability indicators re-read correctly after each state change', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let servability: ServabilityService
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let chapterId: string
  let id: string
  let paperId = ''

  const q = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  /** The next view: the single read and the batch read must agree. */
  async function view(): Promise<ServabilityReport> {
    const one = await servability.report(id)
    const batch = (await servability.reports([id])).get(id)
    expect(batch).toEqual(one)
    return one as ServabilityReport
  }
  const verdict = (r: ServabilityReport, a: ServabilityActivity) => {
    const x = r.activities.find((y) => y.activity === a)!
    return { served: x.served, codes: x.reasons.map((e) => e.code) }
  }
  const setPaper = (status: string) => t.db.query(`update papers set status = $2, published_at = case when $2 = 'published' then now() else null end where id = $1`, [paperId, status])

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    servability = t.app.get(ServabilityService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
    const subjects = await q<{ id: string }>(`select id::text id from subjects where code = 'MATH'`)
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [subjects[0]!.id])
    const [ch] = await q<{ id: string }>(`select id::text id from chapters where subject_id = $1 and education_level_id = $2 limit 1`, [tag.subjectId, tag.levelId])
    chapterId = ch!.id
    const created = await svc.create(mcqInput(tag, { questionText: 'Soalan untuk ujian penyegaran penunjuk kebolehhidangan.', tag: tagBody(tag, 3) }), admin)
    id = created.id
  })
  afterAll(async () => {
    await t.close()
  })

  it('a draft is served nowhere, every activity says it is not approved', async () => {
    const r = await view()
    expect(r.servedCount).toBe(0)
    for (const a of r.activities) expect(a.reasons[0]?.code, a.activity).toBe('not_approved')
  })

  it('approve: the very next view serves it in the bank activities; Latihan Bab waits for a chapter; Simulasi waits for a paper', async () => {
    await svc.setStatus(id, 'review', admin.userId)
    expect(verdict(await view(), 'databank').served).toBe(false) // review is still not servable
    await svc.setStatus(id, 'approved', admin.userId)
    const r = await view()
    expect(r.versionNo).toBe(1)
    expect(verdict(r, 'databank')).toEqual({ served: true, codes: [] })
    expect(verdict(r, 'latih_tubi_spm')).toEqual({ served: true, codes: [] })
    expect(verdict(r, 'simulasi_kuiz').served).toBe(true)
    expect(verdict(r, 'bab')).toEqual({ served: false, codes: ['no_chapter'] })
    expect(verdict(r, 'simulasi_paper')).toEqual({ served: false, codes: ['not_on_published_paper'] })
  })

  it('tag edit: the live version keeps its verdict until the edit is approved, then the next view shows the new tag', async () => {
    // The edit is version 2 as a draft; pupils are still served version 1 (Q-5), so the indicators must not move yet.
    await svc.update(id, { ...mcqInputBody(), curriculumChapterId: chapterId } as never, admin)
    const mid = await view()
    expect(mid.versionNo).toBe(1)
    expect(verdict(mid, 'bab')).toEqual({ served: false, codes: ['no_chapter'] })
    await svc.setStatus(id, 'review', admin.userId)
    await svc.setStatus(id, 'approved', admin.userId)
    const after = await view()
    expect(after.versionNo).toBe(2)
    expect(verdict(after, 'bab')).toEqual({ served: true, codes: [] })
  })

  it('paper publish and withdraw: Simulasi follows the paper status on the next view, both ways', async () => {
    const paper = await t.db.prisma.paper.create({
      data: {
        kind: 'pilihan',
        title: 'Kertas penyegaran',
        subjectId: BigInt(tag.subjectId),
        kertas: 2,
        paperCode: '1449/2',
        printedDurationMin: 60,
        status: 'draft',
        sections: { create: [{ position: 1, label: 'Bahagian A', questionCount: 1, markBudget: 1, placements: { create: [{ questionId: BigInt(id), position: 1, pinnedVersionNo: 2 }] } }] },
      },
    })
    paperId = paper.id.toString()
    expect(verdict(await view(), 'simulasi_paper')).toEqual({ served: false, codes: ['not_on_published_paper'] }) // draft paper
    await setPaper('published')
    expect(verdict(await view(), 'simulasi_paper')).toEqual({ served: true, codes: [] })
    await setPaper('withdrawn')
    expect(verdict(await view(), 'simulasi_paper')).toEqual({ served: false, codes: ['not_on_published_paper'] })
    await setPaper('published')
    expect(verdict(await view(), 'simulasi_paper').served).toBe(true)
  })

  it('withdraw (Tarik balik): the bank activities stop at once, with the reason Diarkibkan', async () => {
    await svc.setStatus(id, 'archived', admin.userId)
    const r = await view()
    expect(r.versionNo).toBeNull()
    for (const a of ['databank', 'latih_tubi_spm', 'bab', 'simulasi_kuiz', 'jana_kertas'] as const) {
      expect(verdict(r, a), a).toEqual({ served: false, codes: ['archived'] })
    }
    // Simulasi for a withdrawn question on a published paper is decided by T30 (H-A13); it is not asserted here.
    await setPaper('withdrawn')
    expect(verdict(await view(), 'simulasi_paper').served).toBe(false)
  })

  /** The flat body of an edit that keeps the question as it is. */
  function mcqInputBody() {
    return { ...mcqInput(tag, { questionText: 'Soalan untuk ujian penyegaran penunjuk kebolehhidangan.', tag: tagBody(tag, 3) }) }
  }
})
