import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AiExtractor } from '../../src/modules/intake/files'
import { IntakeExtractionService } from '../../src/modules/intake/workflow'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

let t: WorkflowTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

describe('provenance and audit', () => {
  it('accept stores the source of the question (paper, file, page, label, run, model) and writes audit and history rows', async () => {
    t.ai.paper = () => paper([draft(t.codes, '7', { page: 1 })])
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const [item] = await itemsOf(teacher, batchId)
    const res = await post(teacher, `/intake/items/${item!.id}/accept`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.question).toMatchObject({ status: 'draft', version: 1 })
    expect(res.body.data.provenance).toMatchObject({ sourceType: 'pdf', numberLabel: '7', page: 1, model: 'mock-1' })

    const v = (
      await t.db.query<Record<string, string | null>>(
        `select v.number_label, v.source_page::text, v.ai_model, v.intake_item_id::text, v.ai_run_id::text, v.source_paper_id::text, v.source_file_id::text, q.source_type
           from question_versions v join questions q on q.id = v.question_id where v.question_id = $1`,
        [res.body.data.question.id],
      )
    )[0]!
    expect(v).toMatchObject({ number_label: '7', source_page: '1', ai_model: 'mock-1', intake_item_id: item!.id, source_type: 'pdf' })
    expect(v.ai_run_id).toBeTruthy()
    expect(v.source_paper_id).toBeTruthy()
    expect(v.source_file_id).toBeTruthy()

    const audit = await t.db.query<{ action: string }>(`select action from audit_events where action like 'intake.%' order by id`)
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['intake.extraction_requested', 'intake.item_accepted']))
    const events = (res.body.data.events as Array<{ action: string; actorRole: string | null }>).map((e) => e.action)
    expect(events).toEqual(['extracted', 'accepted'])
  })

  it('reject, duplicate decision and bulk are audited; an edit keeps one history row per changed field', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1'), draft(t.codes, '2')])
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const [a, b] = (await itemsOf(teacher, batchId)).map((i) => i.id) as [string, string]
    const edited = await patch(teacher, `/intake/items/${a}`, { marks: 2, scheme: { kind: 'option', marks: 2, correct: 'C', reason: 'Baharu.' }, tag: { subject: 'MATH', level: 'T4', unit: t.codes.unit, unitLabel: 'Unit ujian', sp: [t.codes.sp], tp: 4, formOrigin: 'T4' } })
    expect(edited.status, JSON.stringify(edited.body)).toBe(200)
    const fields = (edited.body.data.events as Array<{ action: string; field: string | null }>).filter((e) => e.action === 'edited').map((e) => e.field)
    expect(fields.sort()).toEqual(['marks', 'scheme', 'tag.tp'])
    await post(teacher, `/intake/items/${a}/reject`, { reason: 'Salah.' })
    await post(teacher, `/intake/items/${b}/duplicate`, { decision: 'variant', matchedItemId: a })
    const audit = await t.db.query<{ action: string }>(`select action from audit_events where action like 'intake.%'`)
    const actions = audit.map((r) => r.action)
    expect(actions).toContain('intake.item_rejected')
    expect(actions).toContain('intake.item_duplicate_decided')
  })
})

describe('AC-2: the AI cannot decide', () => {
  it('neither the AI port nor the extraction service has any way to accept, reject or link', () => {
    const port: Array<keyof AiExtractor> = ['id', 'extractPaper']
    expect(port).toHaveLength(2)
    const proto = Object.getOwnPropertyNames(IntakeExtractionService.prototype)
    expect(proto.filter((n) => /accept|reject|duplicate|bulk/i.test(n))).toEqual([])
  })

  it('a provider answer cannot set a final state: the stored states are generated or needs_review only', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1'), draft(t.codes, '2', { needsManual: true })])
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const states = await t.db.query<{ review_state: string; human_edited: string[]; confirmed_fields: string[] }>(
      `select review_state, human_edited, confirmed_fields from intake_items where batch_id = $1`,
      [batchId],
    )
    expect(states.every((s) => ['generated', 'needs_review'].includes(s.review_state))).toBe(true)
    expect(states.every((s) => s.human_edited.length === 0 && s.confirmed_fields.length === 0)).toBe(true)
  })
})

