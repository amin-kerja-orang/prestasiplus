import { QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { FILTER_ACTION_CAP } from '../../src/modules/questions/questions.service'
import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { countOf, mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * AC-03.3 / D79: V2 "Luluskan Hasil Tapisan" and "Arkib Semua" act on the CURRENT FILTER (docs/qa/r1-admin-parity-check.md B3;
 * docs/design/v2-admin-student-pipeline.md bulk dialogs). `POST /api/questions/bulk-action/filter`.
 */
describe('filter-based bulk action (Luluskan Hasil Tapisan, Arkib Semua)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>
  let yearSeq = 2100

  const post = (client: Client, body: unknown) => client.post('/api/questions/bulk-action/filter', body)
  const statusOf = async (id: string): Promise<string> => (await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1 order by version_no desc limit 1`, [id]))[0]!.status

  /** A source paper with its own year (so a filter `tahun` selects exactly the rows made for it) and the questions made for it. */
  async function batch(spec: { review?: number; untagged?: number; draft?: number }): Promise<{ year: string; review: string[]; untagged: string[]; draft: string[] }> {
    const year = String(yearSeq++)
    const sp = (await t.db.query<{ id: string }>(`insert into source_papers (year, exam_board, exam_type, rights_status) values ($1, 'LPM', 'sebenar', 'own') returning id::text`, [Number(year)]))[0]!.id
    const make = async (withTag: boolean, status: 'draft' | 'review'): Promise<string> => {
      const res = await admin.post('/api/questions', mcqBody(refs, { questionText: `Soalan tapisan ${year} nombor ${yearSeq}-${Math.random().toString(36).slice(2, 8)}.`, ...(withTag ? { tag } : {}) }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
      await t.db.query(`update question_versions set source_paper_id = $1::bigint where question_id = $2`, [sp, id])
      if (status === 'review') {
        const r = await admin.post('/api/questions/bulk-action', { action: 'review', ids: [id] })
        expect(r.status, JSON.stringify(r.body)).toBe(200)
        expect((r.body as { data: { failed: unknown[] } }).data.failed).toEqual([])
      }
      return id
    }
    const out = { year, review: [] as string[], untagged: [] as string[], draft: [] as string[] }
    for (let i = 0; i < (spec.review ?? 0); i++) out.review.push(await make(true, 'review'))
    for (let i = 0; i < (spec.untagged ?? 0); i++) out.untagged.push(await make(false, 'review'))
    for (let i = 0; i < (spec.draft ?? 0); i++) out.draft.push(await make(true, 'draft'))
    return out
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('Luluskan Hasil Tapisan: approves the Semakan rows of the filter, refuses the ones that fail the gate row by row, skips the rest', async () => {
    const b = await batch({ review: 3, untagged: 1, draft: 1 })
    const res = await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const data = res.body.data
    expect(data).toMatchObject({ matched: 5, eligible: 4, skipped: 1, cap: FILTER_ACTION_CAP, processed: 4, affected: 3, remaining: 0, capped: false, dryRun: false })
    expect(res.body.status).toBe('Berjaya luluskan 3 soalan (hasil tapisan) — kini kelihatan kepada pelajar.')
    // The refused row: same shape as bulk-action `failed[]`, the gate field messages in BM.
    expect(data.failed).toHaveLength(1)
    expect(data.failed[0]).toMatchObject({ id: b.untagged[0], code: 'VALIDATION_ERROR' })
    expect(Object.keys(data.failed[0].fields).length).toBeGreaterThan(0)
    expect(data.failed[0].fields.unitId ?? data.failed[0].fields.spIds ?? Object.values(data.failed[0].fields)[0]).toMatch(/\S/)
    for (const id of b.review) expect(await statusOf(id)).toBe('approved')
    expect(await statusOf(b.untagged[0]!)).toBe('review') // untouched
    expect(await statusOf(b.draft[0]!)).toBe('draft') // draft cannot go to approved: skipped, not a failure
    // The status events of the applied rows name the admin.
    const ev = await countOf(t.db, `select count(*) n from question_status_events where question_id = any($1::bigint[]) and to_status = 'approved' and actor_user_id = $2`, [b.review, admin.userId])
    expect(ev).toBe(3)
  })

  it('a second run of the same filter has nothing new to approve (the refused row is tried again, nothing else)', async () => {
    const b = await batch({ review: 1, untagged: 1 })
    expect((await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: 2 })).body.data).toMatchObject({ affected: 1, failed: [expect.anything()] })
    const again = await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: 2 })
    expect(again.body.data).toMatchObject({ matched: 2, eligible: 1, skipped: 1, processed: 1, affected: 0 })
    expect(again.body.data.failed).toHaveLength(1)
  })

  it('a count that is not the one the client showed is 409 with the BM message and nothing is applied', async () => {
    const b = await batch({ review: 2 })
    const res = await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: 5 })
    const error = expectError(res, 'CONFLICT')
    expect(error.message).toBe('Bilangan soalan hasil tapisan telah berubah (dijangka 5, kini 2). Muat semula senarai dan semak semula sebelum meneruskan.')
    expect((res.body as { error: { details: unknown } }).error.details).toEqual({ expected: 5, actual: 2 })
    for (const id of b.review) expect(await statusOf(id)).toBe('review')
    // A stale filter that matches MORE rows than shown is refused the same way.
    expectError(await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: 1 }), 'CONFLICT')
    for (const id of b.review) expect(await statusOf(id)).toBe('review')
  })

  it('dryRun counts only: nothing is applied, expectedCount is optional', async () => {
    const b = await batch({ review: 2, draft: 1 })
    const res = await post(admin, { action: 'approved', filter: { tahun: b.year }, dryRun: true })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toMatchObject({ matched: 3, eligible: 2, skipped: 1, processed: 0, affected: 0, remaining: 2, capped: false, dryRun: true })
    for (const id of b.review) expect(await statusOf(id)).toBe('review')
  })

  it('the cap: one run applies at most `cap` rows and reports remaining/capped; the next run continues', async () => {
    const b = await batch({ review: 5 })
    const svc = t.app.get(QuestionsService)
    const actor = { userId: admin.userId, role: 'admin' as const }
    const first = await svc.bulkByFilter({ action: 'approved', filter: { tahun: b.year }, expectedCount: 5 }, actor, 2)
    expect(first).toMatchObject({ matched: 5, eligible: 5, cap: 2, processed: 2, affected: 2, remaining: 3, capped: true })
    const second = await svc.bulkByFilter({ action: 'approved', filter: { tahun: b.year }, expectedCount: 5 }, actor, 2)
    expect(second).toMatchObject({ matched: 5, eligible: 3, skipped: 2, processed: 2, affected: 2, remaining: 1, capped: true })
    const third = await svc.bulkByFilter({ action: 'approved', filter: { tahun: b.year }, expectedCount: 5 }, actor, 2)
    expect(third).toMatchObject({ processed: 1, affected: 1, remaining: 0, capped: false })
    for (const id of b.review) expect(await statusOf(id)).toBe('approved')
    expect(FILTER_ACTION_CAP).toBe(500)
  })

  it('Arkib Semua: archives Draf, Semakan and Diterbitkan rows of the filter; the V2 text when the filter is empty', async () => {
    const b = await batch({ review: 2, draft: 1 })
    expect((await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: 3 })).body.data.affected).toBe(2)
    const res = await post(admin, { action: 'archived', filter: { tahun: b.year }, expectedCount: 3 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toMatchObject({ matched: 3, eligible: 3, skipped: 0, affected: 3, remaining: 0 })
    expect(res.body.status).toBe('Berjaya arkib 3 soalan (hasil tapisan).')
    for (const id of [...b.review, ...b.draft]) expect(await statusOf(id)).toBe('archived')
    // Archiving a live question ends its serving.
    const live = await countOf(t.db, `select count(*) n from questions where id = any($1::bigint[]) and live_version_no is not null`, [b.review])
    expect(live).toBe(0)

    // The whole bank: an empty filter is allowed for archive only, with the count of the whole filter.
    const total = (await admin.get('/api/questions?pageSize=1')).body.meta.totalItems as number
    const all = await post(admin, { action: 'archived', filter: {}, expectedCount: total })
    expect(all.status, JSON.stringify(all.body)).toBe(200)
    expect(all.body.status).toBe(`Berjaya arkib ${String(all.body.data.affected)} soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula.`)
    expect(await countOf(t.db, `select count(*) n from questions where live_version_no is not null`)).toBe(0)
  })

  it('refuses a bad request with 422 and the BM message, applying nothing', async () => {
    const b = await batch({ review: 1 })
    const noFilter = expectError(await post(admin, { action: 'approved', filter: {}, expectedCount: 1 }), 'VALIDATION_ERROR')
    expect(noFilter.fields?.filter).toBe('Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal.')
    const noCount = expectError(await post(admin, { action: 'approved', filter: { tahun: b.year } }), 'VALIDATION_ERROR')
    expect(noCount.fields?.expectedCount).toBe('Sila hantar bilangan soalan hasil tapisan yang dipaparkan (expectedCount).')
    expectError(await post(admin, { action: 'delete', filter: { tahun: b.year }, expectedCount: 1 }), 'VALIDATION_ERROR')
    expectError(await post(admin, { action: 'review', filter: { tahun: b.year }, expectedCount: 1 }), 'VALIDATION_ERROR')
    expectError(await post(admin, { action: 'approved', filter: { tahun: b.year, bogus: '1' }, expectedCount: 1 }), 'VALIDATION_ERROR') // strict filter
    expectError(await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: 1, ids: ['1'] }), 'VALIDATION_ERROR') // strict body
    expectError(await post(admin, { action: 'approved', filter: { tahun: '24' }, expectedCount: 1 }), 'VALIDATION_ERROR')
    expectError(await post(admin, { action: 'approved', filter: { kertas: '4' }, expectedCount: 1 }), 'VALIDATION_ERROR')
    expectError(await post(admin, { action: 'approved', filter: { tahun: b.year }, expectedCount: -1 }), 'VALIDATION_ERROR')
    expectError(await post(admin, { action: 'approved', filter: { search: 'x'.repeat(101) }, expectedCount: 1 }), 'VALIDATION_ERROR')
    expect(await statusOf(b.review[0]!)).toBe('review')
  })

  it('Admin Pusat only, with a session and a CSRF token', async () => {
    const b = await batch({ review: 1 })
    const body = { action: 'approved', filter: { tahun: b.year }, expectedCount: 1 }
    expectError(await post(teacher, body), 'FORBIDDEN')
    expect((await t.http().post('/api/questions/bulk-action/filter').send(body)).status).toBe(401)
    expect((await admin.noCsrf.post('/api/questions/bulk-action/filter', body)).status).toBe(403)
    expect(await statusOf(b.review[0]!)).toBe('review')
  })
})
