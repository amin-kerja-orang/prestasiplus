/**
 * End to end with the REAL reconciliation (no mock of `./verify`): `runAll --apply` on the `cloud-tiny` fixture ends with
 * `runVerify` = pass and the report files on disk, and a `runDelta` after one changed staged row passes it again.
 * The test probe group of the activity helper is removed after the boot, so the run holds exactly the production entities.
 */
import { existsSync, readFileSync } from 'node:fs'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACTIVITY_GROUPS } from '../../../src/migration/load/activity'
import { hashRow } from '../../../src/migration/kit'
import { runAll, runDelta } from '../../../src/migration/orchestrate'
import { AS_OF, bootActivity, PROBE_GROUP, tempOutDir } from './helpers-verify'
import type { ActivityHarness } from '../activity/helpers'

let h: ActivityHarness
const out = tempOutDir()

beforeAll(async () => {
  h = await bootActivity({ core: false })
  ACTIVITY_GROUPS.splice(ACTIVITY_GROUPS.indexOf(PROBE_GROUP), 1)
  // Give every teacher profile data, so the profile rule has rows to check (synthetic text).
  await h.q(`update staging_cloud.users set teaching_subject = 'Subjek Ujian' where role = 'guru'`)
}, 300_000)
afterAll(async () => {
  out.cleanup()
  await h?.close()
})

const options = () => ({ pool: h.env.pool, env: h.runEnv, asOf: AS_OF, batchSize: 2, outDir: out.path })

describe('real runVerify', () => {
  it('runAll --apply: every stage succeeds, verify passes and the report files are written', async () => {
    const r = await runAll({ ...options(), mode: 'apply' })
    const bad = r.verify?.entities.filter((e) => e.status !== 'ok').map((e) => `${e.entity}: ${e.status} ${e.note ?? ''}`)
    expect({ stages: r.stages.map((s) => `${s.name}/${s.mode}/${s.status}`), bad }).toEqual({
      stages: ['core/dry-run/succeeded', 'core/apply/succeeded', 'activity/dry-run/succeeded', 'activity/apply/succeeded', 'verify/verify/succeeded'],
      bad: [],
    })
    expect(r.status).toBe('succeeded')
    expect(r.verify?.status).toBe('pass')
    expect(r.verify?.runIds.length).toBeGreaterThan(0)
    const files = r.verify?.files
    expect(files && existsSync(files.json) && existsSync(files.md)).toBe(true)
    expect(files?.json.startsWith(out.path)).toBe(true)
    expect(JSON.parse(readFileSync(files?.json ?? '', 'utf8')).status).toBe('pass')
  }, 300_000)

  it('runDelta after one changed staged row: updates it and the real verify passes again', async () => {
    const id = (await h.q<{ id: string }>(`select legacy_id as id from practice_sessions where legacy_source = 'cloud' order by legacy_id::bigint limit 1`))[0]?.id ?? ''
    expect(id).not.toBe('')
    await h.q(`update staging_cloud.practice_sessions set duration_seconds = duration_seconds + 100, updated_at = '2026-06-03T00:00:00Z' where id = $1::bigint`, [id])
    const row = (await h.q<{ j: Record<string, unknown> }>(
      `select to_jsonb(t) - '_row_hash' - '_loaded_at' as j from staging_cloud.practice_sessions t where id = $1::bigint`, [id],
    ))[0]?.j
    await h.q(`update staging_cloud.practice_sessions set _row_hash = $2 where id = $1::bigint`, [id, hashRow(row ?? {})])

    const r = await runDelta({ ...options(), mode: 'apply', since: '2026-06-02T00:00:00Z' })
    expect(r.status).toBe('succeeded')
    expect(r.delta?.entities.filter((e) => e.updated > 0).map((e) => `${e.entity}:${e.updated}`)).toEqual(['practice_sessions:1'])
    expect(r.verify?.status).toBe('pass')
    const files = r.verify?.files
    expect(files && existsSync(files.json)).toBe(true)
  }, 300_000)
})
