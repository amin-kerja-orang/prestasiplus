/**
 * R1E2E-10 (Mandor Q16): a bulk Terbitkan (`POST /questions/bulk-action` `approved`) on a question that is already Diterbitkan is an
 * idempotent no-op. It is not an error ("Peralihan 'Diterbitkan' -> 'Diterbitkan' tidak dibenarkan." was the old answer), it is not counted in
 * `affected`, it gets the reason "Soalan ini sudah diterbitkan." in `failed[]` (CONFLICT, shape unchanged), it writes no status event and it is
 * not in the audit ids; the other rows of the batch are still published. The single `POST /questions/:id/status` keeps its 409.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

const ALREADY = 'Soalan ini sudah diterbitkan.'
const OLD_CONFLICT = "Peralihan 'Diterbitkan' -> 'Diterbitkan' tidak dibenarkan."

describe('R1E2E-10: bulk Terbitkan of an already Diterbitkan row is a no-op', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  /** A question in Semakan (Lulus), ready for Terbit. */
  const review = async (): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'review', tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body as { data: { id: string } }).data.id
  }
  /** A question already Diterbitkan. */
  const published = async (): Promise<string> => {
    const id = await review()
    const out = await bulk([id])
    expect(out.data, JSON.stringify(out)).toEqual({ affected: 1, failed: [] })
    return id
  }
  const bulk = async (ids: string[]) => {
    const res = await admin.post('/api/questions/bulk-action', { action: 'approved', ids })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body as { data: { affected: number; failed: { id: string; code: string; message: string; fields: Record<string, string> }[] }; status?: string }
  }
  const events = async (ids: string[]) =>
    Number((await t.db.query<{ n: string }>(`select count(*)::text n from question_status_events where question_id = any($1::bigint[])`, [ids]))[0]?.n)
  const auditIds = async (): Promise<string[][]> =>
    (await t.db.query<{ detail: { ids?: string[] } }>(`select detail from audit_events where action = 'question.bulk_action' order by id`)).map((r) => r.detail.ids ?? [])
  const status = async (id: string) =>
    (await t.db.query<{ status: string; n: number }>(`select status, version_no n from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id]))[0]!

  it('a mixed batch (Lulus + Diterbitkan): the Lulus rows are published, the Diterbitkan rows are skipped with the reason, affected counts the published only', async () => {
    const [r1, r2] = [await review(), await review()] as [string, string]
    const [p1, p2] = [await published(), await published()] as [string, string]
    const before = await events([r1, r2, p1, p2])
    const versionsBefore = [await status(p1), await status(p2)]

    const out = await bulk([p1, r1, p2, r2])
    expect(out.data.affected).toBe(2)
    expect(out.data.failed).toEqual([
      { id: p1, code: 'CONFLICT', message: ALREADY, fields: {} },
      { id: p2, code: 'CONFLICT', message: ALREADY, fields: {} },
    ])
    expect(JSON.stringify(out)).not.toContain('Peralihan')
    expect((await status(r1)).status).toBe('approved')
    expect((await status(r2)).status).toBe('approved')
    // the skipped rows: untouched (same version, still Diterbitkan), no status event, not in the audit ids
    expect([await status(p1), await status(p2)]).toEqual(versionsBefore)
    expect(await events([r1, r2, p1, p2])).toBe(before + 2) // one event per really published row
    expect(await events([p1, p2])).toBe(2) // only the two events of their own earlier Terbit
    const last = (await auditIds()).at(-1)!
    expect([...last].sort()).toEqual([r1, r2].sort())
  })

  it('an all-Diterbitkan batch: affected 0, a reason on each row, no error (200), nothing written', async () => {
    const [p1, p2] = [await published(), await published()] as [string, string]
    const before = await events([p1, p2])
    const out = await bulk([p1, p2])
    expect(out.data).toEqual({
      affected: 0,
      failed: [
        { id: p1, code: 'CONFLICT', message: ALREADY, fields: {} },
        { id: p2, code: 'CONFLICT', message: ALREADY, fields: {} },
      ],
    })
    expect(await events([p1, p2])).toBe(before)
    expect((await auditIds()).at(-1)).toEqual([])
    expect(JSON.stringify(out)).not.toContain(OLD_CONFLICT)
  })

  it('the service call behind the single status route still refuses Diterbitkan -> Diterbitkan with the transition text (409), without the bulk option', async () => {
    const id = await published()
    const svc = t.app.get(QuestionsService)
    await expect(svc.setStatus(id, 'approved', admin.userId)).rejects.toMatchObject({ code: 'CONFLICT', message: OLD_CONFLICT })
  })

  it('other refusals are unchanged: a Draf row in a Terbitkan batch is still the transition conflict, a Diterbitkan row beside it is the no-op', async () => {
    const draft = (await admin.post('/api/questions', mcqBody(refs, { tag }))).body.data.id as string
    const p = await published()
    const out = await bulk([draft, p])
    expect(out.data.affected).toBe(0)
    expect(out.data.failed.map((f) => [f.id, f.message])).toEqual([[draft, "Peralihan 'Draf' -> 'Diterbitkan' tidak dibenarkan."], [p, ALREADY]])
  })
})
