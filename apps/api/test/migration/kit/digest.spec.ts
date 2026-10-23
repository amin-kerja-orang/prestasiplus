import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { renderDdl } from '../../../src/migration/ddl/render'
import { tableDigest } from '../../../src/migration/kit'
import { stagingFingerprint } from '../../../src/migration/load'
import { tableFingerprints } from '../../../src/migration/load/activity/preflight'
import { createStagingDb, type StagingDb } from '../staging/helpers'

/** MIG-07: the staged-table digest is constant in memory (count + sum of a 60-bit md5 slice per row hash), shared by BE-28 and BE-29. */
let env: StagingDb
const q = (sql: string, params: unknown[] = []) => env.pool.query(sql, params)
const subjects = () => tableDigest(env.pool, 'staging_cloud', 'subjects')

beforeAll(async () => {
  env = await createStagingDb()
  await q(renderDdl())
})
afterAll(async () => {
  await env.close()
})

describe('tableDigest', () => {
  it('works on an empty table: zero rows, digest 0', async () => {
    expect(await subjects()).toEqual({ n: '0', h: '0' })
  })

  it('is deterministic and does not depend on the order the rows were added in', async () => {
    await q(`insert into staging_cloud.subjects (id, "_row_hash") values (1, 'aa'), (2, 'bb'), (3, 'cc')`)
    const first = await subjects()
    expect(first.n).toBe('3')
    expect(first.h).toMatch(/^\d+$/)
    expect(await subjects()).toEqual(first)

    await q(`delete from staging_cloud.subjects`)
    await q(`insert into staging_cloud.subjects (id, "_row_hash") values (3, 'cc'), (1, 'aa'), (2, 'bb')`)
    expect(await subjects()).toEqual(first)

    // the same row hashes under other ids: only the hashes count
    await q(`update staging_cloud.subjects set id = id + 10`)
    expect(await subjects()).toEqual(first)
  })

  it('changes when a row hash is changed, a row is added or a row is deleted', async () => {
    await q(`delete from staging_cloud.subjects`)
    await q(`insert into staging_cloud.subjects (id, "_row_hash") values (1, 'aa'), (2, 'bb'), (3, 'cc')`)
    const base = await subjects()

    await q(`update staging_cloud.subjects set "_row_hash" = 'ab' where id = 2`)
    const changed = await subjects()
    expect(changed.n).toBe(base.n)
    expect(changed.h).not.toBe(base.h)
    await q(`update staging_cloud.subjects set "_row_hash" = 'bb' where id = 2`)
    expect(await subjects()).toEqual(base)

    await q(`insert into staging_cloud.subjects (id, "_row_hash") values (4, 'dd')`)
    const added = await subjects()
    expect(added.n).toBe('4')
    expect(added.h).not.toBe(base.h)
    await q(`delete from staging_cloud.subjects where id = 4`)
    expect(await subjects()).toEqual(base)

    await q(`delete from staging_cloud.subjects where id = 3`)
    const deleted = await subjects()
    expect(deleted.n).toBe('2')
    expect(deleted.h).not.toBe(base.h)
  })

  it('rejects an identifier that is not lower-case snake_case', async () => {
    await expect(tableDigest(env.pool, 'staging_cloud', 'subjects"; drop table x; --')).rejects.toBeInstanceOf(RangeError)
  })
})

describe('one digest for BE-28 and BE-29', () => {
  it('stagingFingerprint (BE-28) and tableFingerprints (BE-29) give the same part for the same table, on empty tables too', async () => {
    await q(`delete from staging_cloud.subjects`)
    const empty = await stagingFingerprint(env.pool)
    expect(empty).toHaveLength(10)
    expect(empty).toContain('subjects=0:0')
    expect(await tableFingerprints(env.pool, ['subjects', 'users'])).toEqual(['subjects=0:0', 'users=0:0'])

    await q(`insert into staging_cloud.subjects (id, "_row_hash") values (1, 'aa'), (2, 'bb')`)
    const core = (await stagingFingerprint(env.pool)).find((p) => p.startsWith('subjects='))
    const activity = (await tableFingerprints(env.pool, ['subjects']))[0]
    expect(core).toBe(activity)
    expect(core).toMatch(/^subjects=2:\d+$/)
    expect(await stagingFingerprint(env.pool)).not.toEqual(empty)
  })
})
