import { INTAKE_MESSAGES, IntakeBatchReviewEnvelopeSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, del, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

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
const review = async (batchId: string) => IntakeBatchReviewEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/batches/${batchId}/review`)).body).data

describe('stimuli', () => {
  it('numbers the label by kind unless sent; refuses svg and unknown keys', async () => {
    const { batchId } = await batchWith(1)
    const a = await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'diagram', alt: 'Rajah segi tiga' })
    expect(a.status, JSON.stringify(a.body)).toBe(201)
    expect(a.body.data.label).toBe('Rajah 1')
    expect((await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'diagram' })).body.data.label).toBe('Rajah 2')
    expect((await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', text: 'Teks.' })).body.data.label).toBe('Petikan 1')
    expect((await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', label: 'Petikan A' })).body.data.label).toBe('Petikan A')
    const table = await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'table', table: { head: ['a', 'b'], rows: [['1', '2']] }, alt: 'Jadual' })
    expect(table.body.data.table).toEqual({ head: ['a', 'b'], rows: [['1', '2']] })
    expect((await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'diagram', svg: '<svg onload=alert(1)>' })).status).toBe(422)
    expect((await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'poster' })).status).toBe(422)
    expect((await post(teacher, '/intake/batches/987654321/stimuli', { kind: 'passage' })).status).toBe(404)
  })

  it('patch edits the fields; an empty patch is 422; an unknown stimulus is 404', async () => {
    const { batchId } = await batchWith(1)
    const s = (await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', text: 'Asal.' })).body.data
    const res = await patch(teacher, `/intake/stimuli/${s.id}`, { caption: 'Tajuk', alt: 'Penerangan', text: 'Baharu.' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toMatchObject({ caption: 'Tajuk', alt: 'Penerangan', text: 'Baharu.' })
    expect((await patch(teacher, `/intake/stimuli/${s.id}`, {})).status).toBe(422)
    expect((await patch(teacher, '/intake/stimuli/987654321', { caption: 'x' })).status).toBe(404)
  })

  it('attaching an item to a stimulus keeps the group contiguous and reports the move; delete detaches', async () => {
    const { batchId, ids } = await batchWith(3)
    const [a, b, c] = ids as [string, string, string]
    const s = (await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', text: 'Petikan.', alt: 'Petikan' })).body.data
    expect((await patch(teacher, `/intake/items/${a}`, { stimulusId: s.id })).body.reordered).toBe(false)
    const moved = await patch(teacher, `/intake/items/${c}`, { stimulusId: s.id })
    expect(moved.status, JSON.stringify(moved.body)).toBe(200)
    expect(moved.body.reordered).toBe(true)
    expect((await itemsOf(teacher, batchId)).map((i) => i.id)).toEqual([a, c, b])
    const sum = await review(batchId)
    expect(sum.groups).toEqual([{ stimulusId: s.id, itemIds: [a, c], from: '1', to: '3', contiguous: true }])

    expect((await patch(teacher, `/intake/items/${b}`, { stimulusId: '987654321' })).status).toBe(422)
    const detached = await patch(teacher, `/intake/items/${a}`, { stimulusId: null })
    expect(detached.body.data.stimulusId).toBeUndefined()

    const removed = await del(teacher, `/intake/stimuli/${s.id}`)
    expect(removed.status, JSON.stringify(removed.body)).toBe(200)
    expect(removed.body.data.detachedItemIds).toEqual([c])
    expect((await review(batchId)).stimuli).toHaveLength(0)
    expect((await del(teacher, `/intake/stimuli/${s.id}`)).status).toBe(404)
  })

  it('a stimulus of another batch cannot be attached', async () => {
    const one = await batchWith(1)
    const two = await batchWith(1)
    const s = (await post(teacher, `/intake/batches/${two.batchId}/stimuli`, { kind: 'passage', alt: 'x' })).body.data
    expect((await patch(teacher, `/intake/items/${one.ids[0]!}`, { stimulusId: s.id })).status).toBe(422)
  })
})

describe('accepting items of a stimulus group', () => {
  it('the first accept snapshots the stimulus into the bank, the next one joins the same group; the stimulus is then read-only', async () => {
    const { batchId, ids } = await batchWith(2)
    const s = (await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', text: 'Bacaan pendek untuk kumpulan.', alt: 'Bacaan', label: 'Petikan 1' })).body.data
    for (const id of ids) await patch(teacher, `/intake/items/${id}`, { stimulusId: s.id })
    const groupsBefore = Number((await t.db.query<{ n: string }>('select count(*)::text n from stimulus_groups'))[0]!.n)
    const stimuliBefore = Number((await t.db.query<{ n: string }>('select count(*)::text n from stimuli'))[0]!.n)

    for (const id of ids) {
      const res = await post(teacher, `/intake/items/${id}/accept`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
    expect(Number((await t.db.query<{ n: string }>('select count(*)::text n from stimulus_groups'))[0]!.n)).toBe(groupsBefore + 1)
    expect(Number((await t.db.query<{ n: string }>('select count(*)::text n from stimuli'))[0]!.n)).toBe(stimuliBefore + 1)
    const linked = await t.db.query<{ g: string | null }>(
      `select q.group_id::text g from questions q join intake_items i on i.question_id = q.id where i.batch_id = $1`,
      [batchId],
    )
    expect(linked).toHaveLength(2)
    expect(linked[0]!.g).toBeTruthy()
    expect(new Set(linked.map((r) => r.g)).size).toBe(1)

    const edit = await patch(teacher, `/intake/stimuli/${s.id}`, { caption: 'Terlambat' })
    expect(edit.status).toBe(409)
    expect(edit.body.error.message).toBe(INTAKE_MESSAGES.stimulusInUse)
    const gone = await del(teacher, `/intake/stimuli/${s.id}`)
    expect(gone.status).toBe(409)
    expect(gone.body.error.message).toBe(INTAKE_MESSAGES.stimulusInUse)
  })

  it('a diagram without alt text or a stored figure blocks accept; the batch summary lists it', async () => {
    const { batchId, ids } = await batchWith(1)
    const s = (await post(teacher, `/intake/batches/${batchId}/stimuli`, { kind: 'diagram' })).body.data
    await patch(teacher, `/intake/items/${ids[0]!}`, { stimulusId: s.id })
    const res = await post(teacher, `/intake/items/${ids[0]!}/accept`)
    expect(res.status).toBe(422)
    const messages = (res.body.error.details.issues as Array<{ message: string }>).map((i) => i.message)
    expect(messages.length).toBeGreaterThanOrEqual(2)
    const sum = await review(batchId)
    expect(sum.issues.some((i) => i.blocksAccept)).toBe(true)
  })
})
