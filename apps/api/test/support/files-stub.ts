import type { TestDatabase } from './db'

/** T-C13: the `FilesService.publicIdsOf` the practice source needs to show a picture (internal file id -> public token), read straight from `files`. */
export const filesOf = (db: Pick<TestDatabase, 'query'>) => ({
  publicIdsOf: async (ids: readonly string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map()
    const rows = await db.query<{ id: string; public_id: string }>(`select id::text id, public_id from files where id = any($1::bigint[])`, [ids])
    return new Map(rows.map((r) => [r.id, r.public_id]))
  },
})
