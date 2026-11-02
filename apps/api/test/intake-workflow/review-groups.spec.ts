import { IntakeItemListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * REQ-B-035 (D90): the review queue rows carry `group: { key, label, size, position }` when 2 or more items of the batch share a stimulus,
 * so the queue can show them as one unit ("Kumpulan N soalan"). Size counts the whole batch, not only the page.
 */
let t: WorkflowTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

async function batchWith(n: number): Promise<{ batchId: string; ids: string[] }> {
  t.ai.paper = () => paper(Array.from({ length: n }, (_v, i) => draft(t.codes, String(i + 1), { stem: uniqueStem() })))
  const { batchId } = await readyBatch(t, teacher)
  await extractAndRun(t, teacher, batchId)
  return { batchId, ids: (await itemsOf(teacher, batchId)).map((i) => i.id) }
}
const stimulusOf = async (batchId: string, label: string): Promise<string> => {
  const res = await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', text: 'Petikan bersama.', alt: 'Petikan', label })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body.data.id as string
}
const rows = async (query: string) => IntakeItemListResponseSchema.parse((await teacher.agent.get(`/api/intake/items?${query}`)).body).data

describe('review queue: group data per item (REQ-B-035)', () => {
  it('two items of one figure share a group key with size 2 and positions 1 and 2; a lone item and a one-item stimulus have none', async () => {
    const { batchId, ids } = await batchWith(4)
    const [a, b, c, d] = ids as [string, string, string, string]
    const shared = await stimulusOf(batchId, 'Petikan 1')
    const alone = await stimulusOf(batchId, 'Petikan 2')
    for (const id of [a, b]) expect((await patch(teacher, `/intake/items/${id}`, { stimulusId: shared })).status).toBe(200)
    expect((await patch(teacher, `/intake/items/${c}`, { stimulusId: alone })).status).toBe(200)

    const list = await rows(`batchId=${batchId}&pageSize=50`)
    const by = new Map(list.map((r) => [r.id, r]))
    expect(by.get(a)!.group).toEqual({ key: shared, label: 'Petikan 1', size: 2, position: 1 })
    expect(by.get(b)!.group).toEqual({ key: shared, label: 'Petikan 1', size: 2, position: 2 })
    expect(by.get(c)!.stimulusId).toBe(alone) // it has a stimulus, but nothing shares it: not a group
    expect(by.get(c)!.group).toBeUndefined()
    expect(by.get(d)!.group).toBeUndefined()
  })

  it('the size counts the whole batch, also when the group is split across pages; the order is the paper order', async () => {
    const { batchId, ids } = await batchWith(3)
    const shared = await stimulusOf(batchId, 'Rajah 1')
    for (const id of ids) expect((await patch(teacher, `/intake/items/${id}`, { stimulusId: shared })).status).toBe(200)
    const page1 = await rows(`batchId=${batchId}&pageSize=1&page=1`)
    const page3 = await rows(`batchId=${batchId}&pageSize=1&page=3`)
    expect(page1[0]!.group).toMatchObject({ key: shared, size: 3, position: 1 })
    expect(page3[0]!.group).toMatchObject({ key: shared, size: 3, position: 3 })
  })

  it('accepting one member does not change the group of the others (a group is the items that share the figure, in any state)', async () => {
    const { batchId, ids } = await batchWith(2)
    const [a, b] = ids as [string, string]
    const shared = await stimulusOf(batchId, 'Jadual 1')
    for (const id of [a, b]) expect((await patch(teacher, `/intake/items/${id}`, { stimulusId: shared })).status).toBe(200)
    // The gate may refuse the first accept (diagram without figure); the passage has text and alt, so it passes.
    const accepted = await post(teacher, `/intake/items/${a}/accept`)
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200)
    const list = await rows(`batchId=${batchId}&pageSize=50`)
    expect(list.map((r) => [r.id, r.state, r.group?.size, r.group?.position])).toEqual([
      [a, 'accepted', 2, 1],
      [b, expect.any(String), 2, 2],
    ])
  })
})
