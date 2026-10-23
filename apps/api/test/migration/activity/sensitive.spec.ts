/**
 * Sensitive categories are never read (card AC5, Q7): a SQL spy over every statement of a full dry-run and apply
 * of `migrate:activity` checks that the mood, wellbeing, psychometric, aspiration, foster and intervention tables
 * are never queried, and that every staging / archive table that IS queried is on the declared read list (so it
 * is also part of the input hash). Runs the whole registry, so it covers the steps Parts A and B add.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACTIVITY_GROUPS } from '../../../src/migration/load/activity'
import { ACTIVITY_READ_TABLES } from '../../../src/migration/load/activity/preflight'
import { bootActivity, type ActivityHarness } from './helpers'

const SENSITIVE =
  /\b(mood_checkins|wellbeing_alerts|psychometric_results|aspirations|foster_applications|foster_sponsorships|sponsors|interventions)\b/i
/** Read by the BE-28 preflight (its input fingerprint). */
const CORE_FINGERPRINT_TABLES = [
  'education_levels', 'subjects', 'chapters', 'topics', 'schools', 'users', 'parent_student', 'classrooms', 'classroom_student', 'school_subscriptions',
]
const STAGED_REF = /\b(staging_cloud|archive_cloud)"?\."?([a-z_][a-z0-9_]*)/g

let h: ActivityHarness
beforeAll(async () => {
  h = await bootActivity()
}, 300_000)
afterAll(async () => {
  await h?.close()
})

/** Records the text of every statement sent through any `pg` client while `fn` runs. */
async function spy(fn: () => Promise<void>): Promise<string[]> {
  const seen: string[] = []
  const original = pg.Client.prototype.query
  pg.Client.prototype.query = function patched(this: unknown, ...args: unknown[]) {
    const first = args[0]
    if (typeof first === 'string') seen.push(first)
    else if (first && typeof first === 'object' && typeof (first as { text?: unknown }).text === 'string') seen.push((first as { text: string }).text)
    return (original as (...a: unknown[]) => unknown).apply(this, args)
  } as typeof original
  try {
    await fn()
  } finally {
    pg.Client.prototype.query = original
  }
  return seen
}

describe('sensitive tables (AC5)', () => {
  it('never queries a sensitive table and reads only declared staged tables', async () => {
    const statements = await spy(async () => {
      expect((await h.run('dry-run')).report.status).toBe('succeeded')
      expect((await h.run('apply')).report.status).toBe('succeeded')
    })
    expect(statements.length).toBeGreaterThan(20)

    const offenders = statements.filter((s) => SENSITIVE.test(s))
    expect(offenders.map((s) => s.slice(0, 80))).toEqual([])

    const declared = new Set([
      ...ACTIVITY_READ_TABLES.map((t) => t.replace(/^archive_cloud\./, '')),
      ...ACTIVITY_GROUPS.flatMap((g) => g.reads ?? []).map((t) => t.replace(/^archive_cloud\./, '')),
      ...CORE_FINGERPRINT_TABLES,
    ])
    const read = new Set<string>()
    for (const s of statements) for (const m of s.matchAll(STAGED_REF)) read.add(m[2] as string)
    expect(read.size).toBeGreaterThan(0)
    const undeclared = [...read].filter((t) => !declared.has(t))
    // A new step that reads another staged table must add it to ACTIVITY_READ_TABLES (or the group's `reads`).
    expect(undeclared).toEqual([])
  }, 120_000)

  it('the SQL spy does see staged reads (it would catch a sensitive one)', async () => {
    const statements = await spy(async () => {
      await h.env.pool.query('select count(*) from staging_cloud.mood_checkins')
    })
    expect(statements.some((s) => SENSITIVE.test(s))).toBe(true)
  })
})
