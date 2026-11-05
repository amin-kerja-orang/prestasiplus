import { IntakeBulkResultEnvelopeSchema, IntakeItemEnvelopeSchema, IntakeItemListResponseSchema, INTAKE_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

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

async function extracted(over: Parameters<typeof draft>[2][] = [{}, {}]): Promise<{ batchId: string; ids: string[] }> {
  t.ai.paper = () => paper(over.map((o, i) => draft(t.codes, String(i + 1), o)))
  const { batchId } = await readyBatch(t, teacher)
  await extractAndRun(t, teacher, batchId)
  return { batchId, ids: (await itemsOf(teacher, batchId)).map((i) => i.id) }
}

describe('state machine (AC-2, transitions)', () => {
  it('the extractor can only produce generated or needs_review', async () => {
    const { batchId } = await extracted([{}, { lowFields: ['marks'], fieldConfidence: { marks: 0.4 } }, { needsManual: true }])
    const states = (await itemsOf(teacher, batchId)).map((i) => i.state)
    expect(states).toEqual(['generated', 'needs_review', 'needs_review'])
  })

  it('editing recomputes the state; the history keeps the previous text and marks the field as human edited', async () => {
    const { ids } = await extracted([{ lowFields: ['stem'], fieldConfidence: { stem: 0.5 } }])
    const id = ids[0]!
    const before = IntakeItemEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/items/${id}`)).body).data
    const res = await patch(teacher, `/intake/items/${id}`, { stem: 'Teks baharu yang disunting oleh guru.', confirmed: ['stem'] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.reordered).toBe(false)
    expect(res.body.data.state).toBe('generated')
    expect(res.body.data.stem).toBe('Teks baharu yang disunting oleh guru.')
    const events = res.body.data.events as Array<{ action: string; field: string | null; previous: unknown }>
    const edit = events.find((e) => e.action === 'edited' && e.field === 'stem')
    expect(edit?.previous).toBe(before.stem)
    expect(events.some((e) => e.action === 'confirmed' && e.field === 'stem')).toBe(true)
  })

  it('confirmed may list low fields only; needsManual can only be cleared', async () => {
    const { ids } = await extracted([{ needsManual: true }])
    const id = ids[0]!
    const bad = await patch(teacher, `/intake/items/${id}`, { confirmed: ['marks'] })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields.confirmed).toBeTruthy()
    const setTrue = await patch(teacher, `/intake/items/${id}`, { needsManual: true })
    expect(setTrue.status).toBe(422)
    const ok = await patch(teacher, `/intake/items/${id}`, { needsManual: false })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.data.state).toBe('generated')
    expect((await patch(teacher, `/intake/items/${id}`, {})).status).toBe(422)
  })

  it('reject needs a reason, is final, and an accepted or rejected item cannot be edited, accepted or rejected again', async () => {
    const { ids } = await extracted([{}, {}, {}])
    const [a, b, c] = ids as [string, string, string]
    expect((await post(teacher, `/intake/items/${a}/reject`, {})).status).toBe(422)
    expect((await post(teacher, `/intake/items/${a}/reject`, { reason: '   ' })).status).toBe(422)
    const rejected = await post(teacher, `/intake/items/${a}/reject`, { reason: 'Soalan di luar skop.' })
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200)
    expect(rejected.body.data.state).toBe('rejected')
    expect(rejected.body.data.rejectReason).toBe('Soalan di luar skop.')
    for (const res of [
      await post(teacher, `/intake/items/${a}/reject`, { reason: 'Lagi' }),
      await post(teacher, `/intake/items/${a}/accept`),
      await patch(teacher, `/intake/items/${a}`, { stem: 'x'.repeat(20) }),
      await post(teacher, `/intake/items/${a}/duplicate`, { decision: 'duplicate', matchedItemId: b }),
    ]) {
      expect(res.status).toBe(409)
      expect(res.body.error.message).toBe(INTAKE_MESSAGES.itemLocked)
    }
    expect((await post(teacher, `/intake/items/${b}/accept`)).status).toBe(200)
    const again = await post(teacher, `/intake/items/${b}/accept`)
    expect(again.status).toBe(409)
    expect(again.body.error.message).toBe(INTAKE_MESSAGES.itemAlreadyAccepted)
    expect((await post(teacher, `/intake/items/${b}/reject`, { reason: 'Terlambat' })).status).toBe(409)
    expect((await patch(teacher, `/intake/items/${b}`, { marks: 2 })).status).toBe(409)
    void c
  })

  it('a duplicate item cannot be accepted until the link is dismissed', async () => {
    const { ids } = await extracted([{}, {}])
    const [a, b] = ids as [string, string]
    const linked = await post(teacher, `/intake/items/${a}/duplicate`, { decision: 'duplicate', matchedItemId: b })
    expect(linked.status, JSON.stringify(linked.body)).toBe(200)
    expect(linked.body.data.state).toBe('duplicate')
    const refused = await post(teacher, `/intake/items/${a}/accept`)
    expect(refused.status).toBe(409)
    expect(refused.body.error.message).toBe(INTAKE_MESSAGES.itemIsDuplicate)
    const entry = (linked.body.data.duplicates as Array<{ id: string }>)[0]!
    const cleared = await post(teacher, `/intake/items/${a}/duplicate`, { decision: 'not_duplicate', duplicateId: entry.id })
    expect(cleared.status, JSON.stringify(cleared.body)).toBe(200)
    expect(cleared.body.data.state).toBe('generated')
    expect((await post(teacher, `/intake/items/${a}/accept`)).status).toBe(200)
  })
})

describe('quality gate on accept', () => {
  it('lists every failed rule (422, details.issues) and creates no question', async () => {
    const { ids } = await extracted([{ marks: 0, scheme: undefined as never, tag: { unit: 'TIDAK-WUJUD', sp: [] } }])
    const res = await post(teacher, `/intake/items/${ids[0]!}/accept`)
    expect(res.status).toBe(422)
    expect(res.body.error.message).toBe(INTAKE_MESSAGES.gateFailed)
    expect(res.body.error.details.issues.length).toBeGreaterThanOrEqual(2)
    const rows = await t.db.query<{ n: string }>(`select count(*)::text n from intake_items where id = $1 and question_id is not null`, [ids[0]])
    expect(rows[0]?.n).toBe('0')
    // The gate list is on the item too.
    const item = IntakeItemEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/items/${ids[0]!}`)).body).data
    expect(item.issues.length).toBe(res.body.error.details.issues.length)
  })
})

