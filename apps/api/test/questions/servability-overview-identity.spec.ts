import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { SERVABILITY_REASON_MS } from '@pp/contract'

import { QuestionsService } from '../../src/modules/questions'
import { stubPlacedQuestions } from '../support/db'
import { ServabilityReadsService, ServabilityService } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * REQ-B-022(a) / B2 Minor: the shared pass must give the SAME OUTPUT as the two passes it replaced, not only the same counts. The
 * references below are the pre-change evaluations, computed independently of the shared pass:
 *   - overview row "Simulasi (kertas)": `ServabilityService.reports(part)` per chunk, served = the simulasi_paper line is served;
 *   - lane "Bijak SPM" rows: `paperLane` (it evaluates its own papers, `factsOf` + `evaluate`) and the hub card counting those rows.
 * Data: an unserved question (a draft: no live version) and an id the bank does not hold, both placed on a published paper.
 */
describe('servability overview: the shared pass equals the pre-change evaluation (REQ-B-022a)', () => {
  let t: QuestionsTestApp
  let reads: ServabilityReadsService
  let tag: Tag
  const MISSING = '987654321098'
  let okId = ''
  let draftId = ''
  let mixedPaper = ''
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  beforeAll(async () => {
    t = await bootQuestionsApp()
    await stubPlacedQuestions(t.db) // DM-11: a placement of an id the bank does not hold needs a question row
    reads = t.app.get(ServabilityReadsService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    const svc = t.app.get(QuestionsService)
    const actor = await adminActor(t.db)
    const ok = await svc.create(mcqInput(tag, { questionText: 'Soalan elok untuk ujian identiti keluaran.', tag: tagBody(tag, 4) }), actor)
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [ok.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [ok.id])
    okId = ok.id
    draftId = (await svc.create(mcqInput(tag, { questionText: 'Soalan draf untuk ujian identiti keluaran.', tag: tagBody(tag, 4) }), actor)).id

    const paper = async (title: string, status: string, questionIds: string[]) => {
      const [p] = await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', $1, $2, 2, 90, $3) returning id::text id`, [title, tag.subjectId, status])
      const [s] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', $2, $2) returning id::text id`, [p!.id, questionIds.length])
      for (const [i, id] of questionIds.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [s!.id, id, i + 1])
      return p!.id
    }
    mixedPaper = await paper('Terbit campur', 'published', [okId, draftId, MISSING])
    await paper('Terbit elok', 'published', [okId])
    await paper('Draf sahaja', 'draft', [draftId])
  })
  afterAll(async () => {
    await t.close()
  })

  /** The pre-change overview figure: every distinct question on a published paper, reports() per chunk, served = no reason on Simulasi (kertas). */
  async function referencePaperRow(): Promise<{ served: number; total: number }> {
    const rows = await q(
      `select distinct pl.question_id::text id from paper_placements pl join paper_sections ps on ps.id = pl.paper_section_id join papers p on p.id = ps.paper_id where p.status = 'published'`,
    )
    const ids = rows.map((r) => r.id)
    const reports = await t.app.get(ServabilityService).reports(ids)
    let served = 0
    for (const r of reports.values()) if (r.activities.find((a) => a.activity === 'simulasi_paper')?.served) served++
    return { served, total: ids.length }
  }

  it('the Simulasi (kertas) row equals the reports() evaluation, with an unserved and a missing question on a published paper', async () => {
    const ref = await referencePaperRow()
    expect(ref).toEqual({ served: 1, total: 3 }) // ok is served; the draft is not; the missing id has no report
    const row = (await reads.overview()).activities.find((a) => a.activity === 'simulasi_paper')!
    expect(row).toMatchObject({ basis: 'evaluated', served: ref.served, total: ref.total })
  })

  it('the Bijak SPM card equals the lane rows: same papers, same attention', async () => {
    const lane = await reads.paperLane({ page: 1, pageSize: 100 })
    const card = (await reads.overview()).cards.find((c) => c.lane === 'bijak-spm')!
    expect({ total: card.total, attention: card.attention }).toEqual({ total: lane.total, attention: lane.rows.filter((r) => r.attention.length > 0).length })
    expect(lane.total).toBe(3)
    expect(card.attention).toBe(1)
  })

  it('the lane row of the mixed paper carries the reasons the reports() evaluation gives the unserved question', async () => {
    const lane = await reads.paperLane({ page: 1, pageSize: 100 })
    const row = lane.rows.find((r) => r.paperId === mixedPaper)!
    const draft = (await t.app.get(ServabilityService).reports([draftId])).get(draftId)!
    const expected = draft.activities.find((a) => a.activity === 'simulasi_paper')!.reasons.map((r) => ({ code: r.code, message: r.message, count: 1 }))
    expect(expected.length).toBeGreaterThan(0)
    expect(row.questionCount).toBe(3)
    expect(row.attentionCount).toBe(2) // the draft and the missing id (REQ-B-033: `question_missing`, not "no reason")
    expect(row.attention).toEqual([...expected, { code: 'question_missing', message: SERVABILITY_REASON_MS.question_missing, count: 1 }])
    // the paper that holds only the served question, and the draft paper, carry nothing
    expect(lane.rows.filter((r) => r.paperId !== mixedPaper).every((r) => r.attention.length === 0)).toBe(true)
  })

  it('a missing id is looked up once for the whole overview, not once for the row and again for the card', async () => {
    const spy = vi.spyOn(ServabilityService.prototype, 'factsOf')
    try {
      await reads.overview()
      const asked = spy.mock.calls.flatMap((c) => [...c[0]])
      expect(asked.filter((id) => id === MISSING)).toEqual([MISSING])
      expect(asked.filter((id) => id === draftId)).toEqual([draftId])
    } finally {
      spy.mockRestore()
    }
  })
})
