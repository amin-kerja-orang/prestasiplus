/**
 * BE-29 Part B, operations group against a real PostgreSQL: support tickets, timeline posts and feedback.
 *
 * Tickets: the staging spec has no message body (LEAD Q6), so run R1 rejects every ticket INVALID_VALUE (`body`); run R2
 * injects a body into the extract (what the step does once the spec carries the column) to show the status map and the
 * subject limit. Timeline and feedback need no injection. The staged values are synthetic.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { runCore } from '../../../src/migration/load'
import { migrateActivity } from '../../../src/migration/load/activity/command'
import { opsGroup } from '../../../src/migration/load/activity/part-b'
import { ROLE_MAP } from '../../../src/migration/transform/enums'
import { testOutDir } from '../staging/helpers'
import { AS_OF, bootActivity, type ActivityHarness } from './helpers'

let h: ActivityHarness
let u: string[] = []
let role0 = ''
const groups = [opsGroup]

type Reasons = Record<string, number>
const reasonsOf = async (runId: string): Promise<Reasons> =>
  Object.fromEntries(
    (await h.q<{ entity: string; reason: string; column_name: string; n: number }>(
      `select entity, reason, column_name, count(*)::int n from etl_rejects where run_id = $1 group by 1, 2, 3`, [runId],
    )).map((r) => [`${r.entity}|${r.reason}|${r.column_name}`, r.n]),
  )
const n = (r: Reasons, entity: string, reason: string, column: string): number => r[`${entity}|${reason}|${column}`] ?? 0

/** Adds columns the staging spec does not have yet to the rows an entity reads, by source id. */
const inject =
  (extra: Record<string, Record<string, Record<string, string>>>) =>
  (steps: AnyEntityStep[]): AnyEntityStep[] =>
    steps.map((step) => {
      const add = extra[step.entity]
      if (!add) return step
      return {
        ...step,
        extract: (after: string | null) =>
          (async function* () {
            for await (const row of step.extract(after) as AsyncIterable<Record<string, string | null>>) yield { ...row, ...(add[row.id as string] ?? {}) }
          })(),
      }
    })

let r1: Reasons
let r2: Reasons
let r1Blocked: unknown = null
let r1BlockedNote: number | undefined
let r2Blocked: unknown = null
let r1Recon: Record<string, { source: number; eligible: number; loaded: number; rejected: number }> = {}

