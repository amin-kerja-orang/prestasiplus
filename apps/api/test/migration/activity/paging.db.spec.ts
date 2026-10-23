/**
 * Paging of the expanded reader (BE-29, code-review group B finding 4): `users.spm_targets` is read through
 * `readExpanded`, whose resume key is `<user id>:<position>`. Two private databases are loaded the same way:
 *   A  default page size, batch size 2, one apply;
 *   B  page size 2 and batch size 2, an apply that fails after batch 1 (the checkpoint then sits in the MIDDLE of one
 *      user's targets) and a resume.
 * B must end with the same rows, rejects and reconciliation as A. (`challenge_user` paging is covered elsewhere.)
 *
 * Planted (fictitious values, users only updated): U0 has three entries (the third repeats a subject), U1 one, U2 is
 * not JSON, U3 has two entries (the second repeats a subject), U4 names an unknown subject. 8 source rows, 4 loaded.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { activityGroupB } from '../../../src/migration/load/activity/part-b'
import { bootActivity, type ActivityHarness } from './helpers'

const ONLY = ['spm_targets']
const groups = [activityGroupB]

let a: ActivityHarness
let b: ActivityHarness

async function plant(h: ActivityHarness): Promise<void> {
  const u = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'users' order by legacy_id::bigint limit 5`)).map((r) => r.legacy_id)
  const s = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'subjects' order by legacy_id::bigint limit 2`)).map((r) => r.legacy_id)
  expect(u.length, 'five migrated users in the fixture').toBe(5)
  expect(s.length, 'two migrated subjects in the fixture').toBe(2)
  await h.q(`update staging_cloud.users set spm_targets = null`)
  const spm: [string, string][] = [
    [u[0] as string, JSON.stringify([{ subject_id: Number(s[0]), grade: 'A+' }, { subject_id: Number(s[1]), grade: 'B+' }, { subject_id: Number(s[0]), grade: 'C' }])],
    [u[1] as string, JSON.stringify({ [s[0] as string]: 'A' })],
    [u[2] as string, 'not json'],
    [u[3] as string, JSON.stringify([{ subject_id: Number(s[0]), grade: 'A' }, { subject_id: Number(s[0]), grade: 'B' }])],
    [u[4] as string, JSON.stringify({ '88888': 'A' })],
  ]
  for (const [id, text] of spm) await h.q(`update staging_cloud.users set spm_targets = $2 where id = $1::bigint`, [id, text])
}

const rejectsOf = (h: ActivityHarness, run: string) =>
  h.q(`select legacy_id, reason, column_name from etl_rejects where run_id = $1::bigint and entity = 'spm_targets' order by legacy_id, reason`, [run])
const rowsOf = (h: ActivityHarness) =>
  h.q(`select legacy_id, target_grade, is_test from spm_targets where legacy_source = 'cloud' order by legacy_id`)
const reconOf = (r: { recon: { entity: string; sourceCount: number; eligibleCount: number; loaded: number; rejected: number }[] }) =>
  r.recon.map((x) => [x.entity, x.sourceCount, x.eligibleCount, x.loaded, x.rejected])

beforeAll(async () => {
  a = await bootActivity()
  b = await bootActivity()
  await plant(a)
  await plant(b)
}, 300_000)
afterAll(async () => {
  await a?.close()
  await b?.close()
})

describe('spm_targets with a small page size', () => {
  it('equals the default page size run after an interrupted and resumed apply', async () => {
    expect((await a.run('dry-run', { only: ONLY, groups })).report.status).toBe('succeeded')
    const want = await a.run('apply', { only: ONLY, groups })
    expect(want.report.status).toBe('succeeded')
    expect(reconOf(want.report)).toEqual([['spm_targets', 8, 8, 4, 4]])
    expect((await rowsOf(a)).length).toBe(4)

    expect((await b.run('dry-run', { only: ONLY, groups, pageSize: 2 })).report.status).toBe('succeeded')
    let thrown = 0
    const failOnce = (steps: AnyEntityStep[]): AnyEntityStep[] =>
      steps.map((s) => ({
        ...s,
        async load(rows: unknown[], ctx: Parameters<AnyEntityStep['load']>[1]) {
          if (ctx.batch === 2 && thrown === 0) {
            thrown++
            throw new Error('injected failure after batch 1')
          }
          return s.load(rows, ctx)
        },
      }))
    await expect(b.run('apply', { only: ONLY, groups, pageSize: 2, transformSteps: failOnce })).rejects.toThrow('injected failure after batch 1')
    // Batch 1 holds the first two entries of U0, so the checkpoint key points into the middle of one user's targets.
    const checkpoint = await b.q<{ batch: number; last_key: string | null }>(`select batch, last_key from etl_checkpoints where entity = 'spm_targets'`)
    expect(checkpoint).toHaveLength(1)
    expect(checkpoint[0]?.batch).toBe(1)
    expect(checkpoint[0]?.last_key).toMatch(/^\d+:1$/)
    expect((await rowsOf(b)).length).toBe(2)

    const resumed = await b.run('apply', { only: ONLY, groups, pageSize: 2 })
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.report.resumedBatches).toBe(1)
    expect(reconOf(resumed.report)).toEqual(reconOf(want.report))
    expect(await rowsOf(b)).toEqual(await rowsOf(a))
    expect(await rejectsOf(b, resumed.report.runId)).toEqual(await rejectsOf(a, want.report.runId))
    expect(await b.contentHashes()).toEqual(await a.contentHashes())
  }, 240_000)
})
