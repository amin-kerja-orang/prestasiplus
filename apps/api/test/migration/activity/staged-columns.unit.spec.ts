/**
 * D1 (LEAD 29 Oct) preflight: `migrate:activity` refuses a stage built from an older DDL that lacks the article `body`
 * column (the .cloud article HTML), instead of failing mid-run on a raw SQL error (42703). Fake pool, no database.
 */
import { describe, expect, it } from 'vitest'

import { assertStagedColumns, PreflightError, STAGED_COLUMNS_NEEDED } from '../../../src/migration/load/activity'

const poolWith = (columns: string[]) => {
  const calls: unknown[][] = []
  return {
    calls,
    async query(_sql: string, params?: unknown[]) {
      calls.push(params ?? [])
      return { rows: columns.map((column_name) => ({ column_name })), rowCount: columns.length }
    },
  }
}

describe('staged-column preflight (D1)', () => {
  it('needs exactly the article body (.cloud has no excerpt or content column)', () => {
    expect(STAGED_COLUMNS_NEEDED).toEqual({ articles: ['body'] })
  })

  it('passes on a stage made with the current DDL', async () => {
    const pool = poolWith(['id', 'slug', 'title', 'body', 'author_id'])
    await expect(assertStagedColumns(pool as never, ['banners', 'articles'])).resolves.toBeUndefined()
    expect(pool.calls).toEqual([['staging_cloud', 'articles']])
  })

  it('refuses a stage from the older DDL (no body), naming the column and the fix', async () => {
    const pool = poolWith(['id', 'slug', 'title', 'author_id'])
    const run = assertStagedColumns(pool as never, ['articles'])
    await expect(run).rejects.toBeInstanceOf(PreflightError)
    await expect(assertStagedColumns(pool as never, ['articles'])).rejects.toThrow(
      /staging_cloud\.articles lacks column\(s\) body .*re-stage with the current spec/,
    )
  })

  it('refuses a stage that has the never-existing excerpt / content columns but no body', async () => {
    await expect(assertStagedColumns(poolWith(['id', 'excerpt', 'content']) as never, ['articles'])).rejects.toThrow(/lacks column\(s\) body \(/)
  })

  it('refuses when the staged table does not exist', async () => {
    await expect(assertStagedColumns(poolWith([]) as never, ['articles'])).rejects.toThrow(/staging_cloud\.articles does not exist/)
  })

  it('does not look at articles when the run does not load them', async () => {
    const pool = poolWith([])
    await expect(assertStagedColumns(pool as never, ['banners', 'notes'])).resolves.toBeUndefined()
    expect(pool.calls).toEqual([])
  })
})
