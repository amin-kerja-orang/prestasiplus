/**
 * `migrate:activity` reads every staged row when a table has more rows than one page (MIG-07 rehearsal blocker:
 * a lexicographic page order skipped rows). Question attempts (readById) and exam attempts get 40 rows, ids 1..40,
 * and the run uses a page size of 5; `sourceCount` of the reconciliation is the number of rows read.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootActivity, type ActivityHarness } from './helpers'

let h: ActivityHarness

/** Copies row 1 of `table` to ids 2..`to` (every other column as it is), so a table has `to` rows. */
async function plantRows(table: string, to: number): Promise<void> {
  const cols = (
    await h.q<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'staging_cloud' and table_name = $1
       and column_name not in ('id', '_loaded_at', '_row_hash') order by ordinal_position`,
      [table],
    )
  ).map((c) => `"${c.column_name}"`)
  await h.q(`delete from staging_cloud.${table} where id > 1`)
  await h.q(`insert into staging_cloud.${table} (id, ${cols.join(', ')}) select g, ${cols.join(', ')} from staging_cloud.${table} t, generate_series(2, ${to}) g where t.id = 1`)
}

beforeAll(async () => {
  h = await bootActivity()
  await h.q(`insert into staging_cloud.question_attempts (id) select 1 where not exists (select 1 from staging_cloud.question_attempts where id = 1)`)
  await h.q(`insert into staging_cloud.exam_attempts (id) select 1 where not exists (select 1 from staging_cloud.exam_attempts where id = 1)`)
  await plantRows('question_attempts', 40)
  await plantRows('exam_attempts', 40)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('migrate:activity with a page size below the row count', () => {
  it('reads all 40 question attempts (practice_answers) and all 40 exam attempts', async () => {
    const small = await h.run('dry-run', { pageSize: 5 })
    expect(small.report.status).toBe('succeeded')
    const read = Object.fromEntries(small.report.recon.map((r) => [r.entity, r.sourceCount]))
    expect(read.practice_answers).toBe(40)
    expect(read.exam_attempts).toBe(40)
    const big = await h.run('dry-run', { pageSize: 1000 })
    const pick = (r: typeof small) => r.report.recon.map((x) => [x.entity, x.sourceCount, x.eligibleCount, x.loaded, x.rejected])
    expect(pick(small)).toEqual(pick(big))
  }, 240_000)
})
