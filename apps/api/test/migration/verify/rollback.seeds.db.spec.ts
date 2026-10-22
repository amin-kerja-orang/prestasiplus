/**
 * Provenance gap of the rollback: a seed row that the migration ADOPTED (it received the legacy pair) and that nothing
 * references cannot be told from an inserted row, so rollback deletes it and says so in `warnings`. Re-running the
 * idempotent seeds restores the pre-migration counts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { rollbackLegacy } from '../../../src/migration/verify'
import { loadForeignKeys } from '../../../src/migration/verify/fk-graph'
import type { ActivityHarness } from '../activity/helpers'
import { bootActivity, legacyTableCounts, migrateAll } from './helpers-verify'

let h: ActivityHarness
let before: Record<string, number> = {}
let adoptedCode = ''

beforeAll(async () => {
  h = await bootActivity({ core: false })
  // A seeded subject no table refers to (found through the foreign keys, so a new reference table is covered).
  const fks = (await loadForeignKeys(h.env.pool)).filter((f) => f.parent === 'subjects' && f.parentCols.join() === 'id')
  const used = new Set<string>()
  for (const fk of fks) {
    for (const r of await h.q<{ v: string }>(`select distinct "${fk.childCols[0]}"::text as v from "${fk.child}" where "${fk.childCols[0]}" is not null`)) used.add(r.v)
  }
  const seeded = await h.q<{ id: string; code: string }>(`select id::text as id, code from subjects where legacy_source is null order by id`)
  const free = seeded.find((s) => !used.has(s.id))
  expect(free, 'the seeds must give a subject nothing refers to').toBeDefined()
  adoptedCode = free?.code as string
  // The first staged subject gets that code, so the load adopts the seed row instead of inserting a new one.
  await h.q(`update staging_cloud.subjects set code = $1 where id = (select min(id) from staging_cloud.subjects)`, [adoptedCode])
  before = await legacyTableCounts(h)
  await migrateAll(h)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('adopted but unreferenced seed row', () => {
  it('is adopted by the load', async () => {
    expect(await h.count('subjects', `legacy_source = 'cloud' and upper(code) = upper('${adoptedCode}')`)).toBe(1)
  })

  it('is deleted by the rollback with a warning, and the seeds restore the counts', async () => {
    const report = await rollbackLegacy({ pool: h.env.pool, env: { ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: '1' }, source: 'cloud', confirmDb: h.env.db.name })
    expect(report.warnings?.some((w) => /^subjects: \d+ rows deleted may include adopted seed rows; re-run the idempotent seeds \(npm run be:db:seed\)/.test(w))).toBe(true)
    expect((await legacyTableCounts(h)).subjects).toBe((before.subjects ?? 0) - 1)

    await runSeeds([curriculumSeed], { prisma: h.env.db.prisma })
    expect(await legacyTableCounts(h)).toEqual(before)
  }, 120_000)
})
