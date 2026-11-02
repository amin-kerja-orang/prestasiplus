import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, uniqueStem, bootWorkflowApp, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * REQ-B-057: accept does not wait for duplicate entries (they stay open; Semakan and Terbit enforce them), so
 *  - the gate counts only open `exact` and `near` links: a pending `variant` link is informational and never blocks;
 *  - an ACCEPTED item can still dismiss an open exact or near entry ("Bukan pendua"), or its question could never leave Draf.
 * Real path: extract, accept, duplicate decision. The gate side (variant never blocks, exact/near block) is `questions-workflow/gate-facts.spec.ts` test 1b.
 */
let t: WorkflowTestApp
let teacher: LoggedIn
let admin: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp({}, { withQuestionWorkflow: true })
  teacher = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

type Item = { state: string; question?: { id: string } | null; duplicates: { id: string; kind: string; status: string }[] }
const itemOf = async (id: string): Promise<Item> => (await teacher.agent.get(`/api/intake/items/${id}`)).body.data as Item

/** One item accepted into the bank (a Draf) with the given stem; returns the item id and its question id. */
async function acceptStem(stem: string): Promise<{ itemId: string; questionId: string }> {
  t.ai.paper = () => paper([draft(t.codes, '1', { stem })])
  const { batchId } = await readyBatch(t, teacher)
  await extractAndRun(t, teacher, batchId)
  const [item] = await itemsOf(teacher, batchId)
  const res = await post(teacher, `/intake/items/${item!.id}/accept`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const questionId = (await itemOf(item!.id)).question?.id
  expect(questionId).toBeTruthy()
  return { itemId: item!.id, questionId: questionId! }
}

describe('REQ-B-057: duplicate entries of an accepted item', () => {
  it('an open exact entry is dismissed on the ACCEPTED item ("Bukan pendua"): the entry closes, the state stays accepted, and the gate stops counting it', async () => {
    const stem = uniqueStem()
    await acceptStem(stem)
    const second = await acceptStem(stem)
    const [dup] = (await itemOf(second.itemId)).duplicates
    expect(dup).toMatchObject({ kind: 'exact', status: 'open' })
    const open = () => t.db.query<{ n: string }>(`select count(*)::text n from duplicate_links where item_id = $1::bigint and decision = 'pending'`, [second.itemId])

    expect((await open())[0]!.n).toBe('1')
    const cleared = await post(teacher, `/intake/items/${second.itemId}/duplicate`, { decision: 'not_duplicate', duplicateId: dup!.id })
    expect(cleared.status, JSON.stringify(cleared.body)).toBe(200)
    expect(cleared.body.data.state).toBe('accepted')
    expect(cleared.body.data.question).toMatchObject({ id: second.questionId })
    expect((await open())[0]!.n).toBe('0')
    expect((await itemOf(second.itemId)).duplicates[0]?.status).not.toBe('open')
    // The history keeps the decision, from accepted to accepted.
    const ev = await t.db.query<{ event: string; from_state: string; to_state: string }>(`select event, from_state, to_state from intake_item_events where item_id = $1::bigint and event = 'cleared_duplicate'`, [second.itemId])
    expect(ev).toEqual([{ event: 'cleared_duplicate', from_state: 'accepted', to_state: 'accepted' }])
    // The audit row names the dismissed entry (without duplicateId the log cannot say which link was cleared).
    const audit = await t.db.query<{ detail: Record<string, unknown> }>(`select detail from audit_events where action = 'intake.item_duplicate_decided' and target_type = 'intake_item' and target_id = $1::text order by id`, [second.itemId])
    expect(audit).toHaveLength(1)
    expect(audit[0]!.detail).toMatchObject({ decision: 'not_duplicate', duplicateId: dup!.id, from: 'accepted', to: 'accepted' })
  })

  it('after accept the other decisions stay locked (409: Gabung, variant link), and nothing changes', async () => {
    const stem = uniqueStem()
    const first = await acceptStem(stem)
    const second = await acceptStem(stem)
    for (const decision of ['duplicate', 'variant']) {
      const res = await post(teacher, `/intake/items/${second.itemId}/duplicate`, { decision, matchedQuestionId: first.questionId })
      expect(res.status, `${decision}: ${JSON.stringify(res.body)}`).toBe(409)
    }
    const item = await itemOf(second.itemId)
    expect(item.state).toBe('accepted')
    expect(item.duplicates[0]?.status).toBe('open')
  })

  it('a REJECTED item stays final: even "Bukan pendua" is 409', async () => {
    const stem = uniqueStem()
    await acceptStem(stem)
    t.ai.paper = () => paper([draft(t.codes, '1', { stem })])
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const [item] = await itemsOf(teacher, batchId)
    const dup = (await itemOf(item!.id)).duplicates[0]
    expect((await post(teacher, `/intake/items/${item!.id}/reject`, { reason: 'Soalan berulang.' })).status).toBe(200)
    const res = await post(teacher, `/intake/items/${item!.id}/duplicate`, { decision: 'not_duplicate', duplicateId: dup!.id })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
  })
})

describe('REQ-B-057 (A4 minor): "Bukan pendua" is idempotent', () => {
  const counts = async (itemId: string) => ({
    events: (await t.db.query<{ n: string }>(`select count(*)::text n from intake_item_events where item_id = $1::bigint and event = 'cleared_duplicate'`, [itemId]))[0]!.n,
    audits: (await t.db.query<{ n: string }>(`select count(*)::text n from audit_events where action = 'intake.item_duplicate_decided' and target_type = 'intake_item' and target_id = $1::text`, [itemId]))[0]!.n,
  })

  it('a repeat on an accepted item answers 200 with the same view, writes no event or audit row and keeps the first reviewer and time', async () => {
    const stem = uniqueStem()
    await acceptStem(stem)
    const second = await acceptStem(stem)
    const [dup] = (await itemOf(second.itemId)).duplicates
    const send = () => post(teacher, `/intake/items/${second.itemId}/duplicate`, { decision: 'not_duplicate', duplicateId: dup!.id })
    const first = await send()
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    const before = await counts(second.itemId)
    const decided = (await t.db.query<{ decided_at: Date; decided_by_id: string }>(`select decided_at, decided_by_id::text from duplicate_links where id = $1::bigint`, [dup!.id]))[0]!

    const again = await send()
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(again.body.data.state).toBe('accepted')
    expect(again.body.data.duplicates).toEqual(first.body.data.duplicates)
    expect(await counts(second.itemId)).toEqual(before)
    const after = (await t.db.query<{ decided_at: Date; decided_by_id: string }>(`select decided_at, decided_by_id::text from duplicate_links where id = $1::bigint`, [dup!.id]))[0]!
    expect(after).toEqual(decided)
  })

  it('a repeat on an open item is the same no-op', async () => {
    const stem = uniqueStem()
    await acceptStem(stem)
    t.ai.paper = () => paper([draft(t.codes, '1', { stem })])
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const [item] = await itemsOf(teacher, batchId)
    const [dup] = (await itemOf(item!.id)).duplicates
    const send = () => post(teacher, `/intake/items/${item!.id}/duplicate`, { decision: 'not_duplicate', duplicateId: dup!.id })
    expect((await send()).status).toBe(200)
    const before = await counts(item!.id)
    const again = await send()
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(await counts(item!.id)).toEqual(before)
  })

  it('an entry decided earlier (a variant link) is not re-decided once the item is accepted: 409, nothing changes', async () => {
    const base = uniqueStem()
    const first = await acceptStem(`${base} apabila x ialah 12`)
    t.ai.paper = () => paper([draft(t.codes, '1', { stem: `${base} apabila x ialah 47` })])
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const [item] = await itemsOf(teacher, batchId)
    const [dup] = (await itemOf(item!.id)).duplicates
    const linked = await post(teacher, `/intake/items/${item!.id}/duplicate`, { decision: 'variant', matchedQuestionId: first.questionId })
    expect(linked.status, JSON.stringify(linked.body)).toBe(200)
    expect((await post(teacher, `/intake/items/${item!.id}/accept`)).status).toBe(200)
    const entry = (await itemOf(item!.id)).duplicates.find((d) => d.id === dup!.id) ?? (await itemOf(item!.id)).duplicates[0]!
    const res = await post(teacher, `/intake/items/${item!.id}/duplicate`, { decision: 'not_duplicate', duplicateId: entry.id })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect((await itemOf(item!.id)).duplicates.find((d) => d.id === entry.id)?.status).toBe(entry.status)
  })
})

describe('REQ-B-057 (B2 minor): the review gate stops counting an entry once it is dismissed on the accepted item', () => {
  /** Admin write through the questions routes of the same app (the real Semakan / Terbit gate). */
  const adminPost = (path: string, body: Record<string, unknown>) => admin.agent.post(`/api${path}`).set('X-CSRF-Token', admin.csrf).send(body)
  const statusOf = async (questionId: string) =>
    (await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [questionId]))[0]!.status

  it('accepted with an open exact link: Semakan is refused (422 duplicate, single and bulk); "Bukan pendua" through the intake route lets Semakan and Terbit pass', async () => {
    const stem = uniqueStem()
    await acceptStem(stem)
    const second = await acceptStem(stem)
    const [dup] = (await itemOf(second.itemId)).duplicates
    expect(dup).toMatchObject({ kind: 'exact', status: 'open' })
    // The submit gate also asks for a Bab; the accepted question has none, so give it the one of its subject and level.
    await t.db.query(
      `update question_versions v set chapter_id = (select c.id from chapters c where c.subject_id = v.subject_id and c.education_level_id = v.education_level_id order by c.id limit 1)
        where v.question_id = $1::bigint and v.chapter_id is null`,
      [second.questionId],
    )

    const refused = await adminPost(`/questions/${second.questionId}/status`, { to: 'review' })
    expect(refused.status, JSON.stringify(refused.body)).toBe(422)
    expect(refused.body.error.fields, JSON.stringify(refused.body)).toHaveProperty('duplicate')
    const bulk = (await adminPost('/questions/bulk-action', { action: 'review', ids: [second.questionId] })).body.data
    expect(bulk.affected).toBe(0)
    expect(bulk.failed[0]).toMatchObject({ id: second.questionId, code: 'VALIDATION_ERROR', fields: { duplicate: expect.any(String) } })
    expect(await statusOf(second.questionId)).toBe('draft')

    const cleared = await post(teacher, `/intake/items/${second.itemId}/duplicate`, { decision: 'not_duplicate', duplicateId: dup!.id })
    expect(cleared.status, JSON.stringify(cleared.body)).toBe(200)

    const review = await adminPost(`/questions/${second.questionId}/status`, { to: 'review' })
    expect(review.status, JSON.stringify(review.body)).toBe(200)
    const approved = await adminPost(`/questions/${second.questionId}/status`, { to: 'approved' })
    expect(approved.status, JSON.stringify(approved.body)).toBe(200)
    expect(await statusOf(second.questionId)).toBe('approved')
  })
})