beforeAll(async () => {
  h = await bootActivity()
  const q = (sql: string, params: unknown[] = []) => h.env.pool.query(sql, params)
  u = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'users' order by legacy_id::bigint limit 2`)).map((r) => r.legacy_id)
  expect(u.length).toBe(2)
  role0 = (await h.q<{ role: string }>(`select role from staging_cloud.users where id = $1::bigint`, [u[0]]))[0]?.role ?? ''
  for (const t of ['support_tickets', 'timeline_entries', 'feedback']) await q(`delete from staging_cloud.${t}`)

  await q(
    `insert into staging_cloud.support_tickets (id, user_id, subject, status) values
      (1, ${u[0]}, 'Tiket satu', 'dibuka'), (2, ${u[0]}, $1, 'selesai'), (3, ${u[1]}, 'Tiket tiga', 'tidak_dikenali'), (4, 99999, 'Tiket empat', 'dibuka'),
      (5, ${u[0]}, 'Tiket lima', 'open'), (6, ${u[0]}, 'Tiket enam', 'closed'), (7, ${u[0]}, 'Tiket tujuh', 'in_progress'),
      (8, ${u[0]}, 'Tiket lapan', 'resolved'), (9, ${u[0]}, 'Tiket sembilan', 'menunggu_balas')`,
    ['a'.repeat(256)],
  )
  await q(
    `insert into staging_cloud.timeline_entries (id, user_id, title, body, happened_on) values
      (1, ${u[0]}, 'Sijil Matematik', 'Cerita pendek', '2026-02-01'),
      (2, ${u[0]}, $1, 'Cerita', '2026-02-02'),
      (3, ${u[0]}, 'Tajuk baik', $2, '2026-02-03'),
      (4, ${u[1]}, 'Tanpa cerita', null, null),
      (5, 99999, 'Pengguna tiada', 'Cerita', null),
      (6, ${u[0]}, $3, $4, '2026-02-06')`,
    ['t'.repeat(151), 's'.repeat(2001), 'y'.repeat(150), 'z'.repeat(2000)],
  )
  await q(`insert into staging_cloud.feedback (id, user_id, score, satisfaction, usability, relevance, comment, created_at) values
    (1, ${u[0]}, 4, 4, 3, 5, 'Komen satu', '2026-04-30T23:30:00Z'),
    (2, ${u[0]}, 5, 5, 4, 4, 'Komen dua', '2026-05-20T10:00:00Z'),
    (3, ${u[0]}, 3, 3, null, null, null, '2026-04-15T10:00:00Z'),
    (4, ${u[1]}, 3, 6, 3, 3, null, '2026-03-10T10:00:00Z'),
    (5, ${u[1]}, 9, 3, 3, 3, null, '2026-07-01T10:00:00Z'),
    (6, ${u[1]}, 3, 3, 3, 3, null, '2026-06-01T00:00:00Z'),
    (7, 99999, 3, 3, 3, 3, null, '2026-06-01T00:00:00Z'),
    (8, ${u[1]}, 5, 5, 5, 5, 'Komen lapan', '2026-06-15T00:00:00Z')`)

  const dry1 = await h.run('dry-run', { groups })
  expect(dry1.report.status).toBe('succeeded')
  const a1 = await h.run('apply', { groups })
  expect(a1.report.status).toBe('succeeded')
  r1 = await reasonsOf(a1.report.runId)
  r1Blocked = a1.blockedBySpec
  r1BlockedNote = a1.activity.notes.counters.get('blocked_by_spec.support_tickets')
  r1Recon = Object.fromEntries(a1.report.recon.map((r) => [r.entity, { source: r.sourceCount, eligible: r.eligibleCount, loaded: r.loaded, rejected: r.rejected }]))

  const bodies = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [String(i), { body: 'Mesej contoh' }]))
  const a2 = await h.run('apply', { groups, transformSteps: inject({ support_tickets: bodies }) })
  expect(a2.report.status).toBe('succeeded')
  r2 = await reasonsOf(a2.report.runId)
  r2Blocked = a2.blockedBySpec
}, 600_000)
afterAll(async () => {
  await h?.close()
})

describe('support_tickets', () => {
  it('R1: with the staging spec as it is, a valid ticket is rejected INVALID_VALUE on body, never loaded with an invented one', () => {
    // ids 1 and 5 to 9 have a good status and subject; id 2 fails on the subject first.
    expect(n(r1, 'support_tickets', 'INVALID_VALUE', 'body')).toBe(6)
    expect(n(r1, 'support_tickets', 'INVALID_VALUE', 'subject')).toBe(1)
    expect(n(r1, 'support_tickets', 'UNKNOWN_ENUM', 'status')).toBe(1)
    expect(n(r1, 'support_tickets', 'ORPHAN_PARENT', 'user_id')).toBe(1)
    expect(r1Recon.support_tickets).toEqual({ source: 9, eligible: 9, loaded: 0, rejected: 9 })
  })

  it('R1: the green run is flagged "blocked by spec" (counts only), with a note counter; R2 loads rows and is not flagged', async () => {
    expect(r1Blocked).toEqual([{ entity: 'support_tickets', sourceCount: 9 }])
    expect(r1BlockedNote).toBe(9)
    expect(r2Blocked).toEqual([])
    const lines: string[] = []
    const code = await migrateActivity.run(
      { mode: 'dry-run', flags: new Map<string, string | true>([['as-of', AS_OF], ['core-as-of', AS_OF], ['group', 'ops'], ['table', 'support_tickets']]), positional: [] },
      { pool: h.env.pool, env: h.runEnv, out: (l) => lines.push(l), err: (l) => lines.push(l) },
    )
    expect(code).toBe(0)
    // No body is injected here, so the dry-run loads nothing of the 9 staged tickets and the spec gap is reported.
    expect(lines).toContain('blocked by spec: support_tickets 0/9')
    expect(lines).toContain('note blocked_by_spec.support_tickets: 9')
  })

  it('R2: with a body, the status is mapped onto the BM codes and a subject of 256 characters is rejected, not cut', async () => {
    const rows = await h.q<{ legacy_id: string; status: string; body: string }>(`select legacy_id, status, body from support_tickets order by legacy_id::bigint`)
    expect(rows.map((r) => `${r.legacy_id}=${r.status}`)).toEqual(['1=dibuka', '5=dibuka', '6=ditutup', '7=dalam_proses', '8=selesai', '9=menunggu_balas'])
    expect(rows.every((r) => r.body === 'Mesej contoh')).toBe(true)
    expect(n(r2, 'support_tickets', 'INVALID_VALUE', 'subject')).toBe(1)
    expect(n(r2, 'support_tickets', 'UNKNOWN_ENUM', 'status')).toBe(1)
  })
})

describe('timeline_posts', () => {
  it('keeps the date as a date, fixes the category and moves body to story', async () => {
    const rows = await h.q<{ legacy_id: string; category: string; event_date: string | null; story: string | null; title_len: number; story_len: number | null }>(
      `select legacy_id, category, event_date::text, story, char_length(title) title_len, char_length(story) story_len from timeline_posts order by legacy_id::bigint`,
    )
    expect(rows).toEqual([
      { legacy_id: '1', category: 'lain', event_date: '2026-02-01', story: 'Cerita pendek', title_len: 15, story_len: 13 },
      { legacy_id: '4', category: 'lain', event_date: null, story: null, title_len: 12, story_len: null },
      { legacy_id: '6', category: 'lain', event_date: '2026-02-06', story: 'z'.repeat(2000), title_len: 150, story_len: 2000 },
    ])
  })

  it('rejects a title over 150 characters, a story over 2000 and an unknown user', () => {
    expect(n(r1, 'timeline_posts', 'INVALID_VALUE', 'title')).toBe(1)
    expect(n(r1, 'timeline_posts', 'INVALID_VALUE', 'body')).toBe(1)
    expect(n(r1, 'timeline_posts', 'ORPHAN_PARENT', 'user_id')).toBe(1)
    expect(r1Recon.timeline_posts).toEqual({ source: 6, eligible: 6, loaded: 3, rejected: 3 })
  })
})

describe('feedback', () => {
  it('keeps the newest row per user and Malaysia month, nps null, role and school from the user', async () => {
    const rows = await h.q<{ legacy_id: string; month: string; role: string; nps: number | null; satisfaction: number; comment: string | null }>(
      `select legacy_id, month::text, role, nps, satisfaction, comment from feedback order by legacy_id::bigint`,
    )
    expect(rows.map((r) => `${r.legacy_id}@${r.month}`)).toEqual(['2@2026-05-01', '3@2026-04-01', '8@2026-06-01'])
    expect(rows.every((r) => r.nps === null)).toBe(true)
    expect(rows[0]?.role).toBe(ROLE_MAP[role0.toLowerCase()])
    expect(rows[0]?.comment).toBe('Komen dua')
  })

  it('treats 23:30 UTC on 30 April as 1 May in Malaysia, so it competes with the May row and loses to it', () => {
    // Row 1 (2026-04-30T23:30Z) and row 2 (2026-05-20) share the Malaysia month 2026-05; row 6 and 8 share 2026-06.
    expect(n(r1, 'feedback', 'DUPLICATE_KEY', 'month')).toBe(2)
  })

  it('rejects satisfaction or scores outside 1 to 5 and an unknown user', () => {
    expect(n(r1, 'feedback', 'INVALID_VALUE', 'satisfaction')).toBe(1)
    expect(n(r1, 'feedback', 'INVALID_VALUE', 'score')).toBe(1)
    expect(n(r1, 'feedback', 'ORPHAN_PARENT', 'user_id')).toBe(1)
    expect(r1Recon.feedback).toEqual({ source: 8, eligible: 8, loaded: 3, rejected: 5 })
  })
})

describe('feedback of a user deleted at the source (delta, staging has no cascade)', () => {
  it('is rejected ORPHAN_PARENT on user_id, not UNKNOWN_ENUM on role, although the id map knows the user; loaded v2 rows stay', async () => {
    const keep = u[0] as string
    const v2Before = await h.q(`select legacy_id, user_id::text, role, month::text, satisfaction, comment from feedback order by legacy_id::bigint`)
    expect(v2Before.length).toBe(3)
    const mapped = await h.count('etl_id_map', `t.legacy_source = 'cloud' and t.entity = 'users' and t.legacy_id = '${keep}'`)
    expect(mapped).toBe(1)
    await h.q(`create table staging_cloud._user_bak as select * from staging_cloud.users where id = $1::bigint`, [keep])
    try {
      await h.q(`delete from staging_cloud.users where id = $1::bigint`, [keep])
      const sourceBefore = await h.count('staging_cloud.feedback')
      // The delta: BE-28 is re-run on the changed staging (it never deletes a mapped user), so the preflight passes.
      for (const mode of ['dry-run', 'apply'] as const) {
        const core = await runCore({ pool: h.env.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, mode, batchSize: 2, outDir: testOutDir() })
        expect(core.report.status).toBe('succeeded')
      }
      expect((await h.run('dry-run', { groups })).report.status).toBe('succeeded')
      const a = await h.run('apply', { groups })
      expect(a.report.status).toBe('succeeded')
      const r = await reasonsOf(a.report.runId)
      // Feedback 1, 2 and 3 belong to the removed user; 7 is the unknown user 99999 (both ORPHAN_PARENT now).
      expect(n(r, 'feedback', 'UNKNOWN_ENUM', 'role')).toBe(0)
      expect(n(r, 'feedback', 'ORPHAN_PARENT', 'user_id')).toBe(4)
      expect(a.report.recon.find((x) => x.entity === 'feedback')?.sourceCount).toBe(sourceBefore)
      const v2After = await h.q(`select legacy_id, user_id::text, role, month::text, satisfaction, comment from feedback order by legacy_id::bigint`)
      expect(v2After).toEqual(v2Before)
    } finally {
      await h.q(`insert into staging_cloud.users select * from staging_cloud._user_bak`)
      await h.q(`drop table staging_cloud._user_bak`)
    }
  })
})

describe('feedback already held by a v2-born row for the same (user, month, is_test)', () => {
  it('rejects the legacy row DUPLICATE_KEY on month, leaves the v2 row untouched, and neither run aborts', async () => {
    const user = u[1] as string
    const v2User = (await h.q<{ new_id: string }>(
      `select new_id::text from etl_id_map where legacy_source = 'cloud' and entity = 'users' and legacy_id = $1`, [user],
    ))[0]?.new_id
    expect(v2User).toBeDefined()
    // 2026-09: a Malaysia month no other fixture row uses. The v2-born row has no legacy pair.
    await h.q(`insert into staging_cloud.feedback (id, user_id, score, satisfaction, usability, relevance, comment, created_at) values
      (9, ${user}, 4, 4, 4, 4, 'Komen sembilan', '2026-09-10T10:00:00Z')`)
    await h.q(
      `insert into feedback (user_id, role, month, satisfaction, comment, is_test) values ($1::bigint, 'student', '2026-09-01', 2, 'Komen v2', false)`,
      [v2User],
    )
    const snapshot = () => h.q(`select id::text, user_id::text, role, month::text, satisfaction, comment, legacy_source, legacy_id, updated_at::text from feedback where month = '2026-09-01'`)
    try {
      const v2Before = await snapshot()
      expect(v2Before.length).toBe(1)
      const dry = await h.run('dry-run', { groups })
      expect(dry.report.status).toBe('succeeded')
      const a = await h.run('apply', { groups })
      expect(a.report.status).toBe('succeeded')
      const r = await reasonsOf(a.report.runId)
      // The two superseded rows of the base fixture (still DUPLICATE_KEY on a re-run) plus the one held by the v2-born row.
      expect(n(r, 'feedback', 'DUPLICATE_KEY', 'month')).toBe(n(r1, 'feedback', 'DUPLICATE_KEY', 'month') + 1)
      expect(await snapshot()).toEqual(v2Before)
      expect(await h.count('feedback', `t.legacy_source = 'cloud' and t.legacy_id = '9'`)).toBe(0)
      const recon = a.report.recon.find((x) => x.entity === 'feedback')
      expect(recon?.status).toBe('ok')
      expect(recon).toMatchObject({ sourceCount: 9, eligibleCount: 9, loaded: 3, rejected: 6 })
    } finally {
      await h.q(`delete from feedback where month = '2026-09-01'`)
      await h.q(`delete from staging_cloud.feedback where id = 9`)
    }
  })
})
