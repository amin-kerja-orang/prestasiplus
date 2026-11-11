import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** KP-18 perf, migration 0267_perf_bank_stats_structured_index: additive only (an index, autovacuum settings, ANALYZE). The test database already ran it. */
describe('migration 0267 bank statistics and structured index', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('[CI] the partial index exists on approved structured versions', async () => {
    const rows = await db.query<{ def: string }>(`select indexdef def from pg_indexes where indexname = 'ix_qv_structured_live_level'`)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.def).toContain("status = 'approved'")
    expect(rows[0]!.def).toContain("type = 'structured'")
  })

  it('[CI] the bank tables auto-analyze at 1 percent', async () => {
    const rows = await db.query<{ relname: string; opts: string[] }>(
      `select relname, reloptions as opts from pg_class where relname in ('question_versions','questions','question_tags','question_parts','answer_keys') order by relname`,
    )
    expect(rows.map((r) => r.relname)).toEqual(['answer_keys', 'question_parts', 'question_tags', 'question_versions', 'questions'])
    for (const r of rows) expect(r.opts.join(',')).toContain('autovacuum_analyze_scale_factor=0.01')
  })

  it('[CI] NOT IN and NOT EXISTS give the same questions for the PKSK rule', async () => {
    const q = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) select 'manual', 1 from generate_series(1, 3) returning id::text`)).map((r) => r.id)
    await db.query(`insert into question_tags (question_id, kind, code) values ($1::bigint, 'pksk_domain', 'D'), ($2::bigint, 'pool', 'spm')`, [q[0], q[1]])
    const ids = q.join(',')
    const a = await db.query(`select q.id from questions q where q.id in (${ids}) and q.id not in (select pt.question_id from question_tags pt where pt.kind = 'pksk_domain') order by 1`)
    const b = await db.query(`select q.id from questions q where q.id in (${ids}) and not exists (select 1 from question_tags pt where pt.question_id = q.id and pt.kind = 'pksk_domain') order by 1`)
    expect(a).toEqual(b)
    expect(a).toHaveLength(2)
  })
})