describe('add item', () => {
  it('adds a blank manual item with the next label, state generated; the gate asks for the missing content', async () => {
    const { batchId } = await extracted([{}, {}])
    const res = await post(teacher, `/intake/batches/${batchId}/items`, { page: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.label).toBe('3')
    expect(res.body.data.state).toBe('generated')
    expect(res.body.data.page).toBe(2)
    expect(res.body.data.provenance.sourceType).toBe('manual')
    expect((await post(teacher, `/intake/batches/${batchId}/items`, {})).status).toBe(201)
    expect((await post(teacher, `/intake/batches/${batchId}/items`, { extra: 1 })).status).toBe(422)
    expect((await post(teacher, `/intake/items/${res.body.data.id}/accept`)).status).toBe(422)
  })
})

describe('review queue', () => {
  it('filters by state, band and batch, pages the result and returns per-state counts', async () => {
    const { batchId } = await extracted([{}, { fieldConfidence: { stem: 0.8 } }, { fieldConfidence: { stem: 0.3 }, lowFields: ['stem'] }])
    const q = async (qs: string) => IntakeItemListResponseSchema.parse((await teacher.agent.get(`/api/intake/items?batchId=${batchId}&${qs}`)).body)
    expect((await q('band=high')).data).toHaveLength(1)
    expect((await q('band=medium')).data).toHaveLength(1)
    expect((await q('band=low')).data).toHaveLength(1)
    const all = await q('pageSize=2&page=2')
    expect(all.data).toHaveLength(1)
    expect(all.meta.totalItems).toBe(3)
    expect(all.meta.counts).toMatchObject({ generated: 2, needs_review: 1, accepted: 0, rejected: 0, duplicate: 0 })
    expect((await q('state=needs_review')).data).toHaveLength(1)
    expect((await q('duplicate=none')).data).toHaveLength(3)
    expect((await teacher.agent.get('/api/intake/items?state=bogus')).status).toBe(422)
  })
})

describe('bulk', () => {
  it('accept is Admin Pusat only, above the band threshold, through the same gate; reject needs a reason', async () => {
    const { batchId, ids } = await extracted([{}, { fieldConfidence: { stem: 0.8 } }, { marks: 0, scheme: undefined as never }])
    const [good, medium, broken] = ids as [string, string, string]
    const forbidden = await post(teacher, '/intake/items/bulk', { action: 'accept', ids: [good] })
    expect(forbidden.status).toBe(403)

    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids: [good, medium, broken, '999999999'] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const out = IntakeBulkResultEnvelopeSchema.parse(res.body).data
    expect(out.threshold).toBe('high')
    expect(out.results.map((r) => [r.outcome, r.reason])).toEqual([
      ['done', null],
      ['skipped', 'BELOW_THRESHOLD'],
      ['skipped', 'GATE_FAILED'],
      ['skipped', 'NOT_FOUND'],
    ])
    expect(out.done).toBe(1)
    expect(out.skipped).toBe(3)
    expect((await itemsOf(teacher, batchId)).map((i) => i.state)).toEqual(['accepted', 'generated', 'generated'])

    expect((await post(admin, '/intake/items/bulk', { action: 'reject', ids: [medium] })).status).toBe(422)
    const rejected = await post(teacher, '/intake/items/bulk', { action: 'reject', ids: [medium, good], reason: 'Tidak sesuai.' })
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200)
    expect(rejected.body.data.results.map((r: { outcome: string; reason: string | null }) => [r.outcome, r.reason])).toEqual([
      ['done', null],
      ['skipped', 'WRONG_STATE'],
    ])
    expect((await post(admin, '/intake/items/bulk', { action: 'accept', ids: [] })).status).toBe(422)
    expect((await post(admin, '/intake/items/bulk', { action: 'accept', ids: [medium, medium] })).status).toBe(422)
  })

  it('a high-band item that fails the gate is skipped with its issues, never dropped', async () => {
    const { ids } = await extracted([{ marks: 0, scheme: undefined as never }])
    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids })
    const r = res.body.data.results[0]
    expect(r.outcome).toBe('skipped')
    expect(r.reason).toBe('GATE_FAILED')
    expect(r.issues.length).toBeGreaterThan(0)
  })
})

describe('confidence band without data (fail closed)', () => {
  it('an AI item with an empty confidence map is low and is not taken by a bulk accept; a manual item stays high', async () => {
    const { batchId, ids } = await extracted([{ fieldConfidence: {} }])
    const item = IntakeItemEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/items/${ids[0]!}`)).body).data
    expect(item.confidenceBand).toBe('low')
    expect(IntakeItemListResponseSchema.parse((await teacher.agent.get(`/api/intake/items?batchId=${batchId}&band=low`)).body).data).toHaveLength(1)
    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids })
    expect(res.body.data.results[0]).toMatchObject({ outcome: 'skipped', reason: 'BELOW_THRESHOLD' })
    const manual = await post(teacher, `/intake/batches/${batchId}/items`, {})
    expect(manual.body.data.confidenceBand).toBe('high')
  })
})

describe('page parameter', () => {
  it('a huge page is 422 on fields.page, never a 500', async () => {
    const res = await teacher.agent.get('/api/intake/items?page=9007199254740991')
    expect(res.status).toBe(422)
    expect(res.body.error.fields.page).toBeTruthy()
    expect((await teacher.agent.get('/api/intake/items?page=2&pageSize=100')).status).toBe(200)
  })
})
