import { IntakeBatchReviewEnvelopeSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

let t: WorkflowTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const review = async (batchId: string) => IntakeBatchReviewEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/batches/${batchId}/review`)).body).data
const named = (label: string, n: number) => `${uniqueStem()} Berdasarkan ${label}, soalan ${String(n)}.`

describe('one figure, every question that refers to it (D90)', () => {
  it('extraction links S2 to Rajah 1 when the extractor linked only S1: one group, both members, S3 stays out', async () => {
    t.ai.paper = () =>
      paper(
        [
          draft(t.codes, '1', { stem: named('Rajah 1', 1), stimulusId: 'stim-1' }),
          draft(t.codes, '2', { stem: named('Rajah 1', 2) }),
          draft(t.codes, '3', { stem: uniqueStem() }),
        ],
        { stimuli: [{ id: 'stim-1', kind: 'diagram', label: 'Rajah 1', alt: 'Segi tiga bersudut tegak' }] },
      )
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const items = await itemsOf(teacher, batchId)
    const r = await review(batchId)
    expect(r.stimuli).toHaveLength(1)
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0]?.itemIds).toEqual([items[0]!.id, items[1]!.id])
    expect(r.groups.flatMap((g) => g.itemIds)).not.toContain(items[2]!.id)
  })

  it('never moves an item the extractor linked to another stimulus', async () => {
    t.ai.paper = () =>
      paper(
        [draft(t.codes, '1', { stem: named('Rajah 1', 1), stimulusId: 'stim-2' }), draft(t.codes, '2', { stem: named('Rajah 1', 2) })],
        {
          stimuli: [
            { id: 'stim-1', kind: 'diagram', label: 'Rajah 1', alt: 'a' },
            { id: 'stim-2', kind: 'passage', label: 'Petikan 1', alt: 'b', text: 'Teks.' },
          ],
        },
      )
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const items = await itemsOf(teacher, batchId)
    const groups = (await review(batchId)).groups
    const byItem = new Map(groups.flatMap((g) => g.itemIds.map((i) => [i, g.stimulusId] as const)))
    expect(byItem.get(items[0]!.id)).not.toBe(byItem.get(items[1]!.id))
    expect(byItem.has(items[0]!.id)).toBe(true)
    expect(byItem.has(items[1]!.id)).toBe(true)
  })

  it('a figure added by hand is linked to every open item that names it, once (idempotent)', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1', { stem: named('Rajah 2', 1) }), draft(t.codes, '2', { stem: named('Rajah 2', 2) }), draft(t.codes, '3', { stem: named('Rajah 3', 3) })])
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const items = await itemsOf(teacher, batchId)
    const s = (await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'diagram', label: 'Rajah 2', alt: 'Graf garis' })).body.data
    const res = await post(teacher, `/intake/stimuli/${s.id}/link-references`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ stimulusId: s.id, linkedItemIds: [items[0]!.id, items[1]!.id] })
    expect((await review(batchId)).groups[0]?.itemIds).toEqual([items[0]!.id, items[1]!.id])
    expect((await post(teacher, `/intake/stimuli/${s.id}/link-references`)).body.data.linkedItemIds).toEqual([])
    expect((await post(teacher, '/intake/stimuli/987654321/link-references')).status).toBe(404)
  })
})
