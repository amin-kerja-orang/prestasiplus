import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, del, draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

let t: WorkflowTestApp
let teacher: LoggedIn
let admin: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

/** One accepted item (its Draf question exists) and its ids. */
async function accepted(): Promise<{ itemId: string; questionId: string }> {
  t.ai.paper = () => paper([draft(t.codes, '1', { stem: uniqueStem() })])
  const { batchId } = await readyBatch(t, teacher)
  await extractAndRun(t, teacher, batchId)
  const [item] = await itemsOf(teacher, batchId)
  const res = await post(teacher, `/intake/items/${item!.id}/accept`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return { itemId: item!.id, questionId: res.body.data.question.id as string }
}

/** After the question is gone: the item is still accepted, the link is null, the history stays. */
async function expectKept(itemId: string, questionId: string): Promise<void> {
  const rows = await t.db.query<{ review_state: string; question_id: string | null }>(`select review_state, question_id::text from intake_items where id = $1`, [itemId])
  expect(rows[0]).toEqual({ review_state: 'accepted', question_id: null })
  expect(await t.db.query(`select 1 from questions where id = $1`, [questionId])).toHaveLength(0)
  const events = await t.db.query<{ event: string }>(`select event from intake_item_events where item_id = $1 order by id`, [itemId])
  expect(events.map((e) => e.event)).toEqual(expect.arrayContaining(['extracted', 'accepted']))
  // The read model still answers for an accepted item without a question.
  const view = await teacher.agent.get(`/api/intake/items/${itemId}`)
  expect(view.status, JSON.stringify(view.body)).toBe(200)
  expect(view.body.data.state).toBe('accepted')
}

describe('deleting the Draf question of an accepted item', () => {
  it('Guru own delete succeeds; the item stays accepted with a null question link and its history', async () => {
    const { itemId, questionId } = await accepted()
    const res = await del(teacher, `/guru/questions/${questionId}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    await expectKept(itemId, questionId)
  })

  it('admin delete succeeds; the item stays accepted with a null question link and its history', async () => {
    const { itemId, questionId } = await accepted()
    const res = await del(admin, `/questions/${questionId}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    await expectKept(itemId, questionId)
  })

  it('admin bulk delete succeeds; the item stays accepted with a null question link and its history', async () => {
    const { itemId, questionId } = await accepted()
    const res = await post(admin, '/questions/bulk-action', { action: 'delete', ids: [questionId] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.affected).toBe(1)
    await expectKept(itemId, questionId)
  })
})
