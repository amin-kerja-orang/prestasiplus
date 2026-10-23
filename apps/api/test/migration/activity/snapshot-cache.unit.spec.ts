/**
 * The per-run snapshot cache of `readSnapshotDims` (AM-08c): a question id is read from the archive once per run,
 * found or not, and the result is the same as without the cache. No database: the executor is a fake that records
 * the ids it is asked for. Values are fictitious; ids are surrogate.
 */
import type pg from 'pg'
import { describe, expect, it } from 'vitest'

import type { SqlExecutor } from '../../../src/migration/kit/types'
import { readSnapshotDims, type RawDims } from '../../../src/migration/snapshot-dims'

const ARCHIVE = new Set(['11', '12', '13'])

function fakeArchive(): { db: SqlExecutor; asked: string[][] } {
  const asked: string[][] = []
  const db: SqlExecutor = {
    async query<R extends pg.QueryResultRow>(_text: string, values?: unknown[]): Promise<pg.QueryResult<R>> {
      const ids = (values?.[0] as string[]) ?? []
      asked.push([...ids])
      const rows = ids.filter((id) => ARCHIVE.has(id)).map((id) => ({
        id,
        subject_id: '1',
        education_level_id: '2',
        chapter_id: null,
        topic_id: null,
        difficulty: 'mudah',
        qtype: 'mcq',
        stem: `Soalan ${id}`,
        options: ['A', 'B'],
        natural_key: null,
        number_label: null,
      }))
      return { rows: rows as unknown as R[], rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }
    },
  }
  return { db, asked }
}

describe('readSnapshotDims cache', () => {
  it('reads each id once per run, found or not, and returns the same dims as an uncached read', async () => {
    const { db, asked } = fakeArchive()
    const cache = new Map<string, RawDims | null>()

    const first = await readSnapshotDims(db, ['11', '12', '99'], cache)
    const second = await readSnapshotDims(db, ['12', '13', '99'], cache)

    expect(asked).toEqual([['11', '12', '99'], ['13']])
    expect([...first.keys()].sort()).toEqual(['11', '12'])
    expect([...second.keys()].sort()).toEqual(['12', '13'])
    expect(cache.get('99')).toBeNull()

    const uncached = await readSnapshotDims(fakeArchive().db, ['12', '13', '99'])
    expect(second).toEqual(uncached)
  })

  it('sends no query when every id is cached', async () => {
    const { db, asked } = fakeArchive()
    const cache = new Map<string, RawDims | null>()
    await readSnapshotDims(db, ['11', '99'], cache)
    await readSnapshotDims(db, ['99', '11'], cache)
    expect(asked).toHaveLength(1)
  })
})
