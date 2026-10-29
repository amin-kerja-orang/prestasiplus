/**
 * D1 (LEAD 29 Oct) preflight: `migrate:activity` refuses a stage built from an older DDL that lacks the article `excerpt` /
 * `content` columns, instead of failing mid-run on a raw SQL error (42703). Fake pool, no database.
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
  it('needs exactly the article excerpt and content', () => {
    expect(STAGED_COLUMNS_NEEDED).toEqual({ articles: ['excerpt', 'content'] })
  })

  it('passes on a stage made with the current DDL', async () => {
    const pool = poolWith(['id', 'slug', 'title', 'excerpt', 'content', 'author_id'])
    await expect(assertStagedColumns(pool as never, ['banners', 'articles'])).resolves.toBeUndefined()
    expect(pool.calls).toEqual([['staging_cloud', 'articles']])
  })

  it('refuses a stage from the older DDL (no excerpt, no content), naming the columns and the fix', async () => {
    const pool = poolWith(['id', 'slug', 'title', 'author_id'])
    const run = assertStagedColumns(pool as never, ['articles'])
    await expect(run).rejects.toBeInstanceOf(PreflightError)
    await expect(assertStagedColumns(pool as never, ['articles'])).rejects.toThrow(
      /staging_cloud\.articles lacks column\(s\) excerpt, content .*re-stage with the current spec/,
    )
  })

  it('names only the missing column', async () => {
    await expect(assertStagedColumns(poolWith(['id', 'excerpt']) as never, ['articles'])).rejects.toThrow(/lacks column\(s\) content \(/)
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
