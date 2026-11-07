import { IntakeBatchDetailEnvelopeSchema, IntakeBatchListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createBatch } from '../intake-files/helpers'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * REQ-C-009: `GET /api/intake/batches` rows carry `itemCount` ("Bilangan Soalan") and `reviewedCount` ("Disemak": items with no
 * unconfirmed low-confidence field), computed with one grouped query for the page.
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

const list = async () => IntakeBatchListResponseSchema.parse((await teacher.agent.get('/api/intake/batches?pageSize=50')).body).data
const rowOf = async (id: string) => (await list()).find((b) => b.id === id)!

describe('batch list: itemCount and reviewedCount', () => {
  it('counts the items of each batch on the page and those without an unconfirmed low field', async () => {
    t.ai.paper = () =>
      paper([
        draft(t.codes, '1'),
        draft(t.codes, '2', { lowFields: ['stem'], fieldConfidence: { stem: 0.5, marks: 0.97 } }),
        draft(t.codes, '3', { lowFields: ['stem', 'marks'], fieldConfidence: { stem: 0.5, marks: 0.5 } }),
      ])
    const a = (await readyBatch(t, teacher)).batchId
    await extractAndRun(t, teacher, a)
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const b = (await readyBatch(t, teacher)).batchId
    await extractAndRun(t, teacher, b)
    const empty = (await createBatch(teacher)).id // declared, nothing read

    expect(await rowOf(a)).toMatchObject({ itemCount: 3, reviewedCount: 1 })
    expect(await rowOf(b)).toMatchObject({ itemCount: 1, reviewedCount: 1 })
    expect(await rowOf(empty)).toMatchObject({ itemCount: 0, reviewedCount: 0 })

    // Confirming one of the two low fields of item 3 does not make it reviewed; confirming the last one does, and so does item 2.
    const items = await itemsOf(teacher, a)
    const [, second, third] = items
    expect((await patch(teacher, `/intake/items/${second!.id}`, { confirmed: ['stem'] })).status).toBe(200)
    expect(await rowOf(a)).toMatchObject({ itemCount: 3, reviewedCount: 2 })
    expect((await patch(teacher, `/intake/items/${third!.id}`, { confirmed: ['stem'] })).status).toBe(200)
    expect(await rowOf(a)).toMatchObject({ itemCount: 3, reviewedCount: 2 })
    expect((await patch(teacher, `/intake/items/${third!.id}`, { confirmed: ['stem', 'marks'] })).status).toBe(200)
    expect(await rowOf(a)).toMatchObject({ itemCount: 3, reviewedCount: 3 })

    // The detail carries the same two numbers; another batch is not mixed in.
    const detail = IntakeBatchDetailEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/batches/${a}`)).body).data
    expect(detail).toMatchObject({ itemCount: 3, reviewedCount: 3 })
    expect(await rowOf(b)).toMatchObject({ itemCount: 1, reviewedCount: 1 })
  })
})

describe('batch read: targetPaperId (DM-45)', () => {
  it('is null until a paper has source_batch_id of the batch, then carries that paper id (list and detail)', async () => {
    const a = (await createBatch(teacher)).id
    const b = (await createBatch(teacher)).id
    expect(await rowOf(a)).toMatchObject({ targetPaperId: null })
    const detail0 = IntakeBatchDetailEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/batches/${a}`)).body).data
    expect(detail0.targetPaperId).toBeNull()

    const subjectId = (await t.db.query<{ id: string }>(`insert into subjects (code, name, name_en, color, is_active, sort_order) values ('T0163', 'T', 'T', '#112233', true, 0) returning id::text id`))[0]!.id
    const paperId = (
      await t.db.query<{ id: string }>(
        `insert into papers (kind, title, subject_id, kertas, printed_duration_min, paper_code, source_batch_id) values ('pilihan', 'p', $1, 1, 60, 'K1', $2) returning id::text id`,
        [subjectId, a],
      )
    )[0]!.id

    expect(await rowOf(a)).toMatchObject({ targetPaperId: paperId })
    expect(await rowOf(b)).toMatchObject({ targetPaperId: null })
    const detail = IntakeBatchDetailEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/batches/${a}`)).body).data
    expect(detail.targetPaperId).toBe(paperId)
  })
})
