import { IntakeItemListResponseSchema, INTAKE_KIRIMAN_STATUSES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/** S1-T08 part 2 (API-Q-15, FR-ADM-Q12.1): `GET /intake/items?source=guru&kirimanStatus=...` over the stored item states. */
let t: WorkflowTestApp
let teacher: LoggedIn
let admin: LoggedIn
let guruIds: string[] // [generated, needs_review, duplicate, processing, selesai, ditolak]
let adminBatchItemIds: string[]

const list = async (qs: string) => {
  const res = await admin.agent.get(`/api/intake/items?${qs}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return IntakeItemListResponseSchema.parse(res.body)
}
const idsOf = async (qs: string) => (await list(`pageSize=100&${qs}`)).data.map((r) => r.id).sort()
/** Sets the status of version 1 of the item's question and whether it is the live version (`questions.live_version_no`). */
const setLive = async (itemId: string, status: string, live: boolean) => {
  await t.db.query(`update question_versions v set status = $2 from intake_items i where i.id = $1::bigint and v.question_id = i.question_id and v.version_no = 1`, [itemId, status])
  await t.db.query(`update questions q set live_version_no = ${live ? '1' : 'null'}, latest_version_no = 1 from intake_items i where i.id = $1::bigint and q.id = i.question_id`, [itemId])
  await t.db.query(`delete from question_versions v using intake_items i where i.id = $1::bigint and v.question_id = i.question_id and v.version_no > 1`, [itemId])
}
const sorted = (ids: string[]) => [...ids].sort()

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test')

  const six = [{}, { needsManual: true }, {}, {}, {}, {}]
  t.ai.paper = () => paper(six.map((o, i) => draft(t.codes, String(i + 1), o)))
  const { batchId } = await readyBatch(t, teacher)
  await extractAndRun(t, teacher, batchId)
  const ids = (await itemsOf(teacher, batchId)).map((i) => i.id)
  const [, , dup, processing, selesai, ditolak] = ids as [string, string, string, string, string, string]
  await t.db.query(`update intake_items set review_state = 'duplicate' where id = $1::bigint`, [dup])
  expect((await post(teacher, `/intake/items/${processing}/accept`)).status).toBe(200)
  expect((await post(teacher, `/intake/items/${selesai}/accept`)).status).toBe(200)
  expect((await post(teacher, `/intake/items/${ditolak}/reject`, { reason: 'Tidak sesuai.' })).status).toBe(200)
  // The accepted question of `selesai` is published (Diluluskan): approved and live; the one of `processing` stays a draft.
  await setLive(selesai, 'approved', true)
  await t.db.query(`update intake_batches set source = 'guru' where id = $1::bigint`, [batchId])
  guruIds = ids

  // An admin batch with its own items: never in `source=guru`.
  t.ai.paper = () => paper([draft(t.codes, '1'), draft(t.codes, '2')])
  const other = await readyBatch(t, admin)
  await extractAndRun(t, admin, other.batchId)
  adminBatchItemIds = (await itemsOf(admin, other.batchId)).map((i) => i.id)
}, 180_000)
afterAll(async () => {
  await t.close()
})

describe('GET /intake/items: source=guru and kirimanStatus (S1-T08)', () => {
  it('the keys are exactly the OPT-KIRIMAN-STATUS display keys of FR-ADM-Q12.1', () => {
    expect([...INTAKE_KIRIMAN_STATUSES]).toEqual(['Pending', 'Processing', 'Selesai', 'Ditolak', 'Jumlah'])
  })

  it('source=guru lists only the items of guru batches, never an admin batch', async () => {
    expect(await idsOf('source=guru')).toEqual(sorted(guruIds))
    const all = await idsOf('')
    for (const id of adminBatchItemIds) expect(all).toContain(id)
    for (const id of adminBatchItemIds) expect(await idsOf('source=guru')).not.toContain(id)
  })

  it.each([
    ['Pending', [0, 1, 2]],
    ['Processing', [3]],
    ['Selesai', [4]],
    ['Ditolak', [5]],
    ['Jumlah', [0, 1, 2, 3, 4, 5]],
  ] as const)('kirimanStatus=%s maps to its stored states', async (key, at) => {
    expect(await idsOf(`source=guru&kirimanStatus=${key}`)).toEqual(sorted(at.map((i) => guruIds[i]!)))
  })

  it('without source the status mapping still applies to every batch (Pending includes admin items)', async () => {
    const pending = await idsOf('kirimanStatus=Pending')
    for (const id of [...adminBatchItemIds, ...guruIds.slice(0, 3)]) expect(pending).toContain(id)
    expect(pending).not.toContain(guruIds[3])
  })

  it('combines with the existing `state` filter by AND; meta.totalItems and meta.counts follow the same scope', async () => {
    expect(await idsOf('source=guru&kirimanStatus=Pending&state=duplicate')).toEqual([guruIds[2]])
    expect(await idsOf('source=guru&kirimanStatus=Selesai&state=rejected')).toEqual([])
    const res = await list('source=guru&kirimanStatus=Pending&pageSize=2')
    expect(res.meta.totalItems).toBe(3)
    expect(res.data).toHaveLength(2)
    expect(res.meta.counts).toMatchObject({ accepted: 2, rejected: 1, duplicate: 1 })
  })

  it('a teacher sees only their own items through the same filter', async () => {
    const res = await teacher.agent.get('/api/intake/items?source=guru&kirimanStatus=Jumlah&pageSize=100')
    expect(res.status).toBe(200)
    expect(IntakeItemListResponseSchema.parse(res.body).data.map((r) => r.id).sort()).toEqual(sorted(guruIds))
  })

  it.each(['source=admin', 'source=', 'source=GURU', 'kirimanStatus=pending', 'kirimanStatus=Menunggu%20Semakan', 'kirimanStatus='])('422 for a bad value (%s)', async (qs) => {
    const res = await admin.agent.get(`/api/intake/items?${qs}`)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
  })

  it('unchanged without the new params: every item, the same counts, the existing state filter', async () => {
    const all = await list('pageSize=100')
    expect(all.meta.totalItems).toBe(guruIds.length + adminBatchItemIds.length)
    expect(all.meta.counts).toMatchObject({ generated: 1 + 2, needs_review: 1, accepted: 2, rejected: 1, duplicate: 1 })
    expect(await idsOf('state=accepted')).toEqual(sorted([guruIds[3]!, guruIds[4]!]))
  })
})

describe('Selesai reads the LIVE version of the question (D12)', () => {
  it('a newer draft on top of a live approved version: the item is still Selesai', async () => {
    const id = guruIds[4]!
    await setLive(id, 'approved', true)
    const cols = (await t.db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'question_versions' and column_name not in ('id', 'version_no', 'status', 'published_at', 'archive_reason') order by ordinal_position`,
    )).map((c) => c.column_name)
    const list = cols.map((c) => `"${c}"`).join(', ')
    const vlist = cols.map((c) => `v."${c}"`).join(', ')
    await t.db.query(
      `insert into question_versions (${list}, version_no, status)
         select ${vlist}, 2, 'draft' from question_versions v join intake_items i on i.question_id = v.question_id where i.id = $1::bigint and v.version_no = 1`,
      [id],
    )
    await t.db.query(`update questions q set latest_version_no = 2 from intake_items i where i.id = $1::bigint and q.id = i.question_id`, [id])
    expect(await idsOf('source=guru&kirimanStatus=Selesai')).toEqual([id])
    expect(await idsOf('source=guru&kirimanStatus=Processing')).toEqual([guruIds[3]])
    await setLive(id, 'approved', true)
  })

  it('latest version approved but not live, or live version not approved: the item is Processing', async () => {
    const id = guruIds[4]!
    await setLive(id, 'approved', false) // approved, live_version_no null
    expect(await idsOf('source=guru&kirimanStatus=Selesai')).toEqual([])
    expect(await idsOf('source=guru&kirimanStatus=Processing')).toEqual(sorted([guruIds[3]!, id]))
    await setLive(id, 'review', true) // live, but not approved
    expect(await idsOf('source=guru&kirimanStatus=Selesai')).toEqual([])
    expect(await idsOf('source=guru&kirimanStatus=Processing')).toEqual(sorted([guruIds[3]!, id]))
    await setLive(id, 'approved', true)
    expect(await idsOf('source=guru&kirimanStatus=Selesai')).toEqual([id])
  })
})
