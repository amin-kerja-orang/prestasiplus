import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { isMigrationOwnedUneditedPaper, pgExecutor } from '../../src/modules/exam/builder'
import { FakeBank, matBank } from './fakes'
import { bootBuilderApp, type BuilderTestApp } from './helpers'

vi.setConfig({ testTimeout: 120_000 })

/**
 * KP-14 P-6: `isMigrationOwnedUneditedPaper` is the one rule of "a paper the migration created and nobody edited" (shared by `publishLegacyV2` and the
 * papers recompute). A draft is not held to `updated_at = published_at`; a published paper is. Synthetic rows only.
 */
describe('isMigrationOwnedUneditedPaper', () => {
  let t: BuilderTestApp
  let bank: FakeBank
  let subject: string
  let n = 0

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const owned = (id: string) => isMigrationOwnedUneditedPaper(t.app.get(PrismaService).client, id)

  /** A paper as the migration loads it: a row, an `etl_id_map` entry and no audit rows. */
  async function loaded(over: { status?: 'draft' | 'published'; mapped?: boolean } = {}): Promise<string> {
    const status = over.status ?? 'draft'
    const id = String(
      (
        await q(
          `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at, updated_at)
           values ('pilihan', $1, $2, 2, 60, $3, ${status === 'published' ? 'now()' : 'null'}, now()) returning id::text id`,
          [`Kertas V2 ${String(++n)}`, subject, status],
        )
      )[0]!.id,
    )
    if (status === 'published') await q(`update papers set updated_at = published_at where id = $1`, [id])
    if (over.mapped !== false) await q(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'exam_papers', $1, $2)`, [`own-${String(n)}`, id])
    return id
  }
  const audit = (id: string, action: string, requestId: string | null) =>
    q(`insert into audit_events (action, target_type, target_id, request_id) values ($1, 'bijak_paper', $2, $3)`, [action, id, requestId])

  beforeAll(async () => {
    bank = matBank()
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank })
    subject = String((await q(`select id::text id from subjects where code = 'MATH'`))[0]!.id)
  })
  afterAll(async () => {
    await t.close()
  })

  it('an unedited draft is owned (no Terbit audit rows at all)', async () => {
    expect(await owned(await loaded())).toEqual({ owned: true })
  })

  it('an edited draft is not owned (a Studio audit row with a request id, or an admin-added Bahagian, or version 2)', async () => {
    const a = await loaded()
    await audit(a, 'bijak.paper.updated', 'req-1')
    expect(await owned(a)).toEqual({ owned: false, reason: 'edited_audit_events' })
    const b = await loaded()
    await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget, admin_created) values ($1, 1, 'A', 1, 1, true)`, [b])
    expect(await owned(b)).toEqual({ owned: false, reason: 'admin_added_bahagian' })
    const c = await loaded()
    await q(`update papers set version = 2 where id = $1`, [c])
    expect(await owned(c)).toEqual({ owned: false, reason: 'version_not_1' })
  })

  it('an unedited published paper is owned (updated_at = published_at; the migration Terbit rows with no request id are allowed)', async () => {
    const id = await loaded({ status: 'published' })
    await audit(id, 'bijak.paper.published', null)
    expect(await owned(id)).toEqual({ owned: true })
  })

  it('an edited published paper is not owned (updated after Terbit, or a Studio audit row)', async () => {
    const a = await loaded({ status: 'published' })
    await q(`update papers set updated_at = published_at + interval '1 minute' where id = $1`, [a])
    expect(await owned(a)).toEqual({ owned: false, reason: 'updated_after_publish' })
    const b = await loaded({ status: 'published' })
    await audit(b, 'bijak.paper.published', 'req-2')
    expect(await owned(b)).toEqual({ owned: false, reason: 'edited_audit_events' })
  })

  it('the same rule through the pg executor (what the migration passes) and with an explicit legacy source', async () => {
    const id = await loaded()
    const exec = pgExecutor({ query: async (s, p) => ({ rows: await t.db.query<Record<string, unknown>>(s, p) }) })
    expect(await isMigrationOwnedUneditedPaper(exec, id)).toEqual({ owned: true })
    expect(await isMigrationOwnedUneditedPaper(exec, id, { legacySource: 'cloud' })).toEqual({ owned: true })
    expect(await isMigrationOwnedUneditedPaper(exec, id, { legacySource: 'other' })).toEqual({ owned: false, reason: 'no_etl_id_map_entry' })
  })

  it('a paper with no etl_id_map exam_papers entry is not owned; an unknown or non-numeric id is not found', async () => {
    expect(await owned(await loaded({ mapped: false }))).toEqual({ owned: false, reason: 'no_etl_id_map_entry' })
    expect(await owned('987654321')).toEqual({ owned: false, reason: 'not_found' })
    expect(await owned('abc')).toEqual({ owned: false, reason: 'not_found' })
  })
})
