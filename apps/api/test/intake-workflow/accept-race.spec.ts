import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

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

async function oneItem(): Promise<string> {
  t.ai.paper = () => paper([draft(t.codes, '1', { stem: uniqueStem() })])
  const { batchId } = await readyBatch(t, teacher)
  await extractAndRun(t, teacher, batchId)
  return (await itemsOf(teacher, batchId))[0]!.id
}
const questionsOf = async (itemId: string) => t.db.query(`select 1 from question_versions where intake_item_id = $1`, [itemId])

describe('concurrent accept of one item', () => {
  it('accept + accept: exactly one question is created, the loser gets 409', async () => {
    const id = await oneItem()
    const [a, b] = await Promise.all([post(teacher, `/intake/items/${id}/accept`), post(admin, `/intake/items/${id}/accept`)])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(await questionsOf(id)).toHaveLength(1)
  })

  it('accept + bulk accept: exactly one question is created, the loser is 409 or a WRONG_STATE skip', async () => {
    const id = await oneItem()
    const [a, b] = await Promise.all([post(teacher, `/intake/items/${id}/accept`), post(admin, '/intake/items/bulk', { action: 'accept', ids: [id] })])
    expect(b.status, JSON.stringify(b.body)).toBe(200)
    const bulk = b.body.data.results[0] as { outcome: string; reason: string | null }
    const singleWon = a.status === 200
    if (singleWon) expect(bulk).toMatchObject({ outcome: 'skipped', reason: 'WRONG_STATE' })
    else {
      expect(a.status).toBe(409)
      expect(bulk.outcome).toBe('done')
    }
    expect(await questionsOf(id)).toHaveLength(1)
  })
})
