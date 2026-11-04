import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, expectError, loginAs, post, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * S1-T08: a teacher's DOCX/XLSX is stored with no pages (intake_files.page_count null, status done). Starting extraction on a batch
 * that has only such files is refused (409, the existing "not extractable" answer) and is a safe no-op: no run, no job, no state change.
 */
describe('extraction on a batch with no pages', () => {
  let t: WorkflowTestApp
  let admin: LoggedIn
  let batchId: string

  beforeAll(async () => {
    t = await bootWorkflowApp()
    admin = await loginAs(t, 'admin@demo.test')
    const file = (
      await t.db.query<{ id: string }>(
        `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key)
         values ('${'q'.repeat(22)}', 'intake_original', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 10, repeat('b', 64), 'intake-original/office-only.docx') returning id::text`,
      )
    )[0]!.id
    batchId = (
      await t.db.query<{ id: string }>(
        `insert into intake_batches (source, status, paper_type, subject, kertas, year, source_text, rights_status)
         values ('guru', 'ready_for_review', 'umum', 'Matematik', null, 2025, 'Kiriman guru', 'own') returning id::text`,
      )
    )[0]!.id
    await t.db.query(
      `insert into intake_files (batch_id, file_id, original_name, sha256, size_bytes, page_count, status)
       values ($1::bigint, $2::bigint, 'soalan.docx', repeat('b', 64), 10, null, 'done')`,
      [batchId, file],
    )
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers 409 and changes nothing', async () => {
    const jobs = async (): Promise<number> => Number((await t.db.query<{ n: string }>('select count(*)::text n from jobs'))[0]?.n)
    const before = await jobs()
    const res = await post(admin, `/intake/batches/${batchId}/extract`)
    expectError(res, 'CONFLICT')
    expect(await jobs()).toBe(before)
    expect(Number((await t.db.query<{ n: string }>('select count(*)::text n from intake_extraction_runs'))[0]?.n)).toBe(0)
    expect((await t.db.query<{ status: string }>(`select status from intake_batches where id = $1::bigint`, [batchId]))[0]?.status).toBe('ready_for_review')
  })
})
