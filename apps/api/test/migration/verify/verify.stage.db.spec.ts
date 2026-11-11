/**
 * KP-22: a staged `migrate:verify` (`entities` / `--sector`) judges only the sectors that were loaded. A sector whose staging changed since its
 * last run (it is reloaded later) must not fail the stage that does not include it; the full run stays the default and still fails.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runVerify, SECTORS, sectorEntities, stageEntities, type VerifyReport } from '../../../src/migration/verify'
import { bootActivity, migrateAll, STANDALONE_NOT_RUN } from './helpers-verify'
import type { ActivityHarness } from '../activity/helpers'

let h: ActivityHarness

beforeAll(async () => {
  h = await bootActivity({ core: false })
  await migrateAll(h)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

const verify = (extra: object = {}): Promise<VerifyReport> => runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud', ...extra })

describe('stageEntities', () => {
  it('is null without a filter, resolves sectors, and refuses unknown names', () => {
    expect(stageEntities(undefined, undefined)).toBeNull()
    expect(stageEntities(['users', ' schools '], undefined)?.sort()).toEqual(['schools', 'users'])
    expect(stageEntities(undefined, 'questions')).toEqual(sectorEntities('questions'))
    expect(stageEntities(['users'], 'terbit')?.sort()).toEqual(['exam_papers', 'users'])
    expect(() => stageEntities(['nope'], undefined)).toThrow(/unknown entity "nope"/)
    expect(() => stageEntities(undefined, 'moon')).toThrow(/unknown sector "moon"/)
    expect(() => stageEntities([' '], undefined)).toThrow(/name no entity/)
    expect(SECTORS).toEqual(['core', 'questions', 'structured', 'papers', 'terbit', 'activity'])
  })
})

describe('a staged verify', () => {
  it('the full run is the default and is green on the fixture', async () => {
    const full = await verify()
    const bad = full.entities.filter((e) => e.status !== 'ok' && !STANDALONE_NOT_RUN(e)).map((e) => e.entity)
    expect(bad).toEqual([])
    expect(full.status).toBe('pass')
  })

  it('does not fail on a sector whose staging changed, unless that sector is named', async () => {
    const before = Number((await h.q<{ n: string }>(`select count(*)::text as n from staging_cloud.articles`))[0]?.n)
    expect(before).toBeGreaterThan(0)
    await h.q(`delete from staging_cloud.articles where ctid in (select ctid from staging_cloud.articles limit 1)`)

    const full = await verify()
    expect(full.status).toBe('fail')
    expect(full.entities.find((e) => e.entity === 'articles')?.note).toContain('staging changed since the run')

    const core = await verify({ entities: stageEntities(undefined, 'core') })
    expect(core.status, JSON.stringify(core.checks.filter((c) => c.status === 'mismatch'))).toBe('pass')
    const articles = core.entities.find((e) => e.entity === 'articles')
    expect(articles).toMatchObject({ status: 'not-run', note: 'not in this stage' })
    expect(core.entities.find((e) => e.entity === 'users')?.status).toBe('ok')
    // checks of the other sectors are listed, never judged
    expect(core.checks.find((c) => c.name === 'answers per subject')).toMatchObject({ status: 'reported', detail: 'not in this stage' })
    expect(core.checks.find((c) => c.name === 'users per role per school')?.detail).not.toBe('not in this stage')

    const named = await verify({ entities: ['articles'] })
    expect(named.status).toBe('fail')
    expect(named.entities.find((e) => e.entity === 'articles')?.status).toBe('mismatch')
  })

  it('a named entity that never ran is still a failure when it is required', async () => {
    const r = await verify({ entities: ['users'], runIds: ['999999'] })
    expect(r.status).toBe('fail')
    expect(r.entities.find((e) => e.entity === 'users')?.status).toBe('not-run')
  })
})
